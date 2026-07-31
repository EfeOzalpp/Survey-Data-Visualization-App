import { Pool } from "pg";

import { POSTGRES_CONFIG } from "./config";

export const postgresPool = new Pool({
  ...POSTGRES_CONFIG,
  application_name: "butterfly-effect-server",
});

postgresPool.on("error", (error) => {
  console.error("[postgres] idle pool client failed:", error);
});

export async function verifyPostgresConnection() {
  await postgresPool.query("SELECT 1");
}

export async function closePostgresPool() {
  await postgresPool.end();
}
