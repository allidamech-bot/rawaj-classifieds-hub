import type {
  ListingReportStatus,
  ListingStatus,
  SellerReviewStatus,
  SupportRequestStatus,
} from "@/lib/classifieds-types";
import type { Language } from "@/lib/ui-preferences";

export function listingStatusLabel(status: ListingStatus, language: Language, detailed = false) {
  switch (status) {
    case "draft":
      return language === "ar" ? "مسودة" : "Draft";
    case "pending_review":
      return language === "ar" ? "قيد المراجعة" : "Pending review";
    case "approved":
      if (detailed) return language === "ar" ? "إعلان معتمد" : "Approved listing";
      return language === "ar" ? "معتمد" : "Approved";
    case "rejected":
      return language === "ar" ? "مرفوض" : "Rejected";
    case "archived":
      return language === "ar" ? "مؤرشف" : "Archived";
    case "expired":
      return language === "ar" ? "منتهي" : "Expired";
    default:
      return status;
  }
}

export function supportStatusLabel(status: SupportRequestStatus, language: Language) {
  switch (status) {
    case "new":
      return language === "ar" ? "جديد" : "New";
    case "under_review":
      return language === "ar" ? "قيد المراجعة" : "Under review";
    case "resolved":
      return language === "ar" ? "تم الحل" : "Resolved";
    case "rejected":
      return language === "ar" ? "مرفوض" : "Rejected";
    default:
      return status;
  }
}

export function sellerReviewStatusLabel(status: SellerReviewStatus, language: Language) {
  switch (status) {
    case "pending_review":
      return language === "ar" ? "قيد المراجعة" : "Pending review";
    case "approved":
      return language === "ar" ? "معتمد" : "Approved";
    case "rejected":
      return language === "ar" ? "مرفوض" : "Rejected";
    default:
      return status;
  }
}

export function reportStatusLabel(status: ListingReportStatus, language: Language) {
  switch (status) {
    case "new":
      return language === "ar" ? "جديد" : "New";
    case "under_review":
      return language === "ar" ? "قيد المراجعة" : "Under review";
    case "resolved":
      return language === "ar" ? "تم الحل" : "Resolved";
    case "rejected":
      return language === "ar" ? "مرفوض" : "Rejected";
    default:
      return status;
  }
}
