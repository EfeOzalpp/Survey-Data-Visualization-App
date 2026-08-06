import { useMemo } from 'react';
import { avgWeightOf, type WithWeights } from '../utils/score';

// src/lib/hooks/useRelativeScore.ts

type TiePolicy = 'strict' | 'lte';

interface RelativeScoreOptions<TItem extends WithWeights> {
  accessor?: (item: TItem) => number;
  tie?: TiePolicy;
  idOf?: (item: TItem) => string | undefined;
}

const defaultIdOf = (item: WithWeights) => item._id;

export function useRelativeScores<TItem extends WithWeights>(
  items: TItem[],
  opts?: RelativeScoreOptions<TItem>
) {
  const accessor = opts?.accessor ?? avgWeightOf;
  const tie = opts?.tie ?? 'strict';
  const idOf = opts?.idOf ?? defaultIdOf;

  // Precompute once per data change
  const { sorted, idToValue } = useMemo(() => {
    const values = items.map(accessor);
    const sorted = values.slice().sort((a, b) => a - b);
    const idToValue = new Map<string, number>();
    items.forEach((it) => {
      const id = idOf(it);
      if (id) idToValue.set(id, accessor(it));
    });
    return { sorted, idToValue };
  }, [items, accessor, idOf]);

  // binary searches
  const lowerBound = (v: number) => {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo; // first index >= v
  };
  const upperBound = (v: number) => {
    let lo = 0, hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid] <= v) lo = mid + 1;
      else hi = mid;
    }
    return lo; // first index > v
  };

  const belowCount = (v: number) => (tie === 'strict' ? lowerBound(v) : upperBound(v));

  /** % of pool below value; optionally exclude one id (e.g., self) */
  const getForValue = (value: number, excludeId?: string) => {
    if (!sorted.length || !Number.isFinite(value)) return 0;

    let pool = sorted.length;
    let cnt = belowCount(value);

    if (excludeId && idToValue.has(excludeId)) {
      const ex = idToValue.get(excludeId);
      if (ex === undefined) return Math.round((cnt / pool) * 100);
      pool -= 1;
      if (tie === 'strict') {
        if (ex < value) cnt -= 1;
      } else {
        if (ex <= value) cnt -= 1;
      }
    }
    if (pool <= 0) return 0;
    return Math.round((cnt / pool) * 100);
  };

  /** raw count below; optionally exclude one id (e.g., self) */
  const getCountForValue = (value: number, excludeId?: string) => {
    if (!sorted.length || !Number.isFinite(value)) return 0;

    let cnt = belowCount(value);

    if (excludeId && idToValue.has(excludeId)) {
      const ex = idToValue.get(excludeId);
      if (ex === undefined) return Math.max(0, cnt);
      if (tie === 'strict') {
        if (ex < value) cnt -= 1;
      } else {
        if (ex <= value) cnt -= 1;
      }
    }
    return Math.max(0, cnt);
  };

  /** effective pool size used when excluding self (for messaging) */
  const getPoolSize = (excludeId?: string) =>
    Math.max(0, sorted.length - (excludeId && idToValue.has(excludeId) ? 1 : 0));

  /** % below for a given entry id (self excluded automatically). returns 0 if not found */
  const getForId = (id?: string) => {
    if (!id || !idToValue.has(id)) return 0;
    const value = idToValue.get(id);
    return value === undefined ? 0 : getForValue(value, id);
  };

  /** count below for a given entry id (self excluded automatically). returns 0 if not found */
  const getCountForId = (id?: string) => {
    if (!id || !idToValue.has(id)) return 0;
    const value = idToValue.get(id);
    return value === undefined ? 0 : getCountForValue(value, id);
  };

  /** % below for a data object (self excluded if it has an id) */
  const getForItem = (item: TItem) => {
    const id = idOf(item);
    const v = accessor(item);
    return getForValue(v, id);
  };

  /** count below for a data object (self excluded if it has an id) */
  const getCountForItem = (item: TItem) => {
    const id = idOf(item);
    const v = accessor(item);
    return getCountForValue(v, id);
  };

  return {
    // percentile API
    getForId,
    getForItem,
    getForValue,
    // counts API
    getCountForId,
    getCountForItem,
    getCountForValue,
    getPoolSize,
  };
}
