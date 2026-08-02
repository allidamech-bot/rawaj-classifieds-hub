import type { Language } from "@/lib/ui-preferences";
import type { PriceType } from "@/types";

export const categoryLabels: Record<string, { ar: string; en: string; hintEn?: string }> = {
  cars: { ar: "سيارات ومركبات", en: "Cars and Vehicles", hintEn: "Cars, parts, and vehicles" },
  realestate: { ar: "عقارات", en: "Real Estate", hintEn: "Homes, rentals, shops, and land" },
  mobiles: { ar: "موبايلات وتابلت", en: "Mobiles and Tablets", hintEn: "Devices and accessories" },
  electronics: { ar: "إلكترونيات", en: "Electronics", hintEn: "Laptops, screens, and devices" },
  furniture: { ar: "منزل وأثاث", en: "Home and Furniture", hintEn: "Home, office, and decor" },
  jobs: { ar: "وظائف", en: "Jobs", hintEn: "Open roles and job seekers" },
  services: { ar: "خدمات", en: "Services", hintEn: "Repair, delivery, cleaning, and design" },
  fashion: {
    ar: "أزياء ومستلزمات",
    en: "Fashion and Accessories",
    hintEn: "Clothing, watches, and accessories",
  },
  food: {
    ar: "أطعمة ومنتجات محلية",
    en: "Food and Local Products",
    hintEn: "Local goods and groceries",
  },
  animals: { ar: "حيوانات ومواشي", en: "Animals and Livestock", hintEn: "Livestock and supplies" },
  education: {
    ar: "تعليم ودورات",
    en: "Education and Courses",
    hintEn: "Courses, tutors, and training",
  },
  business: {
    ar: "أعمال وصناعة",
    en: "Business and Industry",
    hintEn: "Equipment, shops, and projects",
  },
  misc: { ar: "متفرقات", en: "Miscellaneous", hintEn: "General listings" },
};

export const governorateLabels: Record<string, { ar: string; en: string }> = {
  damascus: { ar: "دمشق", en: "Damascus" },
  "rif-dimashq": { ar: "ريف دمشق", en: "Rif Dimashq" },
  aleppo: { ar: "حلب", en: "Aleppo" },
  homs: { ar: "حمص", en: "Homs" },
  hama: { ar: "حماة", en: "Hama" },
  latakia: { ar: "اللاذقية", en: "Latakia" },
  tartus: { ar: "طرطوس", en: "Tartus" },
  idlib: { ar: "إدلب", en: "Idlib" },
  "deir-ez-zor": { ar: "دير الزور", en: "Deir ez-Zor" },
  raqqa: { ar: "الرقة", en: "Raqqa" },
  hasakah: { ar: "الحسكة", en: "Hasakah" },
  daraa: { ar: "درعا", en: "Daraa" },
  suwayda: { ar: "السويداء", en: "Suwayda" },
  quneitra: { ar: "القنيطرة", en: "Quneitra" },
};

export function localized(language: Language, ar: string, en: string) {
  return language === "ar" ? ar : en;
}

export function categoryName(
  id: string | undefined,
  fallback: string | undefined,
  language: Language,
) {
  if (!id) return fallback ?? localized(language, "إعلان", "Listing");
  const label = categoryLabels[id];
  if (!label) return fallback ?? localized(language, "إعلان", "Listing");
  return language === "ar" ? label.ar : label.en;
}

export function categoryHint(id: string, fallbackAr: string, language: Language) {
  const label = categoryLabels[id];
  if (!label) return fallbackAr;
  return language === "ar" ? fallbackAr || label.ar : (label.hintEn ?? label.en);
}

export function governorateName(
  id: string | undefined,
  fallback: string | undefined,
  language: Language,
) {
  if (!id) return fallback ?? localized(language, "السعودية", "Saudi Arabia");
  const label = governorateLabels[id];
  if (!label) return fallback ?? localized(language, "السعودية", "Saudi Arabia");
  return language === "ar" ? label.ar : label.en;
}

