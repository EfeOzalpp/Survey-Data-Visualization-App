import type { Request, Response } from "express";

import { optionalEnv } from "../env";
import { consumeRateLimits, type RateRule } from "../security/rateLimiter";
import { getClientAddress } from "../security/requestIdentity";
import { sanityReadClient } from "../upstreams/sanity/readClient";
import { sha256 } from "../utils/hash";
import { rejectDisallowedOrigin } from "./shared";

interface CopyDoc {
  _id: string;
  _updatedAt: string;
  range?: { minPct: number; maxPct: number };
  titles?: string[];
  secondary?: string[];
  enabled?: boolean;
}

type CopyType = "general" | "personalized";
type CopyGroups = Record<CopyType, CopyDoc[]>;

interface SanityCopyDoc extends CopyDoc {
  _type: string;
}

const SCHEMA_BY_TYPE: Record<CopyType, string> = {
  general: "gamificationGeneralCopy",
  personalized: "gamificationPersonalizedCopy",
};

const TYPE_BY_SCHEMA: Record<string, CopyType | undefined> = Object.fromEntries(
  Object.entries(SCHEMA_BY_TYPE).map(([type, schema]) => [schema, type as CopyType])
);

let cache: { expiresAtMs: number; groups: CopyGroups } | null = null;

function emptyGroups(): CopyGroups {
  return {
    general: [],
    personalized: [],
  };
}

function copyDocFromSanity(row: SanityCopyDoc): CopyDoc {
  return {
    _id: row._id,
    _updatedAt: row._updatedAt,
    range: row.range,
    titles: row.titles,
    secondary: row.secondary,
    enabled: row.enabled,
  };
}

function groupCopyDocs(rows: SanityCopyDoc[]): CopyGroups {
  return rows.reduce<CopyGroups>((groups, row) => {
    const type = TYPE_BY_SCHEMA[row._type];
    if (!type) return groups;
    groups[type].push(copyDocFromSanity(row));
    return groups;
  }, emptyGroups());
}

function buildQuery() {
  return `
*[
  !(_id in path('drafts.**')) &&
  _type in $schemaNames &&
  enabled == true
]{
  _id, _type, _updatedAt, range, titles, secondary
}
`;
}

async function fetchCopyGroups() {
  const docs = await sanityReadClient.fetch<SanityCopyDoc[]>(
    buildQuery(),
    { schemaNames: Object.values(SCHEMA_BY_TYPE) }
  );
  const groups = groupCopyDocs(docs);
  cache = { groups, expiresAtMs: Date.now() + 60_000 };
  return { groups, cached: false };
}

async function readCopyGroups() {
  if (cache && cache.expiresAtMs > Date.now()) {
    return { groups: cache.groups, cached: true };
  }
  return fetchCopyGroups();
}

function buildRateRules(req: Request): RateRule[] {
  const salt = optionalEnv("RATE_LIMIT_SALT", "butterfly-effect-gamification-read");
  const ipHash = sha256(`${salt}:ip:${getClientAddress(req)}`);
  return [
    { key: `gamification-read:ip:${ipHash}:1m`, max: 120, windowSeconds: 60 },
    { key: `gamification-read:ip:${ipHash}:10m`, max: 600, windowSeconds: 10 * 60 },
  ];
}

export async function gamificationCopyRoute(req: Request, res: Response) {
  if (rejectDisallowedOrigin(req, res)) return;

  if (req.query.type !== undefined) {
    res.status(400).json({
      error: "Typed gamification copy reads are no longer supported",
      code: "INVALID_COPY_QUERY",
    });
    return;
  }

  const rateLimit = consumeRateLimits(buildRateRules(req));
  if (!rateLimit.allowed) {
    res.status(429).json({
      error: "Too many read requests",
      code: "RATE_LIMITED",
      ...(rateLimit.resetAt ? { resetAt: rateLimit.resetAt } : {}),
    });
    return;
  }

  try {
    const { groups, cached } = await readCopyGroups();
    res.status(200).json({
      docs: groups,
      cached,
    });
  } catch (error) {
    console.error("[gamification-copy] Sanity read failed:", error);
    res.status(503).json({
      error: "Unable to read gamification copy",
      code: "SANITY_READ_UNAVAILABLE",
    });
  }
}
