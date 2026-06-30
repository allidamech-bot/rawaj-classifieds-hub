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
  misc: { ar: "المزيد", en: "More", hintEn: "General listings" },
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
  if (!id) return fallback ?? localized(language, "سوريا", "Syria");
  const label = governorateLabels[id];
  if (!label) return fallback ?? localized(language, "سوريا", "Syria");
  return language === "ar" ? label.ar : label.en;
}

const arNumber = new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 });
const enNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatPriceLocalized(
  price: number,
  type: PriceType | string,
  language: Language,
  currency: "SYP" | "USD" = "SYP",
) {
  const number = language === "ar" ? arNumber.format(price) : enNumber.format(price);
  const currencyLabel = currency === "SYP" ? localized(language, "ل.س", "SYP") : "$";
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
  "المفضلة الحقيقية مرتبطة بحسابك فقط ولا توجد مفضلة تجريبية كبديل.":
    "Real favorites are linked only to your account. No demo favorites are used as a substitute.",
  "تسجيل الدخول": "Log in",
  "المفضلة قيد التفعيل": "Favorites are being activated",
  "حفظ الإعلانات سيعمل مع الحسابات بعد اكتمال التفعيل. يمكنك تصفح الإعلانات حالياً والعودة للمفضلة قريباً.":
    "Saving listings will work with accounts after activation. You can browse listings now and return to favorites soon.",
  "تصفح الإعلانات": "Browse listings",
  "هذه الصفحة تعرض الإعلانات التي يحفظها الحساب الحالي فقط، ولا تستخدم بيانات تجريبية كبديل.":
    "This page shows listings saved by the current account only and does not use demo data as a substitute.",
  "جارٍ تحميل المفضلة": "Loading favorites",
  "تعذر تحميل المفضلة": "Could not load favorites",
  "المفضلة قيد التفعيل حالياً. حاول لاحقاً أو تابع تصفح الإعلانات.":
    "Favorites are being activated. Try again later or keep browsing listings.",
  "لا توجد إعلانات في المفضلة": "No favorite listings yet",
  "احفظ الإعلانات المعتمدة التي تهمك لتعود إليها لاحقاً.":
    "Save approved listings you care about so you can return to them later.",
  "إعلان محفوظ": "Saved listing",
  "رقم الإعلان:": "Listing ID:",
  فتح: "Open",
  "إزالة من المفضلة": "Remove from favorites",
  "أضف إعلاناً": "Post a listing",
  "عمليات البحث المحفوظة": "Saved searches",
  "عمليات البحث المحفوظة مرتبطة بحسابك فقط ولا توجد بيانات تجريبية بديلة.":
    "Saved searches are linked only to your account. No demo data is used as a substitute.",
  "البحث المحفوظ قيد التفعيل": "Saved search is being activated",
  "حفظ عمليات البحث سيعمل مع الحسابات بعد اكتمال التفعيل. يمكنك استخدام فلاتر التصفح حالياً.":
    "Saving searches will work with accounts after activation. You can use browse filters now.",
  "ابدأ البحث": "Start searching",
  "تعرض هذه الصفحة عمليات البحث المحفوظة للحساب الحالي فقط، ولا تستخدم بيانات تجريبية كبديل.":
    "This page shows saved searches for the current account only and does not use demo data as a substitute.",
  "جارٍ تحميل عمليات البحث": "Loading saved searches",
  "تعذر تحميل عمليات البحث": "Could not load saved searches",
  "البحث المحفوظ قيد التفعيل حالياً. استخدم صفحة التصفح للبحث مباشرة.":
    "Saved search is being activated. Use the browse page to search directly.",
  "لا توجد عمليات بحث محفوظة": "No saved searches yet",
  "يمكن إضافة زر حفظ البحث لاحقاً بعد اعتماد تجربة البحث النهائية.":
    "A save-search button can be added later after the final search experience is approved.",
  "مرتبطة بالحساب الحالي فقط": "Linked only to the current account",
  "تنبيهات قريباً": "Alerts soon",
  "فتح البحث": "Open search",
  "تصفح الأقسام": "Browse categories",
  بائع: "Seller",
  "هذا البائع غير متاح حالياً.": "This seller is not available right now.",
  خطأ: "Error",
  "إعادة المحاولة": "Try again",
  "ملف البائع": "Seller profile",
  "ملف البائع العام قيد التجهيز حالياً. هذه واجهة تمهيدية فقط وتستخدم بيانات تجريبية للاطلاع على التصميم النهائي.":
    "The public seller profile is being prepared. This is a preparatory interface using demo data to preview the final design.",
  "ملف البائع العام قيد التجهيز حالياً. عند التفعيل ستظهر البيانات العامة والإعلانات المعتمدة فقط دون كشف أي بيانات خاصة.":
    "The public seller profile is being prepared. When enabled, only public data and approved listings will appear without exposing private data.",
  "جارٍ التحقق من الجلسة...": "Checking session...",
  موثّق: "Verified",
  "تقييم تجريبي": "Demo rating",
  منذ: "Since",
  إعلان: "listings",
  "غير مفعّل": "Disabled",
  "رسالة · قريباً": "Message · soon",
  "اتصال · قريباً": "Call · soon",
  "واتساب · قريباً": "WhatsApp · soon",
  "وسائل التواصل ستظهر فقط حسب إعدادات البائع بعد تفعيل الحسابات.":
    "Contact methods will appear only according to seller settings after accounts are enabled.",
  "نبذة عن البائع": "About the seller",
  "لم يضف البائع نبذة بعد. ستظهر هنا معلومات النشاط، ساعات التوفر، ومدة الاستجابة لاحقاً.":
    "The seller has not added a bio yet. Business info, availability, and response time will appear here later.",
  "وقت الاستجابة:": "Response time:",
  "الموقع:": "Location:",
  سوريا: "Syria",
  "الإعلانات النشطة": "Active listings",
  "نموذج عرض · ليست بيانات إنتاجية": "Demo preview · not production data",
  "لا توجد إعلانات نشطة لهذا البائع حالياً.": "This seller has no active listings right now.",
  "تنبيه أمان": "Safety note",
  "قابل البائع في مكان عام وآمن، وافحص السلعة قبل الدفع. لا تحوّل المال قبل التأكد.":
    "Meet the seller in a public, safe place, and inspect the item before paying. Do not transfer money before verifying.",
  "إبلاغ · قريباً": "Report · soon",
  "حظر · قريباً": "Block · soon",
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
  "لوحة الإدارة قيد التفعيل": "Admin dashboard is being activated",
  "لا يمكن عرض لوحة المالك التشغيلية قبل اكتمال ربط الحسابات. التصفح العام يبقى متاحاً.":
    "The operational owner dashboard cannot be shown before account integration is complete. Public browsing remains available.",
  "يجب تسجيل الدخول أولاً، ثم يتم التحقق من دور المالك من جدول الأدوار.":
    "Log in first, then the owner role is checked from the role table.",
  "غير مخوّل": "Not authorized",
  "هذه المساحة مخصّصة لمالك المنصة فقط. الصلاحية تُقرأ من جدول الأدوار ولا تُمنح من الواجهة.":
    "This area is only for the platform owner. Permission is read from the role table and is not granted by the frontend.",
  "العودة للرئيسية": "Back to home",
  "لوحة إدارة مستقبلية لصاحب التطبيق والمشرفين. الحسابات والأدوار تُقرأ من مصدر الصلاحيات، ومعظم إجراءات الإدارة ما زالت غير مفعّلة أو بانتظار اكتمال الربط التشغيلي.":
    "A future admin dashboard for the app owner and moderators. Accounts and roles are read from the permission source, and most admin actions remain disabled or awaiting operational integration.",
  "نموذج تجريبي · غير مفعّل حالياً · يتطلب ربطاً تشغيلياً وصلاحيات حقيقية لاحقاً":
    "Demo model · currently disabled · requires operational integration and real permissions later",
  "صاحب التطبيق": "App owner",
  "مركز تحكم المالك": "Owner control center",
  "هذه لوحة المالك كنموذج تجريبي — سيتم تفعيل الصلاحيات عند اكتمال ربط الحسابات والأنظمة التشغيلية.":
    "This owner dashboard is a demo model. Permissions will be activated when accounts and operational systems are complete.",
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
  "إدارة المشرفين متاحة للمالك فقط عند تفعيل الحسابات والصلاحيات.":
    "Admin management is available only to the owner after accounts and permissions are enabled.",
  "إدارة تمييز الإعلانات": "Manage featured listings",
  "سجل نشاط المالك": "Owner activity log",
  "سجل النشاط تجريبي — سيتم تسجيل كل إجراء إداري لاحقاً في قاعدة البيانات.":
    "The activity log is demo-only. Each admin action will later be recorded in the database.",
  "إعدادات المالك": "Owner settings",
  "إعدادات المالك — غير مفعّلة حالياً": "Owner settings - currently disabled",
  "غير مفعّل حالياً": "Currently disabled",
  "كل الأزرار والإجراءات داخل لوحة المالك/الإدارة معطّلة ومعلّمة كنموذج تجريبي. المستخدمون العاديون لا يظهر لهم وصول إداري حقيقي الآن.":
    "All buttons and actions in the owner/admin dashboard are disabled and marked as demo. Regular users do not receive real admin access now.",
  "عرض ربط الحسابات في الملف الشخصي": "View account connection in profile",
  "إعلانات حقيقية قيد المراجعة": "Real listings pending review",
  "طابور المراجعة الحقيقي يُقرأ من مصدر البيانات للمالك فقط. إجراءات القبول/الرفض الحقيقية يجب أن تبقى محمية بسياسات RLS ولا تعتمد على البريد.":
    "The real review queue is read from the data source for the owner only. Real approve/reject actions must remain protected by RLS policies and must not rely on email.",
  "تعذر تحديد حساب المراجع الحالي. أعد تسجيل الدخول ثم حاول مجدداً.":
    "Could not identify the current reviewer account. Log in again and try once more.",
  "تم اعتماد الإعلان.": "Listing approved.",
  "تم رفض الإعلان.": "Listing rejected.",
  "جارٍ تحميل طابور المراجعة الحقيقي.": "Loading the real review queue.",
  "طابور المراجعة قيد التفعيل حالياً. ستظهر الإعلانات المرسلة للمراجعة هنا عند اكتمال الربط.":
    "The review queue is being activated. Listings submitted for review will appear here after integration is complete.",
  "لا توجد إعلانات حقيقية قيد المراجعة حالياً.": "No real listings are pending review right now.",
  "صاحب الإعلان:": "Listing owner:",
  "تاريخ الإرسال:": "Submitted:",
  "سبب الرفض عند الحاجة": "Rejection reason if needed",
  اعتماد: "Approve",
  رفض: "Reject",
  "القائمة التالية نموذج UI تجريبي فقط وليست طابور إنتاج.":
    "The following list is a demo UI only, not a production queue.",
  "قيد المراجعة": "Under review",
  "المشرفون يمكنهم مراجعة الطابور حسب صلاحياتهم فقط. قبول/رفض الإعلانات الحقيقي يتطلب ربطاً تشغيلياً وصلاحيات وربط حسابات.":
    "Moderators can review the queue only within their permissions. Real approve/reject actions require operational integration, permissions, and accounts.",
  "ملخص البلاغات": "Reports summary",
  "بلاغات حقيقية": "Real reports",
  "البلاغات الحقيقية تُقرأ من مصدر البيانات للمالك فقط. أي إجراء لاحق يجب أن يبقى محمياً بالصلاحيات وسجل النشاط.":
    "Real reports are read from the data source for the owner only. Any future action must remain protected by permissions and activity logs.",
  "تم تحديث البلاغ.": "Report updated.",
  "جارٍ تحميل البلاغات.": "Loading reports.",
  "البلاغات الحقيقية قيد التفعيل حالياً. ستظهر البلاغات هنا عند اكتمال الربط التشغيلي.":
    "Real reports are being activated. Reports will appear here after operational integration is complete.",
  "لا توجد بلاغات حقيقية حالياً.": "There are no real reports right now.",
  "رقم البلاغ:": "Report ID:",
  "الإعلان:": "Listing:",
  "المبلّغ:": "Reporter:",
  "تم الحل": "Resolved",
  "رفض البلاغ": "Reject report",
  "القائمة التالية نموذج UI تجريبي فقط وليست بلاغات إنتاج.":
    "The following list is demo UI only, not production reports.",
  "إدارة المستخدمين نموذج تجريبي فقط. الحذف/التعطيل يحتاج صلاحية المالك. التجميد والتوثيق والتميز إجراءات تجريبية حالياً.":
    "User management is demo-only. Deletion/disablement requires owner permission. Freeze, verification, and featuring are currently demo actions.",
  "جارٍ تجهيز لوحة المستخدمين...": "Preparing the users dashboard...",
  "تعذر تحميل بيانات المستخدمين": "Could not load user data",
  "لا توجد بيانات مستخدمين حقيقية حالياً. ستظهر هنا بيانات المستخدمين بعد اكتمال ربط الحسابات والصلاحيات.":
    "There is no real user data right now. User data will appear here after accounts and permissions are integrated.",
  "ملخص المستخدمين": "Users summary",
  "فلاتر تجريبية": "Demo filters",
  "جدول التحكم بالمستخدمين": "User control table",
  "طلبات توثيق وتمييز البائعين": "Seller verification and featuring requests",
  "لا يوجد رفع ملفات حقيقي. تسميات المستندات تجريبية فقط.":
    "There is no real file upload. Document labels are demo-only.",
  "إدارة المشرفين داخل صفحة المستخدمين": "Admin management inside users page",
  "لا توجد قاعدة بيانات أو صلاحيات أو حذف حقيقي في هذه الصفحة.":
    "There is no real database action, permission change, or deletion on this page.",
  "ملخص طلبات الترويج": "Promotion requests summary",
  "مراجعة طلبات الترويج وإثبات الدفع": "Review promotion requests and payment proof",
  "إدارة حالة تمييز الإعلانات": "Manage featured listing status",
  "لا توجد معالجة دفع حقيقية حالياً. تفاصيل التحويل وإثبات الدفع حقول تجريبية فقط.":
    "There is no real payment processing now. Transfer details and payment proof are demo fields only.",
  "ملاحظة داخلية": "Internal note",
  "إضافة ملاحظة · قريباً": "Add note · soon",
  "الملاحظات الداخلية لا تظهر للمستخدمين.": "Internal notes are not visible to users.",
  "نموذج تجريبي": "Demo",
  قريباً: "Soon",
  مسموح: "Allowed",
  "غير مسموح": "Not allowed",
  "حسب الصلاحية": "By permission",
};
