import { getClient, mapError, rowNullableString, rowString } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

export type SafetyCaseLinkType = "listing_report" | "message_report" | "listing" | "account";

export interface SafetyCaseNote {
  id: string;
  caseId: string;
  authorId: string;
  note: string;
  createdAt: string;
}

export interface SafetyCaseLink {
  id: string;
  caseId: string;
  linkType: SafetyCaseLinkType;
  linkId: string;
  createdBy: string;
  createdAt: string;
}

export async function safetyFetchCaseNotes(
  canManageReports: boolean,
  caseId: string,
): Promise<ClassifiedsResult<SafetyCaseNote[]>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لعرض ملاحظات القضية.");
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_safety_list_case_notes", {
    p_case_id: caseId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: rowString(row, "id"),
      caseId: rowString(row, "case_id"),
      authorId: rowString(row, "author_id"),
      note: rowString(row, "note"),
      createdAt: rowString(row, "created_at"),
    })),
  };
}

export async function safetyAddCaseNote(
  canManageReports: boolean,
  caseId: string,
  note: string,
): Promise<ClassifiedsResult<{ id: string }>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لإضافة ملاحظات القضية.");
  if (note.trim().length < 2) {
    return { ok: false, error: { code: "validation_error", message: "أدخل ملاحظة داخلية واضحة." } };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_safety_add_case_note", {
    p_case_id: caseId,
    p_note: note.trim(),
  });
  if (error) return { ok: false, error: mapError(error) };
  const id = typeof data === "string" ? data : rowNullableString((data ?? {}) as Record<string, unknown>, "id");
  return id
    ? { ok: true, data: { id } }
    : { ok: false, error: { code: "unknown", message: "تمت العملية دون معرف ملاحظة قابل للتحقق." } };
}

export async function safetyFetchCaseLinks(
  canManageReports: boolean,
  caseId: string,
): Promise<ClassifiedsResult<SafetyCaseLink[]>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لعرض روابط القضية.");
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_safety_list_case_links", {
    p_case_id: caseId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: rowString(row, "id"),
      caseId: rowString(row, "case_id"),
      linkType: rowString(row, "link_type") as SafetyCaseLinkType,
      linkId: rowString(row, "link_id"),
      createdBy: rowString(row, "created_by"),
      createdAt: rowString(row, "created_at"),
    })),
  };
}

export async function safetyAddCaseLink(
  canManageReports: boolean,
  payload: { caseId: string; linkType: SafetyCaseLinkType; linkId: string },
): Promise<ClassifiedsResult<{ id: string }>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لإضافة روابط القضية.");
  if (!payload.linkId.trim()) {
    return { ok: false, error: { code: "validation_error", message: "أدخل معرف العنصر المرتبط." } };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data, error } = await clientResult.data.rpc("rawaj_safety_add_case_link", {
    p_case_id: payload.caseId,
    p_link_type: payload.linkType,
    p_link_id: payload.linkId.trim(),
  });
  if (error) return { ok: false, error: mapError(error) };
  const id = typeof data === "string" ? data : rowNullableString((data ?? {}) as Record<string, unknown>, "id");
  return id
    ? { ok: true, data: { id } }
    : { ok: false, error: { code: "unknown", message: "تمت العملية دون معرف رابط قابل للتحقق." } };
}

function denied(message: string): ClassifiedsResult<never> {
  return { ok: false, error: { code: "permission_denied", message } };
}
