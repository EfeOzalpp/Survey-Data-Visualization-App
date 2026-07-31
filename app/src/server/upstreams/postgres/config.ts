import { getRequiredEnv, optionalEnv } from "../../env";

function integerEnv(
  name: string,
  fallback: number,
  { min, max }: { min: number; max: number }
) {
  const raw = optionalEnv(name, String(fallback));
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `${name} must be an integer between ${String(min)} and ${String(max)}`
    );
  }

  return parsed;
}

export const POSTGRES_CONFIG = {
  connectionString: getRequiredEnv("DATABASE_URL"),
  max: integerEnv("POSTGRES_POOL_MAX", 10, { min: 1, max: 50 }),
  connectionTimeoutMillis: integerEnv(
    "POSTGRES_CONNECTION_TIMEOUT_MS",
    5_000,
    { min: 100, max: 60_000 }
  ),
  idleTimeoutMillis: integerEnv("POSTGRES_IDLE_TIMEOUT_MS", 30_000, {
    min: 1_000,
    max: 600_000,
  }),
} as const;
