// RAWAJ — domain types aligned with the Cloudflare Worker and D1 contracts.
// Tables planned: users, listings, categories, subcategories, listing_images,
// favorites, saved_searches, chats, messages, reports, blocks, reviews,
// promotions, support_tickets, admin_audit_logs, app_config.

export type Currency = "SAR" | "SYP" | "USD";

export type PriceType = "fixed" | "negotiable" | "contact" | "free" | "exchange";

export type SellerType = "user" | "verified" | "store" | "business";

export type UserRole =
  | "guest"
  | "owner"
  | "user"
  | "seller"
  | "verified_seller"
  | "store_seller"
  | "business_seller"
  | "moderator"
  | "admin";

export interface AdminPermissions {
  canViewAdminDashboard: boolean;
  canManageAdmins: boolean;
  canReviewListings: boolean;
  canApproveListings: boolean;
  canRejectListings: boolean;
  canManageReports: boolean;
  canFreezeUsers: boolean;
  canUnfreezeUsers: boolean;
  canDisableUsers: boolean;
  canDeleteUsers: boolean;
  canVerifySellers: boolean;
  canRevokeSellerVerification: boolean;
  canFeatureSellers: boolean;
  canUnfeatureSellers: boolean;
  canFeatureListings: boolean;
  canUnfeatureListings: boolean;
  canReviewPromotions: boolean;
  canReviewPaymentProof: boolean;
  canManageCategories: boolean;
  canViewAuditLog: boolean;
  canManagePlatformSettings: boolean;
}

export type PlaceholderType =
  | "car"
  | "realestate"
  | "phone"
  | "electronics"
  | "furniture"
  | "job"
  | "service"
  | "fashion"
  | "food"
  | "animals"
  | "education"
  | "business"
  | "misc";

export interface Governorate {
  id: string;
  nameAr: string;
  districts: string[];
}

export interface Subcategory {
  id: string;
  nameAr: string;
}

export interface Category {
  id: string;
  nameAr: string;
  hintAr: string;
  placeholder: PlaceholderType;
  subcategories: Subcategory[];
}

export interface ListingDetails {
  [key: string]: string | number | undefined;
}

export interface ContactOptions {
  message: boolean;
  phone: boolean;
  whatsapp: boolean;
}

export type ListingStatus = "active" | "pending" | "rejected" | "sold" | "expired";
export type PromotionStatus = "none" | "pending_review" | "active" | "expired";
export type VerificationStatus = "unverified" | "pending" | "verified";
export type PaymentStatus = "none" | "awaiting_proof" | "under_review" | "confirmed" | "rejected";

export interface Listing {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  subcategoryName: string;
  price: number;
  currency: Currency;
  priceType: PriceType;
  governorate: string;
  district: string;
  timeSincePosted: string;
  isFeatured: boolean;
  isVerifiedSeller: boolean;
  sellerId: string;
  sellerName: string;
  sellerType: SellerType;
  sellerJoinedAt: string;
  sellerRating: number;
  viewsCount: number;
  favoritesCount: number;
  details: ListingDetails;
  placeholderType: PlaceholderType;
  contactOptions: ContactOptions;
  /** Optional UI-only fields */
  condition?: string;
  imageCount?: number;
  sellerBio?: string;
  sellerLocation?: string;
  sellerListingsCount?: number;
  contactAvailability?: string;
  listingStatus?: ListingStatus;
  promotionStatus?: PromotionStatus;
  verificationStatus?: VerificationStatus;
  isSample?: boolean;
}
