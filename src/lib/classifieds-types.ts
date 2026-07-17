import type { PlaceholderType, PriceType } from "@/types";

export type ClassifiedsErrorCode =
  | "supabase_unconfigured"
  | "setup_required"
  | "schema_missing"
  | "storage_unconfigured"
  | "auth_required"
  | "permission_denied"
  | "not_found"
  | "stale_account"
  | "stale_review"
  | "stale_request"
  | "operation_in_progress"
  | "status_mismatch"
  | "rate_limited"
  | "validation_error"
  | "foreign_key_conflict"
  | "unknown";

export interface ClassifiedsError {
  code: ClassifiedsErrorCode;
  message: string;
  details?: string;
  /**
   * Operational context for the failure (e.g. "owner_listing_submit",
   * "admin_review_queue"). Used for runtime diagnosis so that distinct
   * failures are never collapsed into a single generic message without a
   * traceable source. Never exposed as sensitive database internals.
   */
  operation?: string;
}

export type ClassifiedsResult<T> = { ok: true; data: T } | { ok: false; error: ClassifiedsError };

export type ListingStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived"
  | "expired"
  | "sold"
  | "rented"
  | "unavailable";

export type ListingCondition = "new" | "like_new" | "used" | "for_parts" | "not_applicable";

export type ListingReportType =
  | "suspicious_listing"
  | "fraud"
  | "prohibited_content"
  | "abusive_user"
  | "misleading_price"
  | "wrong_info"
  | "other";

export type ListingReportStatus = "new" | "under_review" | "resolved" | "rejected";

export type SupportRequestType =
  "complaint" | "suggestion" | "technical_issue" | "abuse_report" | "other";

export type SupportRequestStatus = "new" | "under_review" | "resolved" | "rejected";

export interface ClassifiedCategory {
  id: string;
  slug: string;
  nameAr: string;
  hintAr: string | null;
  placeholder: PlaceholderType;
  sortOrder: number;
  isActive: boolean;
}

export interface ClassifiedSubcategory {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string | null;
  sortOrder: number;
}

export interface TaxonomyNode {
  id: string;
  parentId: string | null;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  iconKey: string | null;
  sortOrder: number;
  depth: number;
  isActive: boolean;
  isLeaf: boolean;
  filterSchemaKey: string | null;
  classificationKey: string | null;
  classificationValue: string | null;
  legacyCategoryId: string | null;
  legacySubcategoryId: string | null;
}

export interface ClassifiedGovernorate {
  id: string;
  slug: string;
  nameAr: string;
  districtsAr: string[];
  sortOrder: number;
  isActive: boolean;
}

export interface ClassifiedListing {
  id: string;
  ownerId: string;
  categoryId: string;
  subcategoryId: string | null;
  categoryNameAr?: string;
  categoryPlaceholder?: PlaceholderType;
  governorateId: string;
  governorateNameAr?: string;
  title: string;
  description: string;
  price: number | null;
  currency: "SYP";
  priceType: PriceType;
  condition: ListingCondition;
  status: ListingStatus;
  districtAr: string | null;
  contactName: string | null;
  contactOptions: Record<string, boolean>;
  details: Record<string, unknown>;
  isFeatured: boolean;
  featuredUntil: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
  reservedAt?: string | null;
  statusChangedAt?: string | null;
  expiresAt?: string | null;
  renewedAt?: string | null;
}
