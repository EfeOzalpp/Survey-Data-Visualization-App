import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { PoolClient } from "pg";

import { closePostgresPool, postgresPool } from "./pool";

const MIGRATION_NAME_PATTERN = /^\d{3}_[a-z0-9_]+\.sql$/;
const MIGRATION_LOCK_NAME = "butterfly-effect-schema-migrations";

interface AppliedMigration {
  checksum: string;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function ensureMigrationTable(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function applyMigration(
  client: PoolClient,
  name: string,
  sql: string
) {
  const checksum = sha256(sql);
  const existing = await client.query<AppliedMigration>(
    `SELECT checksum
     FROM schema_migrations
     WHERE name = $1`,
    [name]
  );

  if (existing.rowCount) {
    if (existing.rows[0].checksum !== checksum) {
      throw new Error(
        `Applied migration ${name} no longer matches its recorded checksum`
      );
    }
    console.log(`[postgres:migrate] already applied ${name}`);
    return;
  }

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO schema_migrations (name, checksum)
       VALUES ($1, $2)`,
      [name, checksum]
    );
    await client.query("COMMIT");
    console.log(`[postgres:migrate] applied ${name}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function runPostgresMigrations() {
  const migrationsDirectory = join(process.cwd(), "db", "migrations");
  const names = (await readdir(migrationsDirectory))
    .filter((name) => MIGRATION_NAME_PATTERN.test(name))
    .sort();

  if (!names.length) {
    throw new Error(`No PostgreSQL migrations found in ${migrationsDirectory}`);
  }

  const client = await postgresPool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      MIGRATION_LOCK_NAME,
    ]);
    await ensureMigrationTable(client);

    for (const name of names) {
      const sql = await readFile(join(migrationsDirectory, name), "utf8");
      await applyMigration(client, name, sql);
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext($1))", [MIGRATION_LOCK_NAME])
      .catch(() => undefined);
    client.release();
  }
}

if (require.main === module) {
  void runPostgresMigrations()
    .catch((error: unknown) => {
      console.error("[postgres:migrate] failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePostgresPool();
    });
}
