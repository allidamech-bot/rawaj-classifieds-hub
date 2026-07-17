import {
  getClient,
  mapError,
  rowArray,
  rowBoolean,
  rowNullableString,
  rowNumber,
  rowString,
} from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

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

export interface SafetyStaffSummary {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
}

let safetyCaseReadGeneration = 0;
let safetyStaffReadGeneration = 0;
const safetyCaseMutationInFlight = new Set<string>();

function staleReadResult<T>(operation: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "unknown", message: "", operation } };
}

function operationInProgressResult<T>(
  message: string,
  operation: string,
): ClassifiedsResult<T> {
  return { ok: false, error: { code: "unknown", message, operation } };
}

export async function safetyFetchCases(
  canManageReports: boolean,
  status: SafetyCaseStatus | "all" = "all",
): Promise<ClassifiedsResult<SafetyCaseSummary[]>> {
  if (!canManageReports) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "ليست لديك صلاحية لإدارة قضايا السلامة." },
    };
  }

  const requestGeneration = ++safetyCaseReadGeneration;
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_safety_list_cases", {
    p_status: status === "all" ? null : status,
    p_limit: 200,
  });
  if (requestGeneration !== safetyCaseReadGeneration) {
    return staleReadResult("admin_safety_cases_stale_read");
  }
  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapSafetyCase),
  };
}

export async function safetyFetchStaff(
  canManageReports: boolean,
): Promise<ClassifiedsResult<SafetyStaffSummary[]>> {
  if (!canManageReports) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "ليست لديك صلاحية لعرض طاقم السلامة." },
    };
  }

  const requestGeneration = ++safetyStaffReadGeneration;
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_safety_list_staff");
  if (requestGeneration !== safetyStaffReadGeneration) {
    return staleReadResult("admin_safety_staff_stale_read");
  }
  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: rowString(row, "id"),
      displayName: rowString(row, "display_name"),
      email: rowString(row, "email"),
      roles: rowArray(row, "roles"),
    })),
  };
}

export async function safetySaveCase(
  canManageReports: boolean,
  payload: {
    id?: string | null;
    sourceType: SafetyCaseSource;
    sourceId?: string | null;
    subjectUserId?: string | null;
    title: string;
    summary: string;
    severity: SafetyCaseSeverity;
    assignedTo?: string | null;
    expectedVersion?: number | null;
  },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageReports) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "ليست لديك صلاحية لإدارة قضايا السلامة." },
    };
  }

  const title = payload.title.trim();
  if (title.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل عنواناً واضحاً للقضية." },
    };
  }

  const operationKey = `safety-case:${payload.id || "new"}`;
  if (safetyCaseMutationInFlight.has(operationKey)) {
    return operationInProgressResult(
      "حفظ القضية قيد التنفيذ بالفعل.",
      "admin_safety_case_save_in_progress",
    );
  }
  safetyCaseMutationInFlight.add(operationKey);

  try {
    const clientResult = getClient();
    if (!clientResult.ok) return clientResult;

    const { data, error } = await clientResult.data.rpc("rawaj_safety_upsert_case", {
      p_id: payload.id || null,
      p_source_type: payload.sourceType,
      p_source_id: payload.sourceId?.trim() || null,
      p_subject_user_id: payload.subjectUserId?.trim() || null,
      p_title: title,
      p_summary: payload.summary.trim(),
      p_severity: payload.severity,
      p_assigned_to: payload.assignedTo || null,
      p_expected_version: payload.id ? (payload.expectedVersion ?? null) : null,
    });

    if (error) {
      if (error.message?.includes("stale_safety_case")) {
        return {
          ok: false,
          error: {
            code: "unknown",
            message: "تغيّرت القضية منذ تحميلها. أعد التحميل قبل الحفظ.",
          },
        };
      }
      return { ok: false, error: mapError(error) };
    }

    return mapMutation(data);
  } finally {
    safetyCaseMutationInFlight.delete(operationKey);
  }
}