const arNumber = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 });
const enNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatPriceLocalized(
  price: number,
  type: PriceType | string,
  language: Language,
  currency: "SAR" | "SYP" | "USD" = "SAR",
) {
  const number = language === "ar" ? arNumber.format(price) : enNumber.format(price);
  const currencyLabel =
    currency === "SAR"
      ? localized(language, "ر.س", "SAR")
      : currency === "SYP"
        ? localized(language, "ل.س", "SYP")
        : "$";
  const amount = `${number} ${currencyLabel}`;

  switch (type) {
    case "free":
      return localized(language, "مجاناً", "Free");
    case "contact":
      return localized(language, "السعر عند التواصل", "Price on contact");
    case "exchange":
      return localized(language, "للمبادلة", "For exchange");
    case "negotiable":
      return price
        ? localized(language, `${amount} · قابل للتفاوض`, `${amount} · Negotiable`)
        : localized(language, "السعر قابل للتفاوض", "Price negotiable");
    default:
      return price ? amount : localized(language, "السعر غير محدد", "Price not set");
  }
}

export function uiLabel(value: string | undefined, language: Language) {
  if (!value || language === "ar") return value ?? "";
  return uiLabels[value] ?? value;
}

const uiLabels: Record<string, string> = {
  المفضلة: "Favorites",
  "جارٍ التحقق من الجلسة": "Checking session",
  "يتم التأكد من تسجيل الدخول.": "Checking sign-in status.",
  "تسجيل الدخول مطلوب": "Login required",
  "تسجيل الدخول": "Log in",
  "المفضلة مرتبطة بالحساب": "Favorites are account based",
  "تُحفظ الإعلانات المعتمدة ضمن حسابك لتتمكن من الرجوع إليها من صفحة المفضلة.":
    "Approved listings are saved to your account so you can return to them from favorites.",
  "تصفح الإعلانات": "Browse listings",
  "جارٍ تحميل المفضلة": "Loading favorites",
  "تعذر تحميل المفضلة": "Could not load favorites",
  "تعذر تحميل المفضلة الآن. حاول مرة أخرى أو تابع تصفح الإعلانات.":
    "Could not load favorites right now. Try again or keep browsing listings.",
  "لا توجد إعلانات في المفضلة": "No favorite listings yet",
  "احفظ الإعلانات المعتمدة التي تهمك لتعود إليها ضمن سير العمل.":
    "Save approved listings you care about so you can return to them through the workflow.",
  "إعلان محفوظ": "Saved listing",
  "رقم الإعلان:": "Listing ID:",
  فتح: "Open",
  "إزالة من المفضلة": "Remove from favorites",
  "أضف إعلاناً": "Post a listing",
  "عمليات البحث المحفوظة": "Saved searches",
  "البحث المحفوظ مرتبط بالحساب": "Saved search is account based",
  "احفظ فلاتر البحث المهمة ضمن حسابك لتعود إليها بسهولة.":
    "Save important search filters to your account so you can return to them easily.",
  "ابدأ البحث": "Start searching",
  "مرتبطة بالحساب الحالي فقط": "Linked only to the current account",
  "تنبيهات عند توفرها": "Alerts when available",
  "فتح البحث": "Open search",
  "تصفح الأقسام": "Browse categories",
  بائع: "Seller",
  "هذا البائع تعذر عرضه الآن.": "This seller is not available right now.",
  خطأ: "Error",
  "إعادة المحاولة": "Try again",
  "ملف البائع": "Seller profile",
  "ملف البائع العام قيد التجهيز حالياً. عند التفعيل ستظهر البيانات العامة والإعلانات المعتمدة فقط دون كشف أي بيانات خاصة.":
    "The public seller profile is being prepared. When enabled, only public data and approved listings will appear without exposing private data.",
  "جارٍ التحقق من الجلسة...": "Checking session...",
  موثّق: "Verified",
  منذ: "Since",
  إعلان: "listings",
  "رسالة · عند توفرها": "Message · when available",
  "اتصال · عند توفرها": "Call · when available",
  "واتساب · عند توفرها": "WhatsApp · when available",
  "وسائل التواصل تظهر حسب إعدادات البائع وصلاحيات الحساب.":
    "Contact methods will appear only according to seller settings with account permissions.",
  "نبذة عن البائع": "About the seller",
  "لم يضف البائع نبذة بعد. ستظهر هنا معلومات النشاط، ساعات التوفر، ومدة الاستجابة ضمن سير العمل.":
    "The seller has not added a bio yet. Business info, availability, and response time will appear here through the workflow.",
  "وقت الاستجابة:": "Response time:",
  "الموقع:": "Location:",
  السعودية: "Saudi Arabia",
  "الإعلانات النشطة": "Active listings",
  "لا توجد إعلانات نشطة لهذا البائع حالياً.": "This seller has no active listings right now.",
  "تنبيه أمان": "Safety note",
  "قابل البائع في مكان عام وآمن، وافحص السلعة قبل الدفع. لا تحوّل المال قبل التأكد.":
    "Meet the seller in a public, safe place, and inspect the item before paying. Do not transfer money before verifying.",
  "إبلاغ · عند توفرها": "Report · when available",
  "حظر · عند توفرها": "Block · when available",
  "بائع موثّق": "Verified seller",
  متجر: "Store",
  "حساب أعمال": "Business account",
  مستخدم: "User",
  "لوحة الإدارة": "Admin dashboard",
  "مركز المالك": "Owner center",
  "إعلانات للمراجعة": "Listings to review",
  البلاغات: "Reports",
  "المستخدمون والصلاحيات": "Users and permissions",
  "طلبات الترويج": "Promotion requests",
  "جاري التحقق من الصلاحيات": "Checking permissions",
  "يتم تحميل جلسة الحساب وقراءة الدور من جدول الأدوار.":
    "Loading the account session and reading the role from the role table.",
  "لوحة الإدارة مرتبطة بالصلاحيات": "Admin dashboard is permission based",
  "تعذر عرض لوحة المالك التشغيلية الآن. التصفح العام يبقى متاحاً.":
    "Could not show the operational owner dashboard right now. Public browsing remains available.",
  "يجب تسجيل الدخول أولاً، ثم يتم التحقق من دور المالك من جدول الأدوار.":
    "Log in first, then the owner role is checked from the role table.",
  "غير مخوّل": "Not authorized",
  "هذه المساحة مخصّصة لمالك المنصة فقط. الصلاحية تُقرأ من جدول الأدوار ولا تُمنح من الواجهة.":
    "This area is only for the platform owner. Permission is read from the role table and is not granted by the frontend.",
  "العودة للرئيسية": "Back to home",
  "لوحة إدارة لصاحب التطبيق والمشرفين. الحسابات والأدوار تُقرأ من مصدر الصلاحيات، وإجراءات الإدارة محمية بالصلاحيات وسجل النشاط.":
    "An admin dashboard for the app owner and moderators. Accounts and roles are read from the permission source, and admin actions are protected by permissions and the activity log.",
  "صاحب التطبيق": "App owner",
  "مركز تحكم المالك": "Owner control center",
  "هذه لوحة المالك لعرض سير العمل المحلي، والصلاحيات تُدار من مصدر الأدوار.":
    "This owner dashboard shows the local workflow, and permissions are managed from the role source.",
  "صلاحيات كاملة": "Full permissions",
  "كل الصلاحيات": "All permissions",
  "مؤشرات المالك": "Owner metrics",
  "إجراءات المالك فقط": "Owner-only actions",
  "مصفوفة الصلاحيات": "Permission matrix",
  الصلاحية: "Permission",
  "مساحة عمل المشرف": "Moderator workspace",
  مشرف: "Admin",
  "صلاحيات المشرف يحددها صاحب التطبيق. لا يمكن للمشرف إدارة المالك أو تجاوز صلاحياته.":
    "Moderator permissions are set by the app owner. Moderators cannot manage the owner or exceed their permissions.",
  "ما يمكن للمشرف فعله": "What a moderator can do",
  "ما يتطلب صلاحية المالك": "What requires owner permission",
  "إدارة المشرفين": "Manage admins",
  "إدارة المشرفين متاحة للمالك فقط وفق صلاحيات الحساب.":
    "Admin management is available only to the owner according to account permissions.",
  "إدارة تمييز الإعلانات": "Manage featured listings",
  "سجل نشاط المالك": "Owner activity log",
  "إعدادات المالك": "Owner settings",
  "إعدادات المالك — محمي بالصلاحيات": "Owner settings - permission protected",
  "محمي بالصلاحيات": "Permission protected",
  "عرض ربط الحسابات في الملف الشخصي": "View account connection in profile",
  "إعلانات حقيقية قيد المراجعة": "Real listings pending review",
  "طابور المراجعة الحقيقي يُقرأ من مصدر البيانات للمالك فقط. إجراءات القبول/الرفض الحقيقية يجب أن تبقى محمية بسياسات RLS ولا تعتمد على البريد.":
    "The real review queue is read from the data source for the owner only. Real approve/reject actions must remain protected by RLS policies and must not rely on email.",
  "تعذر تحديد حساب المراجع الحالي. أعد تسجيل الدخول ثم حاول مجدداً.":
    "Could not identify the current reviewer account. Log in again and try once more.",
  "تم اعتماد الإعلان.": "Listing approved.",
  "تم رفض الإعلان.": "Listing rejected.",
  "المشرفون يمكنهم مراجعة الطابور حسب صلاحياتهم فقط. قبول/رفض الإعلانات الحقيقي يتطلب ربطاً تشغيلياً وصلاحيات وربط حسابات.":
    "Moderators can review the queue only within their permissions. Real approve/reject actions require operational integration, permissions, and accounts.",
  "ملخص البلاغات": "Reports summary",
  "البلاغات الحقيقية تُقرأ من مصدر البيانات للمالك فقط. أي إجراء تشغيلي يجب أن يبقى محمياً بالصلاحيات وسجل النشاط.":
    "Real reports are read from the data source for the owner only. Any operational action must remain protected by permissions and activity logs.",
  "تم تحديث البلاغ.": "Report updated.",
  "جارٍ تحميل البلاغات.": "Loading reports.",
  "تعذر تحميل البلاغات الآن. حاول مرة أخرى.": "Could not load reports right now. Try again.",
  "لا توجد بلاغات حقيقية حالياً.": "There are no real reports right now.",
  "رقم البلاغ:": "Report ID:",
  "الإعلان:": "Listing:",
  "المبلّغ:": "Reporter:",
  "تم الحل": "Resolved",
  "رفض البلاغ": "Reject report",
  "جارٍ تجهيز لوحة المستخدمين...": "Preparing the users dashboard...",
  "تعذر تحميل بيانات المستخدمين": "Could not load user data",
  "لا توجد بيانات مستخدمين حقيقية حالياً. ستظهر هنا بيانات المستخدمين بعد اكتمال ربط الحسابات والصلاحيات.":
    "There is no real user data right now. User data will appear here after accounts and permissions are integrated.",
  "ملخص المستخدمين": "Users summary",
  "جدول التحكم بالمستخدمين": "User control table",
  "طلبات توثيق وتمييز البائعين": "Seller verification and featuring requests",
  "إدارة المشرفين داخل صفحة المستخدمين": "Admin management inside users page",
  "ملخص طلبات الترويج": "Promotion requests summary",
  "مراجعة طلبات الترويج وإثبات الدفع": "Review promotion requests and payment proof",
  "إدارة حالة تمييز الإعلانات": "Manage featured listing status",
  "ملاحظة داخلية": "Internal note",
  "إضافة ملاحظة · عند توفرها": "Add note · when available",
  مسموح: "Allowed",
  "غير مسموح": "Not allowed",
  "حسب الصلاحية": "By permission",
};
