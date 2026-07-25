import type { PlaceholderType, PriceType } from "@/types";

export type ClassifiedsErrorCode =
  | "setup_required"
  | "schema_missing"
  | "storage_unconfigured"
  | "auth_required"
  | "permission_denied"
  | "not_found"
  | "stale_account"
  | "stale_review"
  | "status_mismatch"
  | "invalid_transition"
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
  locationNodeId?: string | null;
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
  expiryDays?: 30 | 60 | 90 | null;
  createdAt: string;
  updatedAt: string;
  primaryImageUrl?: string | null;
}

export interface ListingImage {
  id: string;
  listingId: string;
  storagePath: string | null;
  publicUrl: string | null;
  signedUrlExpiresIn?: number | null;
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

export type SavedSearchAlertFrequency = "daily" | "weekly" | "off";

export interface SavedSearch {
  id: string;
  userId: string;
  nameAr: string;
  filters: ListingFilters;
  alertFrequency: SavedSearchAlertFrequency;
  lastAlertCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedSearchPayload {
  nameAr: string;
  filters: ListingFilters;
  alertFrequency?: SavedSearchAlertFrequency;
}

export interface PublicSellerProfile {
  id: string;
  displayName: string;
  verified: boolean;
  joinedAt: string | null;
  locationAr: string | null;
  bio: string | null;
  businessName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  approvedListingCount: number | null;
  inventoryStatus: PublicSellerSectionStatus;
  listingDisplayLimit: number;
  ratingSummary: SellerRatingSummary | null;
  reviews: PublicSellerReview[];
  reviewsStatus: PublicSellerSectionStatus;
  approvedReviewCount: number | null;
  reviewDisplayLimit: number;
  listings: ClassifiedListing[];
}

export type PublicSellerSectionStatus = "ready" | "unavailable" | "unsupported";

export interface PublicSellerReview {
  id: string;
  rating: number;
  comment: string | null;
  traits: SellerReviewTrait[];
  sellerResponse: string | null;
  sellerResponseUpdatedAt: string | null;
  createdAt: string;
}

export interface UpdateProfileBasicsPayload {
  firstName: string;
  lastName: string;
  displayName?: string | null;
  governorate: string | null;
  cityArea?: string | null;
  bio?: string | null;
  businessName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  preferredContactMethod?: string | null;
}

export type ProfileMediaKind = "avatar" | "cover";

export interface ProfileMediaUploadPayload {
  kind: ProfileMediaKind;
  file: File;
}

export type SellerReviewStatus = "pending_review" | "approved" | "rejected";

export type SellerReviewTrait =
  | "accurate_description"
  | "good_communication"
  | "fast_response"
  | "fair_deal"
  | "punctual"
  | "trustworthy";

export interface SellerReview {
  id: string;
  sellerUserId: string;
  reviewerUserId: string;
  relatedListingId: string | null;
  rating: number;
  comment: string | null;
  traits: SellerReviewTrait[];
  status: SellerReviewStatus;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerRatingSummary {
  average: number | null;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface CreateSellerReviewPayload {
  sellerUserId: string;
  relatedListingId?: string | null;
  rating: number;
  comment?: string | null;
  traits?: SellerReviewTrait[];
}

export interface ModerateSellerReviewPayload {
  reviewId: string;
  status: Extract<SellerReviewStatus, "approved" | "rejected">;
  reviewerId: string;
  adminNote?: string | null;
}

export interface ConversationParticipantSummary {
  displayName: string;
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
  listingId: string | null;
  listingTitle: string;
  status: ConversationStatus;
  otherParticipant: ConversationParticipantSummary;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  otherLastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  isMine: boolean;
  body: string;
  attachmentPath: string | null;
  attachmentMimeType: string | null;
  attachmentSizeBytes: number | null;
  attachmentKind: "image" | "audio" | null;
  attachmentDurationMs: number | null;
  attachmentUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface PublicSellerSearchResult {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  governorate: string | null;
  bio: string | null;
  avatarUrl: string | null;
  approvedListingCount: number;
}

export type ConversationStatus = "active" | "archived" | "blocked";

export type MessageReportStatus = "new" | "under_review" | "resolved" | "rejected";

export interface MessageReport {
  id: string;
  messageId: string | null;
  conversationId: string | null;
  reporterUserId: string;
  reportedUserId: string;
  reason: string;
  details: string | null;
  status: MessageReportStatus;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageBody?: string | null;
  listingId?: string | null;
  listingTitle?: string | null;
  reporterDisplayName?: string | null;
  reportedDisplayName?: string | null;
}

export interface CreateMessageReportPayload {
  messageId: string;
  reason: string;
  details?: string | null;
}

export interface ModerateMessageReportPayload {
  reportId: string;
  status: MessageReportStatus;
  adminNote?: string | null;
}

export interface BlockConversationPayload {
  conversationId: string;
  reason?: string | null;
}

export type VerificationRequestStatus = "pending_review" | "approved" | "rejected";
export type VerificationRequestType = "personal" | "business";
export type VerificationDocumentType =
  | "national_id"
  | "passport"
  | "other_government_id"
  | "commercial_registration"
  | "business_license"
  | "tax_document";

export interface SellerVerificationRequest {
  id: string;
  status: VerificationRequestStatus;
  requestType: VerificationRequestType;
  legalName: string;
  businessName: string | null;
  documentType: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSellerVerificationRequest extends SellerVerificationRequest {
  userId: string;
  documentPath: string | null;
  adminNote: string | null;
  reviewedBy: string | null;
}

export interface CreateSellerVerificationRequestPayload {
  requestType: VerificationRequestType;
  legalName: string;
  businessName?: string | null;
  documentType: VerificationDocumentType;
  documentFile: File;
}

export interface ModerateSellerVerificationRequestPayload {
  requestId: string;
  status: Extract<VerificationRequestStatus, "approved" | "rejected">;
  adminNote?: string | null;
}

export type PromotionRequestStatus =
  "pending_review" | "approved" | "rejected" | "expired" | "cancelled";

export type PromotionType = "featured_home" | "highlighted" | "urgent" | "top_category";

export interface ListingPromotionRequest {
  id: string;
  listingId: string;
  requesterUserId: string;
  promotionType: PromotionType;
  status: PromotionRequestStatus;
  requestedDays: number;
  startsAt: string | null;
  endsAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  proofPath: string | null;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  listingTitle?: string | null;
}

export interface CreateListingPromotionRequestPayload {
  listingId: string;
  requesterUserId: string | null;
  promotionType: PromotionType;
  requestedDays: number;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  proofPath?: string | null;
}

export interface PromotionReceiptUploadPayload {
  userId: string | null;
  requestId: string;
  file: File;
}

export interface ModerateListingPromotionRequestPayload {
  requestId: string;
  status: Extract<PromotionRequestStatus, "approved" | "rejected">;
  adminNote?: string | null;
}

export interface ListingReport {
  id: string;
  listingId: string | null;
  listingTitleSnapshot: string | null;
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

export interface ModerateReportPayload {
  reportId: string;
  status: ListingReportStatus;
  assignedTo?: string | null;
  adminNote?: string | null;
  resolvedAt?: string | null;
}

export interface SupportRequest {
  id: string;
  userId: string;
  type: SupportRequestType;
  status: SupportRequestStatus;
  subject: string;
  message: string;
  relatedListingId: string | null;
  relatedReportId: string | null;
  publicResponse: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportRequestPayload {
  type: SupportRequestType;
  subject: string;
  message: string;
  relatedListingId?: string | null;
  relatedReportId?: string | null;
}

export interface ModerateSupportRequestPayload {
  requestId: string;
  status: SupportRequestStatus;
  adminNote?: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  titleAr: string;
  titleEn: string | null;
  bodyAr: string | null;
  bodyEn: string | null;
  targetType: NotificationTargetType | null;
  targetId: string | null;
  readAt: string | null;
  createdAt: string;
}

export type NotificationTargetType =
  | "listing"
  | "conversation"
  | "seller"
  | "saved_search"
  | "owner_listing"
  | "support"
  | "verification"
  | "promotion";

export interface NotificationCursor {
  createdAt: string;
  id: string;
}

export interface CreateListingPayload {
  categoryId: string;
  subcategoryId?: string | null;
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

export interface UpdateListingPayload {
  categoryId?: string;
  subcategoryId?: string | null;
  governorateId?: string;
  title?: string;
  description?: string;
  price?: number | null;
  priceType?: PriceType;
  condition?: ListingCondition;
  districtAr?: string | null;
  contactName?: string | null;
  contactOptions?: Record<string, boolean>;
  details?: Record<string, unknown>;
}

export interface ListingFilters {
  taxonomyNodeId?: string;
  taxonomyNodeIds?: string[];
  taxonomyLegacyScopes?: Array<{
    categoryId: string;
    subcategoryId?: string;
    propertyPurpose?: string;
    propertyType?: string;
  }>;
  categoryId?: string;
  subcategoryId?: string;
  governorateId?: string;
  districtAr?: string;
  priceMin?: number;
  priceMax?: number;
  carMake?: string;
  carModel?: string;
  yearFrom?: number;
  yearTo?: number;
  fuelType?: string;
  transmission?: string;
  propertyPurpose?: string;
  propertyType?: string;
  taxonomyPropertyPurpose?: string;
  taxonomyPropertyType?: string;
  taxonomyLegacySubcategoryId?: string;
  rooms?: number;
  rentalDuration?: string;
  electronicsBrand?: string;
  detailCondition?: string;
  condition?: string;
  priceType?: PriceType;
  employmentType?: string;
  salaryType?: string;
  withPhotos?: boolean;
  query?: string;
  sort?: "latest" | "cheapest" | "expensive" | "featured";
}

export interface PaginatedListingsResponse<T> {
  items: T[];
  nextCursor: ListingCursor | null;
  pageSize: number;
}

export type ListingCursor =
  | { type: "latest"; created_at: string; id: string }
  | { type: "cheapest"; price: number | null; id: string }
  | { type: "expensive"; price: number | null; id: string }
  | { type: "featured"; is_featured: boolean; created_at: string; id: string };

export interface ModerateListingPayload {
  listingId: string;
  status: Extract<ListingStatus, "approved" | "rejected" | "archived">;
  reviewerId: string;
  rejectionReason?: string | null;
  expectedUpdatedAt: string;
}

export interface ListingImageUploadPayload {
  userId: string | null;
  listing: ClassifiedListing;
  file: File;
  sortOrder: number;
  altAr?: string | null;
}

export interface ReorderListingImagePayload {
  userId: string | null;
  listing: ClassifiedListing;
  imageId: string;
  expectedSortOrder: number;
  targetSortOrder: number;
}

export interface DeleteListingImagePayload {
  userId: string | null;
  listing: ClassifiedListing;
  image: ListingImage;
  expectedSortOrder: number;
}

export interface ListingDraft {
  id: string;
  userId: string;
  status: "draft";
  updatedAt: string;
  listing: ClassifiedListing;
  images: ListingImage[];
}

export interface ListingDraftRecoverySnapshot {
  listingId: string;
  updatedAt: string;
  source: "server_draft";
}
