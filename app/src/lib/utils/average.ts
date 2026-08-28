// Shared "average of finite weights, ignoring gaps" primitive. Every current
// caller falls back to the same neutral midpoint (0.5) when there's nothing
// finite to average, so that fallback lives here instead of being repeated
// at each call site.
export function averageWeights(values: (number | null | undefined)[]): number {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!finite.length) return 0.5;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}
