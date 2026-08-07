import { authenticate, type AuthEnv } from "./auth";
import { logSecurityEvent } from "./security-observability";

export async function handleSecuritySummary(
  request: Request,
  env: AuthEnv,
  requestId: string,
): Promise<Response> {
  const auth = await authenticate(request, env);
  if (!auth || !auth.roles.some((role) => role === "admin" || role === "owner")) {
    logSecurityEvent({
      event: "security_summary_denied",
      severity: "critical",
      requestId,
      method: request.method,
      pathname: new URL(request.url).pathname,
      status: 403,
      reason: "admin_role_required",
    });
    return json({ error: { code: "permission_denied", message: "Administrative access required." } }, 403);
  }

  const counts24h = await env.DB.prepare(
    `SELECT action, count(*) AS count
       FROM audit_logs
      WHERE entity_type = 'admin_security'
        AND julianday(created_at) >= julianday('now', '-24 hours')
      GROUP BY action
      ORDER BY count DESC`,
  ).all<{ action: string; count: number }>();
  const totals = await env.DB.prepare(
    `SELECT
       sum(CASE WHEN julianday(created_at) >= julianday('now', '-24 hours') THEN 1 ELSE 0 END) AS total_24h,
       count(*) AS total_7d,
       count(DISTINCT CASE
         WHEN julianday(created_at) >= julianday('now', '-24 hours') THEN ip_hash
       END) AS network_fingerprints_24h
       FROM audit_logs
      WHERE entity_type = 'admin_security'
        AND julianday(created_at) >= julianday('now', '-7 days')`,
  ).first<{ total_24h: number | null; total_7d: number | null; network_fingerprints_24h: number | null }>();
  const recent = await env.DB.prepare(
    `SELECT action, metadata, created_at
       FROM audit_logs
      WHERE entity_type = 'admin_security'
      ORDER BY created_at DESC
      LIMIT 20`,
  ).all<{ action: string; metadata: string; created_at: string }>();

  if (!counts24h.success || !recent.success || !totals) {
    logSecurityEvent({
      event: "security_summary_query_failed",
      severity: "critical",
      requestId,
      method: request.method,
      pathname: new URL(request.url).pathname,
      status: 500,
      reason: "audit_query_failed",
    });
    return json({ error: { code: "database_error", message: "Unable to load security summary." } }, 500);
  }

  return json(
    {
      data: {
        window: "24h",
        totalDenied24h: numberValue(totals.total_24h),
        totalDenied7d: numberValue(totals.total_7d),
        uniqueNetworkFingerprints24h: numberValue(totals.network_fingerprints_24h),
        byAction24h: (counts24h.results ?? []).map((row) => ({
          action: clean(row.action, 80),
          count: numberValue(row.count),
        })),
        recent: (recent.results ?? []).map((row) => ({
          action: clean(row.action, 80),
          createdAt: clean(row.created_at, 80),
          ...safeMetadata(row.metadata),
        })),
      },
    },
    200,
  );
}

function safeMetadata(value: string): {
  requestId?: string;
  method?: string;
  path?: string;
  roles?: string[];
} {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      ...(typeof parsed.requestId === "string" ? { requestId: clean(parsed.requestId, 120) } : {}),
      ...(typeof parsed.method === "string" ? { method: clean(parsed.method, 16) } : {}),
      ...(typeof parsed.path === "string" ? { path: clean(parsed.path.split("?", 1)[0] ?? "", 180) } : {}),
      ...(Array.isArray(parsed.roles)
        ? { roles: parsed.roles.filter((role): role is string => typeof role === "string").slice(0, 8) }
        : {}),
    };
  } catch {
    return {};
  }
}

function numberValue(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function clean(value: string, maxLength: number): string {
  return value.replace(/[\r\n\t]/g, " ").trim().slice(0, maxLength);
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
