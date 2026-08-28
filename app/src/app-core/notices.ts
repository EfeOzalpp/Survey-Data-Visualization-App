const DUPLICATE_SURVEY_NOTICE_EVENT = "be:duplicate-survey-notice";
const RATE_LIMIT_NOTICE_EVENT = "be:rate-limit-notice";

export interface RateLimitNoticeDetail {
  message?: string;
  resetAt?: string;
}

export function showDuplicateSurveyNotice() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DUPLICATE_SURVEY_NOTICE_EVENT));
}

export function listenForDuplicateSurveyNotice(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(DUPLICATE_SURVEY_NOTICE_EVENT, callback);
  return () => {
    window.removeEventListener(DUPLICATE_SURVEY_NOTICE_EVENT, callback);
  };
}

export function showRateLimitNotice(detail: RateLimitNoticeDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<RateLimitNoticeDetail>(RATE_LIMIT_NOTICE_EVENT, {
    detail,
  }));
}

function normalizeRateLimitNoticeDetail(detail: unknown): RateLimitNoticeDetail {
  if (!detail || typeof detail !== "object") return {};

  const maybeDetail = detail as { message?: unknown; resetAt?: unknown };
  return {
    message: typeof maybeDetail.message === "string" ? maybeDetail.message : undefined,
    resetAt: typeof maybeDetail.resetAt === "string" ? maybeDetail.resetAt : undefined,
  };
}

export function listenForRateLimitNotice(callback: (detail: RateLimitNoticeDetail) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onNotice = (event: Event) => {
    const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
    callback(normalizeRateLimitNoticeDetail(detail));
  };

  window.addEventListener(RATE_LIMIT_NOTICE_EVENT, onNotice);
  return () => {
    window.removeEventListener(RATE_LIMIT_NOTICE_EVENT, onNotice);
  };
}
