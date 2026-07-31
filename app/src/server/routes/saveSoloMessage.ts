import type { Request, Response } from "express";
import { optionalEnv } from "../env";
import { verifyEditToken } from "../security/editToken";
import { type RateRule } from "../security/rateLimiter";
import { getClientAddress } from "../security/requestIdentity";
import { checkRateLimits } from "../cluster/clusterRateLimit";
import { LOAD_TEST_MODE } from "../load-testing/loadTestMode"; // load-testing
import { updateSurveyResponseSoloMessage } from "../upstreams/postgres/surveyResponseRepository";
import { sha256 } from "../utils/hash";
import { isRecord, readOptionalId, rejectDisallowedOrigin } from "./shared";

interface ValidPayload {
  editToken: string;
  message: string;
  clientId: string | null;
  clientRequestId: string | null;
}

const MAX_MESSAGE_LENGTH = 160;
const EDIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const TOP_LEVEL_KEYS = new Set([
  "editToken",
  "message",
  "clientId",
  "clientRequestId",
  "website",
]);

function readEditToken(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > 2000) return null;
  return EDIT_TOKEN_PATTERN.test(trimmed) ? trimmed : null;
}

function readMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length > MAX_MESSAGE_LENGTH) return null;
  return trimmed;
}

function validatePayload(value: unknown): { ok: true; payload: ValidPayload } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Invalid payload" };

  const unknownTopLevel = Object.keys(value).filter((key) => !TOP_LEVEL_KEYS.has(key));
  if (unknownTopLevel.length > 0) return { ok: false, error: "Unexpected payload fields" };

  if (typeof value.website === "string" && value.website.trim().length > 0) {
    return { ok: false, error: "Invalid payload" };
  }

  const editToken = readEditToken(value.editToken);
  if (!editToken) return { ok: false, error: "Invalid edit token" };

  const message = readMessage(value.message);
  if (message === null) return { ok: false, error: "Invalid message" };

  return {
    ok: true,
    payload: {
      editToken,
      message,
      clientId: readOptionalId(value.clientId),
      clientRequestId: readOptionalId(value.clientRequestId),
    },
  };
}

function buildRateRules(req: Request, payload: ValidPayload, responseId: string): RateRule[] {
  const salt = optionalEnv("RATE_LIMIT_SALT", "butterfly-effect-save-solo-message");
  const ipHash = sha256(`${salt}:ip:${getClientAddress(req)}`);
  const responseHash = sha256(`${salt}:response:${responseId}`);
  const rules: RateRule[] = [
    { key: `save-solo-message:ip:${ipHash}:10m`, max: 20, windowSeconds: 10 * 60 },
    { key: `save-solo-message:ip:${ipHash}:day`, max: 80, windowSeconds: 24 * 60 * 60 },
    { key: `save-solo-message:response:${responseHash}:10m`, max: 8, windowSeconds: 10 * 60 },
  ];

  if (payload.clientId) {
    const clientHash = sha256(`${salt}:client:${payload.clientId}`);
    rules.push({ key: `save-solo-message:client:${clientHash}:10m`, max: 10, windowSeconds: 10 * 60 });
  }

  if (payload.clientId && payload.clientRequestId) {
    const requestHash = sha256(`${salt}:request:${payload.clientId}:${payload.clientRequestId}`);
    rules.push({ key: `save-solo-message:request:${requestHash}`, max: 1, windowSeconds: 24 * 60 * 60 });
  }

  return rules;
}

export async function saveSoloMessageRoute(req: Request, res: Response) {
  if (rejectDisallowedOrigin(req, res)) return;

  const validation = validatePayload(req.body);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error, code: "INVALID_SOLO_MESSAGE" });
    return;
  }

  const verified = verifyEditToken(validation.payload.editToken);
  if (!verified) {
    res.status(403).json({ error: "Not allowed to edit this response", code: "EDIT_TOKEN_MISMATCH" });
    return;
  }

  // load-testing: skip abuse protection so a k6 run from one IP isn't self-limited.
  if (!LOAD_TEST_MODE) {
    const rateLimit = await checkRateLimits(buildRateRules(req, validation.payload, verified.responseId));
    if (!rateLimit.allowed) {
      res.status(429).json({
        error: "Too many message updates",
        code: "RATE_LIMITED",
        ...(rateLimit.resetAt ? { resetAt: rateLimit.resetAt } : {}),
      });
      return;
    }
  }

  try {
    const updated = await updateSurveyResponseSoloMessage(
      verified.responseId,
      validation.payload.message || null
    );

    if (!updated) {
      res.status(404).json({
        error: "Survey response not found",
        code: "SURVEY_RESPONSE_NOT_FOUND",
      });
      return;
    }

    res.status(200).json({
      _id: updated._id,
      ...(updated.soloMessage ? { soloMessage: updated.soloMessage } : {}),
    });
  } catch (error) {
    console.error("[save-solo-message] failed:", error);
    res.status(503).json({
      error: "Unable to save message",
      code: "DATABASE_WRITE_UNAVAILABLE",
    });
  }
}
