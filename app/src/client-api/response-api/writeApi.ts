interface ApiErrorBody {
  error?: string;
  code?: string;
  resetAt?: string;
}

export class WriteApiError extends Error {
  readonly code?: string;
  readonly endpoint: string;
  readonly resetAt?: string;
  readonly status: number;

  constructor(endpoint: string, message: string, status: number, code?: string, resetAt?: string) {
    super(message);
    this.name = "WriteApiError";
    this.endpoint = endpoint;
    this.status = status;
    this.code = code;
    this.resetAt = resetAt;
  }
}

export function makeRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const EDIT_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function isWriteApiEditToken(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length <= 2000 && EDIT_TOKEN_PATTERN.test(value.trim());
}

export function getClientId(): string {
  if (typeof window === "undefined") return makeRandomId();

  const key = "be.clientId";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;

    const next = makeRandomId();
    window.localStorage.setItem(key, next);
    return next;
  } catch {
    return makeRandomId();
  }
}

function readApiErrorBody(value: unknown): ApiErrorBody {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    error: typeof record.error === "string" ? record.error : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
    resetAt: typeof record.resetAt === "string" ? record.resetAt : undefined,
  };
}

export function makeWriteApiError(
  endpoint: string,
  status: number,
  body: unknown,
  fallbackMessage: string
) {
  const apiError = readApiErrorBody(body);
  return new WriteApiError(
    endpoint,
    apiError.error ?? fallbackMessage,
    status,
    apiError.code,
    apiError.resetAt
  );
}
