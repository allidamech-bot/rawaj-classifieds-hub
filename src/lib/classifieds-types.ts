import type { PlaceholderType, PriceType } from "@/types";

export type ClassifiedsErrorCode =
  | "supabase_unconfigured"
  | "setup_required"
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

export interface SavedSearch {
  id: string;
  userId: string;
  nameAr: string;
  filters: ListingFilters;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSavedSearchPayload {
  nameAr: string;
  filters: ListingFilters;
}

export interface PublicSellerProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  verified: boolean;
  joinedAt: string | null;
  locationAr: string | null;
  bio: string | null;
  businessName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  approvedListingCount: number;
  ratingSummary: SellerRatingSummary;
  reviews: SellerReview[];
  listings: ClassifiedListing[];
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
  userId: string | null;
  kind: ProfileMediaKind;
  file: File;
  oldPath?: string | null;
}

export type SellerReviewStatus = "pending_review" | "approved" | "rejected";

export interface SellerReview {
  id: string;
  sellerUserId: string;
  reviewerUserId: string;
  relatedListingId: string | null;
  rating: number;
  comment: string;
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
  reviewerUserId: string | null;
  relatedListingId?: string | null;
  rating: number;
  comment: string;
}

export interface ModerateSellerReviewPayload {
  reviewId: string;
  status: Extract<SellerReviewStatus, "approved" | "rejected">;
  reviewerId: string;
  adminNote?: string | null;
}

export interface ConversationParticipantSummary {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  governorate: string | null;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerUserId: string;
  sellerUserId: string;
  status: ConversationStatus;
  otherParticipant: ConversationParticipantSummary;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
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
  messageId: string;
  conversationId: string;
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
  conversationId: string;
  reporterUserId: string | null;
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
  blockerUserId: string | null;
  blockedUserId: string;
  reason?: string | null;
}

export type VerificationRequestStatus = "pending_review" | "approved" | "rejected";
export type VerificationRequestType = "personal" | "business";

export interface SellerVerificationRequest {
  id: string;
  userId: string;
  status: VerificationRequestStatus;
  requestType: VerificationRequestType;
  legalName: string;
  businessName: string | null;
  documentType: string | null;
  documentPath: string | null;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSellerVerificationRequestPayload {
  userId: string | null;
  requestType: VerificationRequestType;
  legalName: string;
  businessName?: string | null;
  documentType?: string | null;
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

export interface SupportRequest {
  id: string;
  userId: string;
  type: SupportRequestType;
  status: SupportRequestStatus;
  subject: string;
  message: string;
  relatedListingId: string | null;
  relatedReportId: string | null;
  adminNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
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
  recipientId: string;
  actorId: string | null;
  type: string;
  titleAr: string;
  bodyAr: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
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
  rooms?: number;
  rentalDuration?: string;
  electronicsBrand?: string;
  detailCondition?: string;
  employmentType?: string;
  salaryType?: string;
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
