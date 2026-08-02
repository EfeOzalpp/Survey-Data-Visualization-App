import type { Request, Response } from "express";

import { optionalEnv } from "../env";
import { consumeRateLimits, type RateRule } from "../security/rateLimiter";
import { getClientAddress } from "../security/requestIdentity";
import { sanityReadClient } from "../upstreams/sanity/readClient";
import { sha256 } from "../utils/hash";
import { rejectDisallowedOrigin } from "./shared";

interface SanityMediaRow {
  _updatedAt?: string;
  slideKey?: string;
  lightVideoUrl?: string;
  lightAlt?: string;
  darkVideoUrl?: string;
  darkAlt?: string;
}

interface InfoMediaRow {
  slideKey: string;
  lightVideoUrl: string;
  lightAlt: string;
  darkVideoUrl: string;
  darkAlt: string;
}

interface MediaPayload {
  media: InfoMediaRow[];
  revision: string;
}

let cache: { expiresAtMs: number; payload: MediaPayload } | null = null;

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMedia(rows: SanityMediaRow[]) {
  const bySlideKey = new Map<string, InfoMediaRow>();

  for (const row of rows) {
    const slideKey = readText(row.slideKey);
    const lightVideoUrl = readText(row.lightVideoUrl);
    const lightAlt = readText(row.lightAlt);
    const darkVideoUrl = readText(row.darkVideoUrl);
    const darkAlt = readText(row.darkAlt);

    if (!slideKey || !lightVideoUrl || !lightAlt || !darkVideoUrl || !darkAlt) continue;

    // Rows are ordered oldest-first, so a duplicate slideKey lets the most
    // recently created row win.
    bySlideKey.set(slideKey, { slideKey, lightVideoUrl, lightAlt, darkVideoUrl, darkAlt });
  }

  return [...bySlideKey.values()];
}

async function readInfoMedia() {
  if (cache && cache.expiresAtMs > Date.now()) {
    return { payload: cache.payload, cached: true };
  }

  const rows = await sanityReadClient.fetch<SanityMediaRow[]>(`
*[
  !(_id in path('drafts.**')) &&
  _type == 'infoMedia' &&
  enabled == true
] | order(_createdAt asc){
  _updatedAt,
  slideKey,
  "lightVideoUrl": lightVideo.asset->url,
  lightAlt,
  "darkVideoUrl": darkVideo.asset->url,
  darkAlt
}
`);

  const revision = rows.reduce((latest, row) => {
    return row._updatedAt && row._updatedAt > latest ? row._updatedAt : latest;
  }, "none");

  const payload = { media: normalizeMedia(rows), revision };
  cache = { payload, expiresAtMs: Date.now() + 60_000 };
  return { payload, cached: false };
}

function buildRateRules(req: Request): RateRule[] {
  const salt = optionalEnv("RATE_LIMIT_SALT", "butterfly-effect-info-media");
  const ipHash = sha256(`${salt}:ip:${getClientAddress(req)}`);
  return [
    { key: `info-media:ip:${ipHash}:1m`, max: 120, windowSeconds: 60 },
    { key: `info-media:ip:${ipHash}:10m`, max: 600, windowSeconds: 10 * 60 },
  ];
}

export async function infoMediaRoute(req: Request, res: Response) {
  if (rejectDisallowedOrigin(req, res)) return;

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
    const { payload, cached } = await readInfoMedia();
    res.status(200).json({ ...payload, cached });
  } catch (error) {
    console.error("[info-media] Sanity read failed:", error);
    res.status(503).json({
      error: "Unable to read info media",
      code: "SANITY_READ_UNAVAILABLE",
    });
  }
}
