import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { spawn, execFile } from "node:child_process";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

import type { PoolClient, QueryResultRow } from "pg";

import { closePostgresPool, postgresPool } from "./pool";

const TARGET_DOCUMENT_TYPE = "userResponseV4";
const IMPORT_BATCH_SIZE = 250;
const IMPORT_LOCK_NAME = "butterfly-effect-sanity-survey-import";
const IMPORT_COLUMNS = [
  "id",
  "section",
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
  "avg_weight",
  "solo_message",
  "solo_message_updated_at",
  "submitted_at",
  "created_at",
  "updated_at",
  "source_system",
] as const;

interface SanityExportDocument {
  [key: string]: unknown;
  _type?: unknown;
}

export interface SurveyResponseImportRecord {
  id: string;
  section: string;
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  avgWeight: number;
  soloMessage: string | null;
  soloMessageUpdatedAt: string | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredImportRecord extends QueryResultRow {
  id: string;
  section: string;
  q1: string | number;
  q2: string | number;
  q3: string | number;
  q4: string | number;
  q5: string | number;
  avg_weight: string | number;
  solo_message: string | null;
  solo_message_updated_at: Date | string | null;
  submitted_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
  source_system: "postgres" | "sanity";
  idempotency_key_sha256: string | null;
}

export interface ImportSummary {
  selected: number;
  inserted: number;
  updated: number;
  unchanged: number;
  verified: number;
  digest: string;
  dryRun: boolean;
}

interface ParsedExport {
  records: SurveyResponseImportRecord[];
  documentCounts: Map<string, number>;
  ignoredDrafts: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(
  value: unknown,
  field: string,
  { maxLength }: { maxLength?: number } = {}
) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (maxLength && value.length > maxLength) {
    throw new Error(`${field} exceeds ${String(maxLength)} characters`);
  }
  return value;
}

function optionalMessage(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("soloMessage must be a string when present");
  }
  if (value.length > 160) {
    throw new Error("soloMessage exceeds 160 characters");
  }
  return value;
}

function weight(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  if (value < 0 || value > 1) {
    throw new Error(`${field} must be between 0 and 1`);
  }
  return Math.round(value * 1_000) / 1_000;
}

function timestamp(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new Error(`${field} must be an ISO timestamp`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new Error(`${field} must be an ISO timestamp`);
  }
  return parsed.toISOString();
}

function optionalTimestamp(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return timestamp(value, field);
}

export function parseSanitySurveyResponse(
  document: SanityExportDocument
): SurveyResponseImportRecord {
  if (document._type !== TARGET_DOCUMENT_TYPE) {
    throw new Error(`expected a ${TARGET_DOCUMENT_TYPE} document`);
  }

  const id = requiredString(document._id, "_id");
  const submittedAt = timestamp(
    document.submittedAt ?? document._createdAt,
    "submittedAt"
  );
  const createdAt = timestamp(
    document._createdAt ?? document.submittedAt,
    "_createdAt"
  );
  const updatedAt = timestamp(
    document._updatedAt ?? document._createdAt ?? document.submittedAt,
    "_updatedAt"
  );
  const soloMessage = optionalMessage(document.soloMessage);

  return {
    id,
    section: requiredString(document.section, "section", { maxLength: 80 }),
    q1: weight(document.q1, "q1"),
    q2: weight(document.q2, "q2"),
    q3: weight(document.q3, "q3"),
    q4: weight(document.q4, "q4"),
    q5: weight(document.q5, "q5"),
    avgWeight: weight(document.avgWeight, "avgWeight"),
    soloMessage,
    soloMessageUpdatedAt: soloMessage
      ? optionalTimestamp(
          document.soloMessageUpdatedAt ?? document._updatedAt,
          "soloMessageUpdatedAt"
        )
      : null,
    submittedAt,
    createdAt,
    updatedAt,
  };
}

function tarMembers(archivePath: string) {
  return new Promise<string[]>((resolveMembers, reject) => {
    execFile(
      "tar",
      ["-tzf", archivePath],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(
            new Error(`Unable to list ${archivePath}: ${error.message}`)
          );
          return;
        }
        resolveMembers(stdout.split(/\r?\n/).filter(Boolean));
      }
    );
  });
}

async function tarDataStream(archivePath: string) {
  const members = await tarMembers(archivePath);
  const dataMember = members.find(
    (member) => member === "data.ndjson" || member.endsWith("/data.ndjson")
  );
  if (!dataMember) {
    throw new Error(`${archivePath} does not contain data.ndjson`);
  }

  const child = spawn("tar", ["-xOzf", archivePath, dataMember], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const completed = new Promise<void>((resolveCompletion, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolveCompletion();
      } else {
        reject(
          new Error(
            `Unable to read data.ndjson from ${archivePath}: ${stderr.trim()}`
          )
        );
      }
    });
  });

  return { input: child.stdout, completed };
}

