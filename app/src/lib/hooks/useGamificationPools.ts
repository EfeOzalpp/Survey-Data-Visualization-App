// src/lib/hooks/useGamificationPools.ts
import { useMemo, useSyncExternalStore } from 'react';
import { shouldUseMockReads } from '../../client-api/read-api/config';
import { storageKeyFor, safeSession, bucketForPercent } from '../utils/session-cache';

interface CopyDoc {
  _id: string;
  _updatedAt: string;
  range?: { minPct: number; maxPct: number };
  titles?: string[];
  secondary?: string[];
  enabled?: boolean;
}

interface ReadyCopyDoc extends CopyDoc {
  range: { minPct: number; maxPct: number };
  titles: string[];
  secondary: string[];
}

interface PoolState {
  docs: CopyDoc[];
  rev: string;      // increments when docs change (use _updatedAt max)
  loaded: boolean;  // true after first live fetch completes
}

interface FallbackBucket {
  titles: string[];
  secondary: string[];
}

interface QueueState {
  queue: number[];
  cursor: number;
}

type CopyType = 'general' | 'personalized';
type CopyGroups = Record<CopyType, CopyDoc[]>;

const isReadyCopyDoc = (doc: CopyDoc): doc is ReadyCopyDoc =>
  !!doc.range &&
  Array.isArray(doc.titles) &&
  doc.titles.length > 0 &&
  Array.isArray(doc.secondary) &&
  doc.secondary.length > 0;

class ReadApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ReadApiError';
    this.status = status;
  }
}

function isCopyDocs(value: unknown): value is CopyDoc[] {
  return Array.isArray(value) && value.every((doc) => {
    if (!doc || typeof doc !== 'object') return false;
    const record = doc as Record<string, unknown>;
    return typeof record._id === 'string' && typeof record._updatedAt === 'string';
  });
}

function isCopyGroups(value: unknown): value is CopyGroups {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return isCopyDocs(record.general) && isCopyDocs(record.personalized);
}

function shouldFallbackToMock(error: unknown) {
  if (!(error instanceof ReadApiError)) return false;
  return error.status === 403 || error.status === 429 || error.status >= 500;
}

function readDocsFromBody(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  return (value as Record<string, unknown>).docs;
}

async function fetchCopyGroups(): Promise<CopyGroups> {
  const url = new URL('/api/gamification-copy', window.location.origin);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  const body = await response.json().catch((): unknown => ({})) as unknown;
  const docs = readDocsFromBody(body);

  if (!response.ok) {
    throw new ReadApiError(
      `Gamification copy API failed with status ${String(response.status)}`,
      response.status
    );
  }

  if (!isCopyGroups(docs)) {
    throw new ReadApiError('Gamification copy API returned an invalid response', 502);
  }

  return docs;
}

/** Simple store util */
function createStore(initial: PoolState) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (next: Partial<PoolState>) => {
      state = { ...state, ...next };
      subs.forEach((fn) => {
        fn();
      });
    },
    subscribe: (fn: () => void) => {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}

