import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export type SafetyCaseSource = "manual" | "listing_report" | "message_report" | "account";
export type SafetyCaseSeverity = "low" | "medium" | "high" | "critical";
export type SafetyCaseStatus = "open" | "investigating" | "mitigated" | "closed";

export interface SafetyCaseSummary {
  id: string;
  sourceType: SafetyCaseSource;
  sourceId: string | null;
  subjectUserId: string | null;
  title: string;
  summary: string;
  severity: SafetyCaseSeverity;
  status: SafetyCaseStatus;
  assignedTo: string | null;
  resolutionNote: string | null;
  escalatedToOwner: boolean;
  escalatedAt: string | null;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}
export interface SafetyStaffSummary { id: string; displayName: string; email: string; roles: string[] }

let safetyCaseReadGeneration = 0;
let safetyStaffReadGeneration = 0;
const safetyCaseMutationInFlight = new Set<string>();

function denied<T>(message = "ليست لديك صلاحية لإدارة قضايا السلامة."): ClassifiedsResult<T> {
  return { ok: false, error: { code: "permission_denied", message } };
}
function staleRead<T>(operation: string): ClassifiedsResult<T> { return { ok: false, error: { code: "unknown", message: "", operation } }; }
function inProgress<T>(message: string, operation: string): ClassifiedsResult<T> { return { ok: false, error: { code: "unknown", message, operation } }; }
function fromApi<T>(result: Awaited<ReturnType<typeof cloudflareApiRequest<T>>>): ClassifiedsResult<T> {
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}

export async function safetyFetchCases(canManageReports: boolean, status: SafetyCaseStatus | "all" = "all"): Promise<ClassifiedsResult<SafetyCaseSummary[]>> {
  if (!canManageReports) return denied();
  const generation = ++safetyCaseReadGeneration;
  const params = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
  const result = await cloudflareApiRequest<SafetyCaseSummary[]>(`/v1/admin/safety/cases${params}`);
  if (generation !== safetyCaseReadGeneration) return staleRead("admin_safety_cases_stale_read");
  return fromApi(result);
}
export async function safetyFetchStaff(canManageReports: boolean): Promise<ClassifiedsResult<SafetyStaffSummary[]>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لعرض طاقم السلامة.");
  const generation = ++safetyStaffReadGeneration;
  const result = await cloudflareApiRequest<SafetyStaffSummary[]>("/v1/admin/safety/staff");
  if (generation !== safetyStaffReadGeneration) return staleRead("admin_safety_staff_stale_read");
  return fromApi(result);
}
export async function safetySaveCase(
  canManageReports: boolean,
  payload: { id?: string | null; sourceType: SafetyCaseSource; sourceId?: string | null; subjectUserId?: string | null; title: string; summary: string; severity: SafetyCaseSeverity; assignedTo?: string | null; expectedVersion?: number | null },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageReports) return denied();
  if (payload.title.trim().length < 3) return { ok: false, error: { code: "validation_error", message: "أدخل عنواناً واضحاً للقضية." } };
  const key = `safety-case:${payload.id || "new"}`;
  if (safetyCaseMutationInFlight.has(key)) return inProgress("حفظ القضية قيد التنفيذ بالفعل.", "admin_safety_case_save_in_progress");
  safetyCaseMutationInFlight.add(key);
  try {
    return fromApi(await cloudflareApiRequest<{ id: string; version: number; updatedAt: string }>(
      payload.id ? `/v1/admin/safety/cases/${encodeURIComponent(payload.id)}` : "/v1/admin/safety/cases",
      { method: payload.id ? "PATCH" : "POST", body: { ...payload, id: undefined } },
    ));
  } finally { safetyCaseMutationInFlight.delete(key); }
}
export async function safetySetCaseStatus(
  canManageReports: boolean,
  payload: { id: string; status: SafetyCaseStatus; expectedVersion: number; reason: string; resolutionNote?: string | null },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageReports) return denied();
  const key = `safety-case:${payload.id}`;
  if (safetyCaseMutationInFlight.has(key)) return inProgress("هناك عملية أخرى قيد التنفيذ على هذه القضية.", "admin_safety_case_status_in_progress");
  safetyCaseMutationInFlight.add(key);
  try {
    return fromApi(await cloudflareApiRequest<{ id: string; version: number; updatedAt: string }>(
      `/v1/admin/safety/cases/${encodeURIComponent(payload.id)}/status`, { method: "PATCH", body: payload },
    ));
  } finally { safetyCaseMutationInFlight.delete(key); }
}
export async function safetyEscalateCase(
  canManageReports: boolean,
  payload: { id: string; expectedVersion: number; reason: string },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لتصعيد القضية.");
  const key = `safety-case:${payload.id}`;
  if (safetyCaseMutationInFlight.has(key)) return inProgress("هناك عملية أخرى قيد التنفيذ على هذه القضية.", "admin_safety_case_escalation_in_progress");
  safetyCaseMutationInFlight.add(key);
  try {
    return fromApi(await cloudflareApiRequest<{ id: string; version: number; updatedAt: string }>(
      `/v1/admin/safety/cases/${encodeURIComponent(payload.id)}/escalate`, { method: "POST", body: payload },
    ));
  } finally { safetyCaseMutationInFlight.delete(key); }
}
