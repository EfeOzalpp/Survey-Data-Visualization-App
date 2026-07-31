import type { QueryResultRow } from "pg";

import type { SurveyRow, SurveyWeights } from "../../../domain/survey/types";
import {
  SURVEY_RESPONSE_CHUNK_SIZE,
  type SurveyResponseCursor,
} from "./surveyResponseTypes";
import { postgresPool } from "./pool";

const SURVEY_RESPONSE_COLUMNS = `
  id,
  section,
  q1,
  q2,
  q3,
  q4,
  q5,
  avg_weight,
  solo_message,
  submitted_at
`;

export interface PostgresSurveyResponseRecord extends QueryResultRow {
  id: string;
  section: string;
  q1: string | number;
  q2: string | number;
  q3: string | number;
  q4: string | number;
  q5: string | number;
  avg_weight: string | number;
  solo_message: string | null;
  submitted_at: Date | string;
}

export interface CreateSurveyResponseInput {
  id: string;
  section: string;
  weights: Required<SurveyWeights>;
  avgWeight: number;
  submittedAt: string;
  idempotencyKeySha256: string | null;
}

function numericValue(value: string | number, field: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`PostgreSQL returned invalid ${field}`);
  }
  return parsed;
}

function timestampValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error("PostgreSQL returned an invalid submitted_at");
  }
  return date.toISOString();
}

export function postgresRecordToSurveyRow(
  record: PostgresSurveyResponseRecord
): SurveyRow {
  return {
    _id: record.id,
    section: record.section,
    q1: numericValue(record.q1, "q1"),
    q2: numericValue(record.q2, "q2"),
    q3: numericValue(record.q3, "q3"),
    q4: numericValue(record.q4, "q4"),
    q5: numericValue(record.q5, "q5"),
    avgWeight: numericValue(record.avg_weight, "avg_weight"),
    ...(record.solo_message ? { soloMessage: record.solo_message } : {}),
    submittedAt: timestampValue(record.submitted_at),
  };
}

export async function createSurveyResponse(
  input: CreateSurveyResponseInput
): Promise<{ row: SurveyRow; created: boolean }> {
  const inserted = await postgresPool.query<PostgresSurveyResponseRecord>(
    `INSERT INTO survey_responses (
       id,
       section,
       q1,
       q2,
       q3,
       q4,
       q5,
       avg_weight,
       submitted_at,
       idempotency_key_sha256
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (idempotency_key_sha256) DO NOTHING
     RETURNING ${SURVEY_RESPONSE_COLUMNS}`,
    [
      input.id,
      input.section,
      input.weights.q1,
      input.weights.q2,
      input.weights.q3,
      input.weights.q4,
      input.weights.q5,
      input.avgWeight,
      input.submittedAt,
      input.idempotencyKeySha256,
    ]
  );

  if (inserted.rows[0]) {
    return {
      row: postgresRecordToSurveyRow(inserted.rows[0]),
      created: true,
    };
  }

  if (!input.idempotencyKeySha256) {
    throw new Error("PostgreSQL did not create the survey response");
  }

  const existing = await postgresPool.query<PostgresSurveyResponseRecord>(
    `SELECT ${SURVEY_RESPONSE_COLUMNS}
     FROM survey_responses
     WHERE idempotency_key_sha256 = $1`,
    [input.idempotencyKeySha256]
  );

  if (!existing.rows[0]) {
    throw new Error(
      "PostgreSQL reported an idempotency conflict without an existing response"
    );
  }

  return {
    row: postgresRecordToSurveyRow(existing.rows[0]),
    created: false,
  };
}

export async function updateSurveyResponseSoloMessage(
  id: string,
  message: string | null
): Promise<SurveyRow | null> {
  const updated = await postgresPool.query<PostgresSurveyResponseRecord>(
    `UPDATE survey_responses
     SET
       solo_message = $2::varchar(160),
       solo_message_updated_at = CASE
         WHEN $2::varchar(160) IS NULL THEN NULL
         ELSE now()
       END,
       updated_at = now()
     WHERE id = $1
     RETURNING ${SURVEY_RESPONSE_COLUMNS}`,
    [id, message]
  );

  return updated.rows[0]
    ? postgresRecordToSurveyRow(updated.rows[0])
    : null;
}

export async function findSurveyResponseById(id: string) {
  const result = await postgresPool.query<PostgresSurveyResponseRecord>(
    `SELECT ${SURVEY_RESPONSE_COLUMNS}
     FROM survey_responses
     WHERE id = $1`,
    [id]
  );

  return result.rows[0]
    ? postgresRecordToSurveyRow(result.rows[0])
    : null;
}

export async function fetchSurveyResponsePage(
  cursor: SurveyResponseCursor | null,
  limit = SURVEY_RESPONSE_CHUNK_SIZE
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > SURVEY_RESPONSE_CHUNK_SIZE) {
    throw new Error(
      `Survey response page limit must be between 1 and ${String(SURVEY_RESPONSE_CHUNK_SIZE)}`
    );
  }

  const result = await postgresPool.query<PostgresSurveyResponseRecord>(
    `SELECT ${SURVEY_RESPONSE_COLUMNS}
     FROM survey_responses
     WHERE (
       $1::timestamptz IS NULL
       OR submitted_at < $1::timestamptz
       OR (submitted_at = $1::timestamptz AND id < $2)
     )
     ORDER BY submitted_at DESC, id DESC
     LIMIT $3`,
    [cursor?.time ?? null, cursor?.id ?? null, limit]
  );

  return result.rows.map(postgresRecordToSurveyRow);
}
