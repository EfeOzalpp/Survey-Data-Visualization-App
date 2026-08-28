import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { BUTTON_QUESTIONS } from "../../onboarding/questionnaire/questions-lookup";
import { STAFF_IDS, STUDENT_IDS } from "../../domain/survey/sections";
import { optionalEnv } from "../env";
import { signEditToken } from "../security/editToken";
import { type RateRule } from "../security/rateLimiter";
import { getClientAddress } from "../security/requestIdentity";
import { checkRateLimits } from "../cluster/clusterRateLimit";
import { LOAD_TEST_MODE } from "../load-testing/loadTestMode"; // load-testing
import { createSurveyResponse } from "../upstreams/postgres/surveyResponseRepository";
import { sha256 } from "../utils/hash";
import { isRecord, readOptionalId, rejectDisallowedOrigin } from "./shared";

type QuestionKey = "q1" | "q2" | "q3" | "q4" | "q5";
type Weights = Record<QuestionKey, number>;

interface ValidPayload {
  section: string;
  weights: Weights;
  clientId: string | null;
  clientRequestId: string | null;
}

const QUESTION_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;
const TOP_LEVEL_KEYS = new Set([
  "section",
  "weights",
  "clientId",
  "clientRequestId",
  "website",
  "startedAt",
]);
const ALLOWED_SECTIONS = new Set<string>(["visitor", ...STUDENT_IDS, ...STAFF_IDS]);

function weightsForQuestion(id: QuestionKey) {
  return BUTTON_QUESTIONS.find((question) => question.id === id)?.options.map((option) => option.weight) ?? [];
}

const QUESTION_WEIGHTS: Record<QuestionKey, readonly number[]> = {
  q1: weightsForQuestion("q1"),
  q2: weightsForQuestion("q2"),
  q3: weightsForQuestion("q3"),
  q4: weightsForQuestion("q4"),
  q5: weightsForQuestion("q5"),
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const answerKey = (value: number) => round3(value).toFixed(3);

function buildAllowedAnswerSet(values: readonly number[]) {
  const allowed = new Set<string>();
  const maxMask = 1 << values.length;

  for (let mask = 1; mask < maxMask; mask += 1) {
    let sum = 0;
    let count = 0;

    for (let i = 0; i < values.length; i += 1) {
      if ((mask & (1 << i)) === 0) continue;
      sum += values[i];
      count += 1;
    }

    allowed.add(answerKey(sum / count));
  }

  return allowed;
}

const VALID_ANSWERS = Object.fromEntries(
  QUESTION_KEYS.map((key) => [key, buildAllowedAnswerSet(QUESTION_WEIGHTS[key])])
) as Record<QuestionKey, Set<string>>;

function validatePayload(value: unknown): { ok: true; payload: ValidPayload } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Invalid payload" };

  const unknownTopLevel = Object.keys(value).filter((key) => !TOP_LEVEL_KEYS.has(key));
  if (unknownTopLevel.length > 0) return { ok: false, error: "Unexpected payload fields" };

  if (typeof value.website === "string" && value.website.trim().length > 0) {
    return { ok: false, error: "Invalid payload" };
  }

  const section = typeof value.section === "string" ? value.section.trim() : "";
  if (!ALLOWED_SECTIONS.has(section)) return { ok: false, error: "Invalid section" };

  if (!isRecord(value.weights)) return { ok: false, error: "Invalid weights" };

  const unknownWeightKeys = Object.keys(value.weights).filter((key) =>
    !QUESTION_KEYS.includes(key as QuestionKey)
  );
  if (unknownWeightKeys.length > 0) return { ok: false, error: "Unexpected weight fields" };

  const weights = {} as Weights;
  for (const key of QUESTION_KEYS) {
    const raw = value.weights[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return { ok: false, error: `Invalid ${key}` };
    }

    const rounded = round3(raw);
    if (rounded < 0 || rounded > 1 || !VALID_ANSWERS[key].has(answerKey(rounded))) {
      return { ok: false, error: `Invalid ${key}` };
    }

    weights[key] = rounded;
  }

  return {
    ok: true,
    payload: {
      section,
      weights,
      clientId: readOptionalId(value.clientId),
      clientRequestId: readOptionalId(value.clientRequestId),
    },
  };
}

function buildRateRules(req: Request, payload: ValidPayload): RateRule[] {
  const salt = optionalEnv("RATE_LIMIT_SALT", "butterfly-effect-save-user-response");
  const ipHash = sha256(`${salt}:ip:${getClientAddress(req)}`);
  const rules: RateRule[] = [
    { key: `save-user-response:ip:${ipHash}:10m`, max: 25, windowSeconds: 10 * 60 },
    { key: `save-user-response:ip:${ipHash}:day`, max: 200, windowSeconds: 24 * 60 * 60 },
  ];

  if (payload.clientId) {
    const clientHash = sha256(`${salt}:client:${payload.clientId}`);
    rules.push(
      { key: `save-user-response:client:${clientHash}:1m`, max: 5, windowSeconds: 60 },
      { key: `save-user-response:client:${clientHash}:day`, max: 50, windowSeconds: 24 * 60 * 60 },
    );
  }

  if (payload.clientId && payload.clientRequestId) {
    const requestHash = sha256(`${salt}:request:${payload.clientId}:${payload.clientRequestId}`);
    rules.push({ key: `save-user-response:request:${requestHash}`, max: 1, windowSeconds: 24 * 60 * 60 });
  }

  return rules;
}

function avgWeight(weights: Weights) {
  const sum = QUESTION_KEYS.reduce((acc, key) => acc + weights[key], 0);
  return round3(sum / QUESTION_KEYS.length);
}

function idempotencyKey(payload: ValidPayload) {
  if (!payload.clientId || !payload.clientRequestId) return null;
  const salt = optionalEnv(
    "IDEMPOTENCY_SALT",
    optionalEnv("RATE_LIMIT_SALT", "butterfly-effect-survey-idempotency")
  );
  return sha256(
    `${salt}:survey-response:${payload.clientId}:${payload.clientRequestId}`
  );
}

export async function saveUserResponseRoute(req: Request, res: Response) {
  if (rejectDisallowedOrigin(req, res)) return;

  const validation = validatePayload(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error, code: "INVALID_SURVEY_RESPONSE" });
    return;
  }

  // load-testing: skip abuse protection so a k6 run from one IP isn't self-limited.
  if (!LOAD_TEST_MODE) {
    const rateLimit = await checkRateLimits(buildRateRules(req, validation.payload));
    if (!rateLimit.allowed) {
      res.status(429).json({
        error: "Too many submissions",
        code: "RATE_LIMITED",
        ...(rateLimit.resetAt ? { resetAt: rateLimit.resetAt } : {}),
      });
      return;
    }
  }

  const submittedAt = new Date().toISOString();
  const average = avgWeight(validation.payload.weights);

  try {
    const saved = await createSurveyResponse({
      id: randomUUID(),
      section: validation.payload.section,
      weights: validation.payload.weights,
      avgWeight: average,
      submittedAt,
      idempotencyKeySha256: idempotencyKey(validation.payload),
    });

    res.status(200).json({
      ...saved.row,
      editToken: signEditToken(saved.row._id),
    });
  } catch (error) {
    console.error("[save-user-response] PostgreSQL write failed:", error);
    res.status(503).json({
      error: "Unable to save response",
      code: "DATABASE_WRITE_UNAVAILABLE",
    });
  }
}