/** One singleton per copy type */
function createPool(copyType: CopyType) {
  const store = createStore({ docs: [], rev: 'v0', loaded: false });

  const setFallbackReady = () => {
    // When CMS copy is unavailable or mock reads are active, let the
    // consuming component's local fallback buckets provide the text.
    store.set({ docs: [], rev: 'fallback', loaded: true });
  };

  const pump = (rows: CopyDoc[]) => {
    const docs = rows;
    const latest = docs.reduce((m, r) => (r._updatedAt > m ? r._updatedAt : m), '');
    store.set({ docs, rev: latest || 'v1', loaded: true });
  };

  const usePool = () => {
    // Subscribe to external store (React 18 safe)
    const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
    const { docs, rev, loaded } = snapshot;

    // Build the picker from current snapshot
    const pick = useMemo(() => {
      const sorted = docs
        .filter(isReadyCopyDoc)
        .sort((a, b) => a.range.minPct - b.range.minPct);

      // Small Fisher-Yates shuffle.
      const shuffle = <T,>(arr: T[]) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      };

      return (
        pct: number,
        cachePrefix: string,
        id: string,
        fallback?: Record<string, FallbackBucket>
      ) => {
        const p = Math.max(0, Math.min(100, Math.round(Number.isFinite(pct) ? pct : 0)));
        const found = sorted.find((d) => p >= d.range.minPct && p <= d.range.maxPct);

        // Include copy type + rev so cache invalidates on CMS changes.
        const stableKey = storageKeyFor(`${cachePrefix}:${copyType}:${rev}`, id, p, 'v1');

        // If this id+pct already has an assignment, return it (stability per dot)
        const cached = safeSession.get<{ title: string; secondary: string } | null>(stableKey, null);
        if (cached?.title && cached.secondary) return cached;

        // Resolve source arrays (from CMS or fallback)
        const fbKey = fallback ? bucketForPercent(p) : null;
        const fallbackBucket = fallback && fbKey ? fallback[fbKey] : undefined;
        const titles =
          found?.titles.length ? found.titles : fallbackBucket?.titles ?? null;
        const secondary =
          found?.secondary.length
            ? found.secondary
            : fallbackBucket?.secondary ?? null;

        if (!titles?.length || !secondary?.length) return null;

        // We pair titles[i] with secondary[i]; if lengths differ, clamp to min.
        const N = Math.min(titles.length, secondary.length);
        if (N <= 0) return null;

        // === NO-REPEAT BUCKET QUEUE (session-scoped, per range, per copy type + rev) ===
        // Build a bucket identifier that is stable for the pct range we matched.
        const bucketId =
          found
            ? `${String(found.range.minPct)}-${String(found.range.maxPct)}`
            : // Fallback bucket uses the coarse fb key (e.g., '41-60')
              fbKey ?? 'fallback';

        // A pool that survives re-renders within the same session and resets on CMS rev change.
        const poolKey = storageKeyFor(
          `${copyType}:${rev}:pool`,
          bucketId,
          0,
          'v1'
        );

        let pool = safeSession.get<QueueState | null>(poolKey, null);

        const createQueue = (): QueueState => ({
          queue: shuffle(Array.from({ length: N }, (_, i) => i)),
          cursor: 0,
        });

        const savePool = (nextPool: QueueState) => {
          pool = nextPool;
          safeSession.set(poolKey, nextPool);
        };

        if (!pool || !Array.isArray(pool.queue) || typeof pool.cursor !== 'number' || pool.queue.length !== N) {
          savePool(createQueue());
        }

        // Draw next index without replacement; reshuffle after exhausting.
        const currentPool = pool;
        if (!currentPool) return null;
        const idx = currentPool.queue[currentPool.cursor] ?? 0;
        const nextCursor = currentPool.cursor + 1;
        if (nextCursor >= currentPool.queue.length) {
          // Exhausted, reshuffle for next cycle.
          savePool(createQueue());
        } else {
          savePool({ ...currentPool, cursor: nextCursor });
        }

        // Pair title+secondary at the same index (clamped)
        const chosen = { title: titles[idx] ?? titles[0], secondary: secondary[idx] ?? secondary[0] };

        // Cache per id+pct so a given dot stays consistent across renders
        safeSession.set(stableKey, chosen);
        return chosen;
      };
    }, [docs, rev]);

    return { pick, loaded, hasCMS: docs.length > 0, rev };
  };

  return { pump, setFallbackReady, usePool };
}

/** Two singletons */
const generalPool = createPool('general');
const personalizedPool = createPool('personalized');
const pools: Record<CopyType, ReturnType<typeof createPool>> = {
  general: generalPool,
  personalized: personalizedPool,
};

let sourceStarted = false;

const setAllFallbackReady = () => {
  pools.general.setFallbackReady();
  pools.personalized.setFallbackReady();
};

function startCopySource() {
  if (sourceStarted) return;
  sourceStarted = true;

  if (shouldUseMockReads()) {
    setAllFallbackReady();
    return;
  }

  const refresh = async () => {
    try {
      const groups = await fetchCopyGroups();
      if (shouldUseMockReads()) {
        setAllFallbackReady();
        return;
      }
      pools.general.pump(groups.general);
      pools.personalized.pump(groups.personalized);
    } catch (error: unknown) {
      if (shouldFallbackToMock(error)) {
        console.warn('[gamification-copy] Using bundled copy fallback', error);
        setAllFallbackReady();
        return;
      }
      console.error(error);
    }
  };

  void refresh();
}

/** Hooks for components: they only subscribe; they do not start fetch if not started yet */
export function useGeneralPools() {
  // if nothing started them yet, start once here as a safety net.
  startCopySource();
  return generalPool.usePool();
}

export function usePersonalizedPools() {
  startCopySource();
  return personalizedPool.usePool();
}
