export type LovableErrorMechanism =
  "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";

export type LovableErrorOptions = {
  mechanism?: LovableErrorMechanism;
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type LovableEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: LovableErrorOptions,
  ) => void;
};

declare global {
  interface Window {
    __lovableEvents?: LovableEvents;
  }
}

const SECRET_QUERY_PARAMETER =
  /([?&](?:access_token|refresh_token|token|code|key|secret)=)[^&#\s]+/gi;
const BEARER_TOKEN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function redactText(value: string) {
  return value
    .replace(SECRET_QUERY_PARAMETER, "$1[redacted]")
    .replace(BEARER_TOKEN, "Bearer [redacted]")
    .replace(EMAIL_ADDRESS, "[redacted-email]");
}

function sanitizeError(error: unknown) {
  if (error instanceof Error) {
    const sanitized = new Error(redactText(error.message));
    sanitized.name = error.name;
    if (error.stack) sanitized.stack = redactText(error.stack);
    return sanitized;
  }

  return new Error(redactText(typeof error === "string" ? error : "Unknown client error"));
}

function buildCommit() {
  return document
    .querySelector('meta[name="rawaj-build-commit"]')
    ?.getAttribute("content")
    ?.slice(0, 40);
}

export function reportLovableError(
  error: unknown,
  context: Record<string, unknown> = {},
  options: LovableErrorOptions = {},
) {
  if (typeof window === "undefined") return;

  const mechanism = options.mechanism ?? "manual";
  window.__lovableEvents?.captureException?.(
    sanitizeError(error),
    {
      source: mechanism,
      route: window.location.pathname,
      buildCommit: buildCommit() ?? "unknown",
      ...context,
    },
    {
      mechanism,
      handled: options.handled ?? mechanism === "manual",
      severity: options.severity ?? "error",
    },
  );
}
