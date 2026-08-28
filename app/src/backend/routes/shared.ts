import type { Request, Response } from "express";
import { parseCsvEnv } from "../env";

export const allowedOrigins = parseCsvEnv("ALLOWED_ORIGINS");

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isAllowedOrigin(origin: string | undefined) {
  if (!origin || allowedOrigins.size === 0) return true;
  return allowedOrigins.has(origin);
}

export function rejectDisallowedOrigin(req: Request, res: Response) {
  if (isAllowedOrigin(req.header("origin"))) return false;
  res.status(403).json({ error: "Origin not allowed", code: "ORIGIN_NOT_ALLOWED" });
  return true;
}

export function readOptionalId(value: unknown) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]{8,96}$/.test(trimmed) ? trimmed : null;
}
