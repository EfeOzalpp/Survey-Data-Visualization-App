import type { Request, Response } from "express";

import { optionalEnv } from "../env";
import { consumeRateLimits, type RateRule } from "../security/rateLimiter";
import { getClientAddress } from "../security/requestIdentity";
import { sanityReadClient } from "../upstreams/sanity/readClient";
import { sha256 } from "../utils/hash";
import { rejectDisallowedOrigin } from "./shared";

const PRODUCT_TOUR_KEYS = new Set([
  "shape-scenery",
  "five-questions",
  "receive-shape",
  "join-collective",
  "shared-patterns",
  "live-changes",
]);

interface SanityMediaRow {
  slideKey?: string;
  lightGifUrl?: string;
  darkGifUrl?: string;
  alt?: string;
}

interface SanityMediaDocument {
  _updatedAt?: string;
  slides?: SanityMediaRow[];
}

interface ProductTourMediaRow {
  slideKey: string;
  lightGifUrl: string;
  darkGifUrl: string;
  alt: string;
}

interface MediaPayload {
  media: ProductTourMediaRow[];
  revision: string;
}

let cache: { expiresAtMs: number; payload: MediaPayload } | null = null;

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMedia(rows: SanityMediaRow[] | undefined) {
  const seen = new Set<string>();
  const media: ProductTourMediaRow[] = [];

  for (const row of rows ?? []) {
    const slideKey = readText(row.slideKey);
    const lightGifUrl = readText(row.lightGifUrl);
    const darkGifUrl = readText(row.darkGifUrl);
    const alt = readText(row.alt);

    if (!slideKey || !PRODUCT_TOUR_KEYS.has(slideKey) || seen.has(slideKey)) continue;
    if (!lightGifUrl || !darkGifUrl || !alt) continue;

    seen.add(slideKey);
    media.push({ slideKey, lightGifUrl, darkGifUrl, alt });
  }

  return media;
}

async function readProductTourMedia() {
  if (cache && cache.expiresAtMs > Date.now()) {
    return { payload: cache.payload, cached: true };
  }

  const document = await sanityReadClient.fetch<SanityMediaDocument | null>(`
*[
  !(_id in path('drafts.**')) &&
  _type == 'productTourMedia' &&
  enabled == true
] | order(_updatedAt desc)[0]{
  _updatedAt,
  "slides": slides[]{
    slideKey,
    alt,
    "lightGifUrl": lightGif.asset->url,
    "darkGifUrl": darkGif.asset->url
  }
}
`);

  const payload = {
    media: normalizeMedia(document?.slides),
    revision: document?._updatedAt ?? "none",
  };
  cache = { payload, expiresAtMs: Date.now() + 60_000 };
  return { payload, cached: false };
}

function buildRateRules(req: Request): RateRule[] {
  const salt = optionalEnv("RATE_LIMIT_SALT", "butterfly-effect-product-tour-media");
  const ipHash = sha256(`${salt}:ip:${getClientAddress(req)}`);
  return [
    { key: `product-tour-media:ip:${ipHash}:1m`, max: 120, windowSeconds: 60 },
    { key: `product-tour-media:ip:${ipHash}:10m`, max: 600, windowSeconds: 10 * 60 },
  ];
}

export async function productTourMediaRoute(req: Request, res: Response) {
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
    const { payload, cached } = await readProductTourMedia();
    res.status(200).json({ ...payload, cached });
  } catch (error) {
    console.error("[product-tour-media] Sanity read failed:", error);
    res.status(503).json({
      error: "Unable to read product tour media",
      code: "SANITY_READ_UNAVAILABLE",
    });
  }
}