export async function safetySetCaseStatus(
  canManageReports: boolean,
  payload: {
    id: string;
    status: SafetyCaseStatus;
    expectedVersion: number;
    reason: string;
    resolutionNote?: string | null;
  },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageReports) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "ليست لديك صلاحية لإدارة قضايا السلامة." },
    };
  }

  const reason = payload.reason.trim();
  if (reason.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سبباً واضحاً لتغيير الحالة." },
    };
  }
  if (payload.status === "closed" && (payload.resolutionNote?.trim().length ?? 0) < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل ملاحظة إغلاق واضحة قبل إغلاق القضية." },
    };
  }

  const operationKey = `safety-case:${payload.id}`;
  if (safetyCaseMutationInFlight.has(operationKey)) {
    return operationInProgressResult(
      "هناك عملية أخرى قيد التنفيذ على هذه القضية.",
      "admin_safety_case_status_in_progress",
    );
  }
  safetyCaseMutationInFlight.add(operationKey);

  try {
    const clientResult = getClient();
    if (!clientResult.ok) return clientResult;

    const { data, error } = await clientResult.data.rpc("rawaj_safety_set_case_status", {
      p_id: payload.id,
      p_status: payload.status,
      p_expected_version: payload.expectedVersion,
      p_reason: reason,
      p_resolution_note: payload.resolutionNote?.trim() || null,
    });
    if (error) {
      if (error.message?.includes("stale_safety_case")) {
        return {
          ok: false,
          error: {
            code: "unknown",
            message: "تغيّرت القضية منذ تحميلها. أعد التحميل قبل تغيير الحالة.",
          },
        };
      }
      return { ok: false, error: mapError(error) };
    }

    return mapMutation(data);
  } finally {
    safetyCaseMutationInFlight.delete(operationKey);
  }
}

export async function safetyEscalateCase(
  canManageReports: boolean,
  payload: { id: string; expectedVersion: number; reason: string },
): Promise<ClassifiedsResult<{ id: string; version: number; updatedAt: string }>> {
  if (!canManageReports) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "ليست لديك صلاحية لتصعيد القضية." },
    };
  }

  const reason = payload.reason.trim();
  if (reason.length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل سبباً واضحاً للتصعيد." },
    };
  }

  const operationKey = `safety-case:${payload.id}`;
  if (safetyCaseMutationInFlight.has(operationKey)) {
    return operationInProgressResult(
      "هناك عملية أخرى قيد التنفيذ على هذه القضية.",
      "admin_safety_case_escalation_in_progress",
    );
  }
  safetyCaseMutationInFlight.add(operationKey);

  try {
    const clientResult = getClient();
    if (!clientResult.ok) return clientResult;

    const { data, error } = await clientResult.data.rpc("rawaj_safety_escalate_case", {
      p_id: payload.id,
      p_expected_version: payload.expectedVersion,
      p_reason: reason,
    });
    if (error) {
      if (error.message?.includes("stale_safety_case")) {
        return {
          ok: false,
          error: {
            code: "unknown",
            message: "تغيّرت القضية منذ تحميلها. أعد التحميل قبل التصعيد.",
          },
        };
      }
      return { ok: false, error: mapError(error) };
    }

    return mapMutation(data);
  } finally {
    safetyCaseMutationInFlight.delete(operationKey);
  }
}

function mapSafetyCase(row: Record<string, unknown>): SafetyCaseSummary {
  return {
    id: rowString(row, "id"),
    sourceType: rowString(row, "source_type", "manual") as SafetyCaseSource,
    sourceId: rowNullableString(row, "source_id"),
    subjectUserId: rowNullableString(row, "subject_user_id"),
    title: rowString(row, "title"),
    summary: rowString(row, "summary"),
    severity: rowString(row, "severity", "medium") as SafetyCaseSeverity,
    status: rowString(row, "status", "open") as SafetyCaseStatus,
    assignedTo: rowNullableString(row, "assigned_to"),
    resolutionNote: rowNullableString(row, "resolution_note"),
    escalatedToOwner: rowBoolean(row, "escalated_to_owner"),
    escalatedAt: rowNullableString(row, "escalated_at"),
    version: rowNumber(row, "version"),
    createdBy: rowString(row, "created_by"),
    updatedBy: rowString(row, "updated_by"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
    closedAt: rowNullableString(row, "closed_at"),
  };
}

function mapMutation(
  data: unknown,
): ClassifiedsResult<{ id: string; version: number; updatedAt: string }> {
  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) {
    return {
      ok: false,
      error: { code: "unknown", message: "تم تنفيذ العملية دون نتيجة قابلة للتحقق." },
    };
  }
  return {
    ok: true,
    data: {
      id: rowString(row, "id"),
      version: rowNumber(row, "version"),
      updatedAt: rowString(row, "updated_at"),
    },
  };
}
