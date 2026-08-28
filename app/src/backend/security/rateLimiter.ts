export interface RateRule {
  key: string;
  max: number;
  windowSeconds: number;
}

export interface RateResult {
  allowed: boolean;
  resetAt?: string;
}

const buckets = new Map<string, { count: number; resetAtMs: number }>();

export function consumeRateLimit(rule: RateRule): RateResult {
  const now = Date.now();
  const existing = buckets.get(rule.key);

  if (!existing || existing.resetAtMs <= now) {
    const resetAtMs = now + rule.windowSeconds * 1000;
    buckets.set(rule.key, { count: 1, resetAtMs });
    return { allowed: true, resetAt: new Date(resetAtMs).toISOString() };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= rule.max,
    resetAt: new Date(existing.resetAtMs).toISOString(),
  };
}

export function consumeRateLimits(rules: readonly RateRule[]): RateResult {
  for (const rule of rules) {
    const result = consumeRateLimit(rule);
    if (!result.allowed) return result;
  }

  return { allowed: true };
}
