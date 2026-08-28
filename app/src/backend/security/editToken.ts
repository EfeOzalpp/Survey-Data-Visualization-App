import jwt from "jsonwebtoken";
import { getRequiredEnv } from "../env";

const JWT_SECRET = getRequiredEnv("JWT_SECRET");

export function signEditToken(responseId: string): string {
  return jwt.sign({ responseId }, JWT_SECRET);
}

export function verifyEditToken(token: string): { responseId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "object" && typeof decoded.responseId === "string") {
      return { responseId: decoded.responseId };
    }
    return null;
  } catch {
    return null;
  }
}
