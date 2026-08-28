import { averageWeights } from "./average";

export interface WithWeights {
  _id?: string;
  weights?: Record<string, number>;
  avgWeight?: number;
}

export function avgWeightOf(item: WithWeights): number {
  if (typeof item.avgWeight === "number" && Number.isFinite(item.avgWeight)) {
    return item.avgWeight;
  }

  return averageWeights(Object.values(item.weights ?? {}));
}

export function toScore100(value: number, decimals = 0): number {
  const clamped = Math.max(0, Math.min(1, value));
  const raw = clamped * 100;
  const pow = Math.pow(10, decimals);
  return Math.round(raw * pow) / pow;
}
