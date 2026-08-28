import type { Request } from "express";

export function getClientAddress(req: Request) {
  const forwardedFor = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  // Explicit truthiness checks (not ??) so an empty-string address is treated
  // as absent and falls through to the next candidate, same as before.
  if (forwardedFor) return forwardedFor;
  if (req.ip) return req.ip;
  if (req.socket.remoteAddress) return req.socket.remoteAddress;
  return "unknown";
}
