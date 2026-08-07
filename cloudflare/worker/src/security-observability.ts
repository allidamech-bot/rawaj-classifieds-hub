export type SecuritySeverity = "info" | "warning" | "critical";

export type SecurityEvent = {
  event: string;
  severity: SecuritySeverity;
  requestId: string;
  method?: string;
  pathname?: string;
  status?: number;
  reason?: string;
  action?: string;
  limitClass?: string;
};

const MAX_FIELD_LENGTH = 180;

export function logSecurityEvent(input: SecurityEvent): void {
  const payload = {
    event: clean(input.event, 80),
    category: "security",
    severity: input.severity,
    requestId: clean(input.requestId, 120),
    ...(input.method ? { method: clean(input.method.toUpperCase(), 16) } : {}),
    ...(input.pathname ? { pathname: cleanPath(input.pathname) } : {}),
    ...(typeof input.status === "number" ? { status: input.status } : {}),
    ...(input.reason ? { reason: clean(input.reason, 120) } : {}),
    ...(input.action ? { action: clean(input.action, 80) } : {}),
    ...(input.limitClass ? { limitClass: clean(input.limitClass, 40) } : {}),
  };

  const serialized = JSON.stringify(payload);
  if (input.severity === "critical") {
    console.error(serialized);
  } else if (input.severity === "warning") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

function clean(value: string, maxLength = MAX_FIELD_LENGTH): string {
  return value
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanPath(value: string): string {
  const pathname = value.split("?", 1)[0] ?? "/";
  return clean(pathname, MAX_FIELD_LENGTH);
}