async function parseExport(inputPath: string): Promise<ParsedExport> {
  let input: Readable;
  let completed = Promise.resolve();

  if (inputPath === "-") {
    input = process.stdin;
  } else {
    const absolutePath = resolve(inputPath);
    await access(absolutePath);
    if (absolutePath.endsWith(".tar.gz") || absolutePath.endsWith(".tgz")) {
      const archive = await tarDataStream(absolutePath);
      input = archive.input;
      completed = archive.completed;
    } else {
      input = createReadStream(absolutePath, { encoding: "utf8" });
    }
  }

  const records: SurveyResponseImportRecord[] = [];
  const documentCounts = new Map<string, number>();
  const ids = new Set<string>();
  let ignoredDrafts = 0;
  let lineNumber = 0;
  const lines = createInterface({ input, crlfDelay: Infinity });

  try {
    for await (const line of lines) {
      lineNumber += 1;
      if (!line.trim()) continue;

      let document: SanityExportDocument;
      try {
        const parsed: unknown = JSON.parse(line);
        if (!isRecord(parsed)) {
          throw new Error("line is not a JSON object");
        }
        document = parsed;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "invalid JSON document";
        throw new Error(`Invalid Sanity export line ${lineNumber}: ${message}`);
      }

      const type =
        typeof document._type === "string" ? document._type : "(missing)";
      documentCounts.set(type, (documentCounts.get(type) ?? 0) + 1);
      if (type !== TARGET_DOCUMENT_TYPE) continue;

      if (
        typeof document._id === "string" &&
        document._id.startsWith("drafts.")
      ) {
        ignoredDrafts += 1;
        continue;
      }

      let record: SurveyResponseImportRecord;
      try {
        record = parseSanitySurveyResponse(document);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "invalid survey response";
        throw new Error(
          `Invalid ${TARGET_DOCUMENT_TYPE} at line ${lineNumber}: ${message}`
        );
      }

      if (ids.has(record.id)) {
        throw new Error(
          `Duplicate ${TARGET_DOCUMENT_TYPE} id ${record.id} at line ${lineNumber}`
        );
      }
      ids.add(record.id);
      records.push(record);
    }
    await completed;
  } finally {
    lines.close();
  }

  if (!records.length) {
    throw new Error(
      `The export contains no published ${TARGET_DOCUMENT_TYPE} documents`
    );
  }

  return { records, documentCounts, ignoredDrafts };
}

function databaseTimestamp(value: Date | string | null) {
  if (value === null) return null;
  return new Date(value).toISOString();
}

function storedRecord(record: StoredImportRecord): SurveyResponseImportRecord {
  return {
    id: record.id,
    section: record.section,
    q1: Number(record.q1),
    q2: Number(record.q2),
    q3: Number(record.q3),
    q4: Number(record.q4),
    q5: Number(record.q5),
    avgWeight: Number(record.avg_weight),
    soloMessage: record.solo_message,
    soloMessageUpdatedAt: databaseTimestamp(record.solo_message_updated_at),
    submittedAt: databaseTimestamp(record.submitted_at) as string,
    createdAt: databaseTimestamp(record.created_at) as string,
    updatedAt: databaseTimestamp(record.updated_at) as string,
  };
}

function canonicalRecord(record: SurveyResponseImportRecord) {
  return JSON.stringify(record);
}

