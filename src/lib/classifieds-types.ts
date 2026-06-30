import type { PlaceholderType, PriceType } from "@/types";

export type ClassifiedsErrorCode =
  | "supabase_unconfigured"
  | "schema_missing"
  | "storage_unconfigured"
  | "auth_required"
  | "permission_denied"
  | "not_found"
  | "validation_error"
  | "unknown";

export interface ClassifiedsError {
  code: ClassifiedsErrorCode;
  message: string;
  details?: string;
}

export type ClassifiedsResult<T> = { ok: true; data: T } | { ok: false; error: ClassifiedsError };

export type ListingStatus =
  "draft" | "pending_review" | "approved" | "rejected" | "archived" | "expired";

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
  sortOrder: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface ListingImage {
  id: string;
  listingId: string;
  storagePath: string | null;
  publicUrl: string | null;
  altAr: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface Favorite {
  userId: string;
  listingId: string;
  createdAt: string;
  listing?: ClassifiedListing;
}

export interface SavedSearch {
  id: string;
  userId: string;
  nameAr: string;
  filters: ListingFilters;
  createdAt: string;
  updatedAt: string;
}

export interface ListingReport {
  id: string;
  listingId: string;
  reporterId: string;
  reportType: ListingReportType;
  reason: string;
  status: ListingReportStatus;
  assignedTo: string | null;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateListingPayload {
  categoryId: string;
  governorateId: string;
  title: string;
  description: string;
  price: number | null;
  priceType: PriceType;
  condition: ListingCondition;
  districtAr: string | null;
  contactName: string | null;
  contactOptions: Record<string, boolean>;
  details: Record<string, unknown>;
}

export interface ListingFilters {
  categoryId?: string;
  governorateId?: string;
  query?: string;
  sort?: "latest" | "cheapest" | "expensive" | "featured";
}

export interface ModerateListingPayload {
  listingId: string;
  status: Extract<ListingStatus, "approved" | "rejected" | "archived">;
  reviewerId: string;
  rejectionReason?: string | null;
}

export interface ListingImageUploadPayload {
  userId: string | null;
  listing: ClassifiedListing;
  file: File;
  sortOrder: number;
  altAr?: string | null;
}

export interface ModerateReportPayload {
  reportId: string;
  status: ListingReportStatus;
  assignedTo?: string | null;
  adminNote?: string | null;
  resolvedAt?: string | null;
}
