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

function isHydrationWarning(args: unknown[]) {
  const message = args
    .slice(0, 2)
    .map((value) => (typeof value === "string" ? value : value instanceof Error ? value.message : ""))
    .join(" ")
    .toLowerCase();

  return (
    message.includes("hydration failed") ||
    message.includes("hydrated but some attributes") ||
    message.includes("did not match the client") ||
    message.includes("does not match what was rendered on the server")
  );
}

export function installClientErrorMonitoring() {
  if (typeof window === "undefined") return () => undefined;

  let hydrationWarningReported = false;
  const originalConsoleError = console.error;

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

  const monitoredConsoleError = (...args: unknown[]) => {
    originalConsoleError(...args);
    if (hydrationWarningReported || !isHydrationWarning(args)) return;
    hydrationWarningReported = true;
    reportLovableError(
      new Error("React hydration mismatch detected"),
      {
        boundary: "react_hydration_warning",
        pathname: window.location.pathname,
      },
      {
        mechanism: "console_error_classification",
        handled: true,
      },
    );
  };

  console.error = monitoredConsoleError;
  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleUnhandledRejection);

  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    if (console.error === monitoredConsoleError) console.error = originalConsoleError;
  };
}