function recordsDigest(records: SurveyResponseImportRecord[]) {
  const canonical = [...records]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(canonicalRecord)
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

async function selectImportedRecords(
  client: PoolClient,
  ids: string[]
): Promise<StoredImportRecord[]> {
  const result = await client.query<StoredImportRecord>(
    `SELECT
       ${IMPORT_COLUMNS.join(", ")},
       idempotency_key_sha256
     FROM survey_responses
     WHERE id = ANY($1::text[])`,
    [ids]
  );
  return result.rows;
}

function insertStatement(batchSize: number) {
  const fieldCount = IMPORT_COLUMNS.length;
  const values = Array.from({ length: batchSize }, (_, rowIndex) => {
    const offset = rowIndex * fieldCount;
    return `(${Array.from(
      { length: fieldCount },
      (_, fieldIndex) => `$${String(offset + fieldIndex + 1)}`
    ).join(", ")})`;
  }).join(",\n");

  return `
    INSERT INTO survey_responses (${IMPORT_COLUMNS.join(", ")})
    VALUES ${values}
    ON CONFLICT (id) DO UPDATE SET
      section = EXCLUDED.section,
      q1 = EXCLUDED.q1,
      q2 = EXCLUDED.q2,
      q3 = EXCLUDED.q3,
      q4 = EXCLUDED.q4,
      q5 = EXCLUDED.q5,
      avg_weight = EXCLUDED.avg_weight,
      solo_message = EXCLUDED.solo_message,
      solo_message_updated_at = EXCLUDED.solo_message_updated_at,
      submitted_at = EXCLUDED.submitted_at,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      source_system = EXCLUDED.source_system
    WHERE ROW(
      survey_responses.section,
      survey_responses.q1,
      survey_responses.q2,
      survey_responses.q3,
      survey_responses.q4,
      survey_responses.q5,
      survey_responses.avg_weight,
      survey_responses.solo_message,
      survey_responses.solo_message_updated_at,
      survey_responses.submitted_at,
      survey_responses.created_at,
      survey_responses.updated_at,
      survey_responses.source_system
    ) IS DISTINCT FROM ROW(
      EXCLUDED.section,
      EXCLUDED.q1,
      EXCLUDED.q2,
      EXCLUDED.q3,
      EXCLUDED.q4,
      EXCLUDED.q5,
      EXCLUDED.avg_weight,
      EXCLUDED.solo_message,
      EXCLUDED.solo_message_updated_at,
      EXCLUDED.submitted_at,
      EXCLUDED.created_at,
      EXCLUDED.updated_at,
      EXCLUDED.source_system
    )
  `;
}

function importValues(record: SurveyResponseImportRecord) {
  return [
    record.id,
    record.section,
    record.q1,
    record.q2,
    record.q3,
    record.q4,
    record.q5,
    record.avgWeight,
    record.soloMessage,
    record.soloMessageUpdatedAt,
    record.submittedAt,
    record.createdAt,
    record.updatedAt,
    "sanity",
  ];
}

export async function importSanitySurveyResponses(
  records: SurveyResponseImportRecord[],
  { dryRun = false }: { dryRun?: boolean } = {}
): Promise<ImportSummary> {
  if (!records.length) {
    throw new Error("No survey responses were supplied for import");
  }
  const ids = records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Survey response import contains duplicate ids");
  }
  const sourceById = new Map(records.map((record) => [record.id, record]));

  const client = await postgresPool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      IMPORT_LOCK_NAME,
    ]);
    await client.query("BEGIN");

    const beforeRows = await selectImportedRecords(client, ids);
    const beforeById = new Map(
      beforeRows.map((record) => [record.id, record])
    );
    for (const existing of beforeRows) {
      const source = sourceById.get(existing.id);
      const valuesMatch =
        source &&
        canonicalRecord(storedRecord(existing)) === canonicalRecord(source);
      if (
        existing.source_system === "postgres" &&
        (existing.idempotency_key_sha256 || !valuesMatch)
      ) {
        throw new Error(
          `Refusing to overwrite PostgreSQL-created response ${existing.id}`
        );
      }
    }

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    for (const record of records) {
      const existing = beforeById.get(record.id);
      if (!existing) {
        inserted += 1;
      } else if (
        existing.source_system === "sanity" &&
        canonicalRecord(storedRecord(existing)) === canonicalRecord(record)
      ) {
        unchanged += 1;
      } else {
        updated += 1;
      }
    }

    if (!dryRun) {
      for (let offset = 0; offset < records.length; offset += IMPORT_BATCH_SIZE) {
        const batch = records.slice(offset, offset + IMPORT_BATCH_SIZE);
        await client.query(
          insertStatement(batch.length),
          batch.flatMap(importValues)
        );
      }
    }

    const verifiedRows = dryRun
      ? beforeRows
      : await selectImportedRecords(client, ids);
    if (!dryRun) {
      const verifiedById = new Map(
        verifiedRows.map((record) => [record.id, record])
      );
      for (const source of records) {
        const storedRow = verifiedById.get(source.id);
        const stored = storedRow ? storedRecord(storedRow) : undefined;
        if (
          !stored ||
          storedRow?.source_system !== "sanity" ||
          canonicalRecord(stored) !== canonicalRecord(source)
        ) {
          throw new Error(
            `PostgreSQL verification failed for survey response ${source.id}`
          );
        }
      }
    }

    if (dryRun) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }

    return {
      selected: records.length,
      inserted,
      updated,
      unchanged,
      verified: dryRun ? 0 : verifiedRows.length,
      digest: recordsDigest(records),
      dryRun,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext($1))", [IMPORT_LOCK_NAME])
      .catch(() => undefined);
    client.release();
  }
}

function readArguments(args: string[]) {
  const dryRun = args.includes("--dry-run");
  const paths = args.filter((argument) => argument !== "--dry-run");
  if (paths.length !== 1) {
    throw new Error(
      "Usage: importSanitySurveyResponses <data.ndjson|export.tar.gz|-> [--dry-run]"
    );
  }
  return { inputPath: paths[0], dryRun };
}

async function runCli() {
  const { inputPath, dryRun } = readArguments(process.argv.slice(2));
  const parsed = await parseExport(inputPath);
  const summary = await importSanitySurveyResponses(parsed.records, {
    dryRun,
  });
  const counts = [...parsed.documentCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => `${type}=${String(count)}`)
    .join(", ");

  console.log(`[postgres:import] export documents: ${counts}`);
  if (parsed.ignoredDrafts) {
    console.log(
      `[postgres:import] ignored ${String(parsed.ignoredDrafts)} draft survey responses`
    );
  }
  console.log(
    `[postgres:import] ${summary.dryRun ? "dry run" : "committed"}: ` +
      `${String(summary.selected)} selected, ` +
      `${String(summary.inserted)} inserts, ` +
      `${String(summary.updated)} updates, ` +
      `${String(summary.unchanged)} unchanged, ` +
      `${String(summary.verified)} verified`
  );
  console.log(`[postgres:import] source digest: ${summary.digest}`);
}

if (require.main === module) {
  void runCli()
    .catch((error: unknown) => {
      console.error("[postgres:import] failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closePostgresPool();
    });
}
