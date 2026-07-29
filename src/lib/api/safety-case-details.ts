import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

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
function denied<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "permission_denied", message } };
}
function fromApi<T>(
  result: Awaited<ReturnType<typeof cloudflareApiRequest<T>>>,
): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: { code: result.code as ClassifiedsErrorCode, message: result.error } };
}
export async function safetyFetchCaseNotes(
  canManageReports: boolean,
  caseId: string,
): Promise<ClassifiedsResult<SafetyCaseNote[]>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لعرض ملاحظات القضية.");
  return fromApi(
    await cloudflareApiRequest<SafetyCaseNote[]>(
      `/v1/admin/safety/cases/${encodeURIComponent(caseId)}/notes`,
    ),
  );
}
export async function safetyAddCaseNote(
  canManageReports: boolean,
  caseId: string,
  note: string,
): Promise<ClassifiedsResult<{ id: string }>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لإضافة ملاحظات القضية.");
  if (note.trim().length < 2)
    return { ok: false, error: { code: "validation_error", message: "أدخل ملاحظة داخلية واضحة." } };
  return fromApi(
    await cloudflareApiRequest<{ id: string }>(
      `/v1/admin/safety/cases/${encodeURIComponent(caseId)}/notes`,
      { method: "POST", body: { note: note.trim() } },
    ),
  );
}
export async function safetyFetchCaseLinks(
  canManageReports: boolean,
  caseId: string,
): Promise<ClassifiedsResult<SafetyCaseLink[]>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لعرض روابط القضية.");
  return fromApi(
    await cloudflareApiRequest<SafetyCaseLink[]>(
      `/v1/admin/safety/cases/${encodeURIComponent(caseId)}/links`,
    ),
  );
}
export async function safetyAddCaseLink(
  canManageReports: boolean,
  payload: { caseId: string; linkType: SafetyCaseLinkType; linkId: string },
): Promise<ClassifiedsResult<{ id: string }>> {
  if (!canManageReports) return denied("ليست لديك صلاحية لإضافة روابط القضية.");
  return fromApi(
    await cloudflareApiRequest<{ id: string }>(
      `/v1/admin/safety/cases/${encodeURIComponent(payload.caseId)}/links`,
      { method: "POST", body: { linkType: payload.linkType, linkId: payload.linkId.trim() } },
    ),
  );
}
