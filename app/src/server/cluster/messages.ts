import type { RateResult, RateRule } from "../security/rateLimiter";
import type { readSanityRequestStats } from "../load-testing/requestStats";
import type { readSseConnectionStats } from "../load-testing/sseConnectionStats";

export type SanityStats = ReturnType<typeof readSanityRequestStats>;
export type SseStats = ReturnType<typeof readSseConnectionStats>;

interface LoadReportMessage {
  type: "load-report";
  current: number;
}

export interface RateLimitCheckMessage {
  type: "rate-limit-check";
  requestId: string;
  rules: readonly RateRule[];
}

export interface StatsRequestMessage {
  type: "stats-request";
  requestId: string;
  reset?: boolean;
}

export interface StatsQueryResultMessage {
  type: "stats-query-result";
  requestId: string;
  sanity: SanityStats;
  sse: SseStats;
}

export type WorkerToPrimaryMessage =
  | LoadReportMessage
  | RateLimitCheckMessage
  | StatsRequestMessage
  | StatsQueryResultMessage;

export interface RateLimitResultMessage {
  type: "rate-limit-result";
  requestId: string;
  result: RateResult;
}

export interface StatsQueryMessage {
  type: "stats-query";
  requestId: string;
  reset?: boolean;
}

export interface StatsResultMessage {
  type: "stats-result";
  requestId: string;
  sanity: SanityStats;
  sse: SseStats;
}

export type PrimaryToWorkerMessage = RateLimitResultMessage | StatsQueryMessage | StatsResultMessage;
