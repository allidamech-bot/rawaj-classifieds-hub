import { reportLovableError } from "@/lib/lovable-error-reporting";

function safeFilename(value: string) {
  if (!value) return "unknown";
  try {
    const url = new URL(value, window.location.origin);
    return `${url.origin === window.location.origin ? "same-origin" : url.origin}${url.pathname}`;
  } catch {
    return "unknown";
  }
}

export function installClientErrorMonitoring() {
  if (typeof window === "undefined") return () => undefined;

  const handleError = (event: ErrorEvent) => {
    reportLovableError(
      event.error ?? new Error(event.message || "Window error"),
      {
        boundary: "window_error",
        filename: safeFilename(event.filename),
        line: event.lineno,
        column: event.colno,
      },
      {
        mechanism: "onerror",
        handled: false,
      },
    );
  };

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportLovableError(
      event.reason,
      {
        boundary: "unhandled_promise_rejection",
      },
      {
        mechanism: "unhandledrejection",
        handled: false,
      },
    );
  };

  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  };
}
