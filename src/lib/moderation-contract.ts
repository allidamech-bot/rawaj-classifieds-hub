import type {
  ListingReportStatus,
  ListingReportType,
  SupportRequestStatus,
  SupportRequestType,
} from "@/lib/classifieds-types";

export const SUPPORT_REQUEST_TYPES = [
  "complaint",
  "suggestion",
  "technical_issue",
  "abuse_report",
  "other",
] as const satisfies readonly SupportRequestType[];

export const LISTING_REPORT_TYPES = [
  "suspicious_listing",
  "fraud",
  "prohibited_content",
  "abusive_user",
  "misleading_price",
  "wrong_info",
  "other",
] as const satisfies readonly ListingReportType[];

export const MESSAGE_REPORT_REASONS = [
  "abusive_or_suspicious",
  "harassment",
  "spam",
  "fraud",
  "privacy_violation",
  "other",
] as const;

export const MODERATION_STATUSES = [
  "new",
  "under_review",
  "resolved",
  "rejected",
] as const satisfies readonly (ListingReportStatus | SupportRequestStatus)[];

export function isSupportRequestType(value: string): value is SupportRequestType {
  return SUPPORT_REQUEST_TYPES.includes(value as SupportRequestType);
}

export function isListingReportType(value: string): value is ListingReportType {
  return LISTING_REPORT_TYPES.includes(value as ListingReportType);
}

export function isMessageReportReason(
  value: string,
): value is (typeof MESSAGE_REPORT_REASONS)[number] {
  return MESSAGE_REPORT_REASONS.includes(value as (typeof MESSAGE_REPORT_REASONS)[number]);
}

export function normalizeModerationText(value: string, maximumLength: number): string {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join("")
    .trim()
    .slice(0, maximumLength);
}

export function normalizeModerationSubject(value: string, maximumLength: number): string {
  return normalizeModerationText(value, maximumLength).replace(/\s+/g, " ");
}

export function isAllowedModerationTransition(
  current: ListingReportStatus | SupportRequestStatus,
  next: ListingReportStatus | SupportRequestStatus,
): boolean {
  if (current === next) return true;
  if (current === "new") return ["under_review", "resolved", "rejected"].includes(next);
  if (current === "under_review") return ["resolved", "rejected"].includes(next);
  return false;
}
