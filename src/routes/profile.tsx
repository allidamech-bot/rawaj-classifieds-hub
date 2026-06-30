import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  ChevronLeft,
  FileSpreadsheet,
  FileText,
  Heart,
  LifeBuoy,
  Lock,
  LogIn,
  LogOut,
  MessageCircle,
  Plus,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  UserCog,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { demoNotice } from "@/data/adminMockData";
import { fetchCurrentUserListings } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError, ListingStatus } from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "حسابي | رَوَاج" }] }),
  component: ProfilePage,
});

const accountMenu = [
  { to: "/profile", label: "إعلاناتي", icon: FileSpreadsheet },
  { to: "/add-listing", label: "إضافة إعلان", icon: Plus },
  { to: "/favorites", label: "المفضلة", icon: Heart },
  { to: "/saved-searches", label: "عمليات البحث المحفوظة", icon: Bookmark },
  { to: "/chats", label: "الرسائل", icon: MessageCircle, badge: "قريباً" },
  { to: "/promotion", label: "الترويج والتمييز", icon: Sparkles, badge: "قريباً" },
  {
    to: "/admin",
    label: "لوحة الإدارة — تظهر فقط للحسابات المخوّلة لاحقاً",
    icon: UserCog,
    badge: "نموذج تجريبي",
  },
  { to: "/support", label: "الدعم والمساعدة", icon: LifeBuoy },
  { to: "/safety", label: "نصائح الأمان", icon: ShieldAlert },
  { to: "/terms", label: "شروط الاستخدام", icon: FileText },
  { to: "/privacy", label: "سياسة الخصوصية", icon: ShieldCheck },
];

const accountLevels = [
  ["مستخدم عادي", "تصفح وحفظ وإضافة إعلانات لاحقاً"],
  ["بائع", "حساب يملك إعلانات منشورة"],
  ["بائع موثّق", "توثيق تجريبي يحتاج ربطاً تشغيلياً لاحقاً"],
  ["متجر", "واجهة بائع تجارية ضمن سوريا"],
  ["نشاط تجاري", "حساب أعمال قيد التجهيز"],
  ["مشرف", "صلاحيات إدارية يحددها المالك لاحقاً"],
  ["مالك المنصة", "أعلى مستوى صلاحيات في RAWAJ"],
];

const settings = [
  ["المعلومات الشخصية", User],
  ["بيانات التواصل", MessageCircle],
  ["الخصوصية", Lock],
  ["الإشعارات", Bell],
  ["إعدادات البائع/المتجر", Store],
  ["توثيق الحساب", BadgeCheck],
  ["إعدادات الحساب", Settings],
];

function ProfilePage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [logoutError, setLogoutError] = useState("");
  const [myListings, setMyListings] = useState<ClassifiedListing[]>([]);
  const [myListingsError, setMyListingsError] = useState<ClassifiedsError | null>(null);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const profileId = auth.profile?.id;
  const displayName = auth.profile?.displayName || auth.profile?.email || text("زائر", "Guest");
  const authNote =
    auth.status === "authUnavailable"
      ? text(
          "الحسابات قيد التفعيل حالياً — يبقى رَوَاج متاحاً للتصفح كواجهة بيتا.",
          "Accounts are being activated - RAWAJ remains browsable as a beta interface.",
        )
      : auth.status === "loading"
        ? text("جاري تحميل جلسة الحساب.", "Loading account session.")
        : auth.status === "authError"
          ? text(
              "حدث خطأ أثناء قراءة بيانات الحساب أو الصلاحيات.",
              "Could not read account or permission data.",
            )
          : auth.status === "signedIn"
            ? text(
                "تم تحميل جلسة الحساب. الصلاحيات تظهر فقط إذا كانت محفوظة في جدول الأدوار.",
                "Account session loaded. Permissions appear only when stored in the role table.",
              )
            : text(
                "أنت غير مسجل الدخول حالياً. صلاحيات الإدارة تظهر فقط بعد تسجيل الدخول وقراءة الدور من جدول الأدوار.",
                "You are not logged in. Admin permissions appear only after login and role-table lookup.",
              );

  async function handleLogout() {
    setLogoutError("");
    const result = await auth.signOut();
    if (result.error) setLogoutError(result.error);
  }

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) return;
    const currentProfileId = profileId;

    let cancelled = false;

    async function loadListings() {
      setMyListingsLoading(true);
      setMyListingsError(null);
      const result = await fetchCurrentUserListings(currentProfileId);

      if (cancelled) return;

      if (!result.ok) {
        setMyListings([]);
        setMyListingsError(result.error);
      } else {
        setMyListings(result.data);
      }

      setMyListingsLoading(false);
    }

    void loadListings();

    return () => {
      cancelled = true;
    };
  }, [auth.status, profileId]);

  return (
    <>
      <PageHeader title={text("حسابي", "My account")} back={false} />
      <main className="container-wide pt-4 pb-10 space-y-5">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-foreground/10">
              <User className="h-6 w-6 text-gold" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold">{displayName}</h2>
              <p className="text-xs text-primary-foreground/80">{authNote}</p>
            </div>
          </div>
          {auth.status === "signedIn" ? (
            <div className="mt-4">
              <button
                onClick={handleLogout}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-foreground/10 px-3 py-2 text-xs font-bold"
              >
                <LogOut className="h-4 w-4" /> {text("تسجيل الخروج", "Log out")}
              </button>
              {logoutError && <p className="mt-2 text-xs text-gold">{logoutError}</p>}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold px-3 py-2 text-xs font-bold text-gold-foreground"
              >
                <LogIn className="h-4 w-4" /> {text("تسجيل الدخول", "Log in")}
              </Link>
              <button
                disabled
                className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-xl bg-primary-foreground/10 px-3 py-2 text-xs font-bold opacity-70"
              >
                <UserPlus className="h-4 w-4" />{" "}
                {text("إنشاء حساب · لاحقاً", "Create account · later")}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-card p-4 hairline">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold">
              {text("مستويات الحساب في RAWAJ", "RAWAJ account levels")}
            </h3>
            <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
              {demoNotice}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {accountLevels.map(([level, note]) => (
              <div key={level} className="rounded-xl bg-muted-surface p-3">
                <div className="text-sm font-extrabold">{profileText(level, language)}</div>
                <p className="mt-1 text-xs text-muted-foreground">{profileText(note, language)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-warning/10 p-4 hairline">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
            <UserCog className="h-4 w-4 text-warning" />
            {text("لوحة الإدارة", "Admin dashboard")}
          </h3>
          <p className="text-xs text-foreground/90">
            {text(
              "لوحة الإدارة — تظهر فقط للحسابات المخوّلة لاحقاً. لا يتم منح أي مستخدم صلاحيات من الواجهة؛ الصلاحيات يجب أن تأتي من role محفوظ في قاعدة البيانات.",
              "The admin dashboard appears only for authorized accounts. No user receives permissions from the frontend; permissions must come from a role stored in the database.",
            )}
          </p>
          {auth.status === "authUnavailable" && (
            <p className="mt-2 rounded-xl bg-card p-2 text-[11px] text-muted-foreground hairline">
              {text(
                "الحسابات قيد التفعيل حالياً، لذلك تبقى لوحة الإدارة واجهة تمهيدية فقط حتى اكتمال الربط التشغيلي.",
                "Accounts are being activated, so the admin area remains a preparatory interface until operational integration is complete.",
              )}
            </p>
          )}
          {auth.status === "signedIn" && (
            <p className="mt-2 rounded-xl bg-card p-2 text-[11px] text-muted-foreground hairline">
              {text("الدور الحالي من جدول الأدوار:", "Current role from role table:")}{" "}
              {auth.profile?.role ?? text("غير محدد", "Not set")} ·{" "}
              {text("الوصول الإداري:", "Admin access:")}{" "}
              {auth.canAccessAdmin
                ? text("مسموح حسب الدور", "Allowed by role")
                : text("غير مسموح", "Not allowed")}
            </p>
          )}
          {auth.canAccessOwnerControls && (
            <Link
              to="/admin"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-bold hairline"
            >
              {text("عرض لوحة المالك", "Open owner dashboard")}
              <ChevronLeft className="h-4 w-4" />
            </Link>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-extrabold">{text("قائمة الحساب", "Account menu")}</h3>
          <nav className="overflow-hidden rounded-2xl bg-card hairline">
            {accountMenu
              .filter((it) => it.to !== "/admin" || auth.canAccessOwnerControls)
              .map((it, i) => (
                <Link
                  key={it.to}
                  to={it.to as "/"}
                  className={`flex items-center gap-3 p-4 transition hover:bg-muted-surface ${i !== 0 ? "border-t border-border" : ""}`}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted-surface text-primary">
                    <it.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">
                    {profileText(it.label, language)}
                  </span>
                  {it.badge && (
                    <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {profileText(it.badge, language)}
                    </span>
                  )}
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
          </nav>
        </section>

        {auth.status === "signedIn" && (
          <section className="rounded-2xl bg-card p-4 hairline">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold">{text("إعلاناتي", "My listings")}</h3>
              <Link to="/add-listing" className="text-xs font-bold text-primary">
                {text("إضافة إعلان", "Post listing")}
              </Link>
            </div>
            {myListingsLoading ? (
              <p className="text-xs text-muted-foreground">
                {text(
                  "جارٍ تحميل إعلاناتك المرتبطة بالحساب.",
                  "Loading listings linked to your account.",
                )}
              </p>
            ) : myListingsError ? (
              <p className="text-xs text-muted-foreground">{myListingsError.message}</p>
            ) : myListings.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {text(
                  "لا توجد إعلانات مرتبطة بحسابك حالياً.",
                  "No listings are linked to your account yet.",
                )}
              </p>
            ) : (
              <div className="space-y-2">
                {myListings.slice(0, 8).map((listing) => (
                  <Link
                    key={listing.id}
                    to="/listings/$id"
                    params={{ id: listing.id }}
                    className="block rounded-xl bg-muted-surface p-3 transition hover:bg-secondary"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold">{listing.title}</span>
                      <span className="rounded-md bg-card px-2 py-0.5 text-[10px] font-bold hairline">
                        {statusLabel(listing.status, language)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {categoryName(
                        listing.categoryId,
                        listing.categoryNameAr ?? undefined,
                        language,
                      )}{" "}
                      ·{" "}
                      {governorateName(
                        listing.governorateId,
                        listing.governorateNameAr ?? undefined,
                        language,
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-extrabold">{text("إعدادات الحساب", "Account settings")}</h3>
            <span className="text-[10px] text-muted-foreground">
              {text("جميع الخيارات قريباً", "All options coming soon")}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {settings.map(([label, Icon]) => (
              <button
                key={label as string}
                disabled
                className="flex items-center justify-between rounded-2xl bg-card p-4 hairline opacity-80 cursor-not-allowed"
              >
                <span className="inline-flex items-center gap-2 text-sm font-bold">
                  <Icon className="h-4 w-4 text-primary" />
                  {profileText(label as string, language)}
                </span>
                <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {text("قريباً", "Soon")}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-card-warm p-4 hairline">
          <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-extrabold">
            <BadgeCheck className="h-4 w-4 text-emerald-trust" />
            {text("توثيق الحساب", "Account verification")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {text(
              "التوثيق وميزات المتاجر وإدارة المشرفين غير مفعّلة حالياً. سيتم ربطها لاحقاً بالحسابات، الحسابات والصلاحيات وقيود الأمان التشغيلية.",
              "Verification, store features, and moderator management are not enabled yet. They will be connected later to accounts, permissions, and operational safety controls.",
            )}
          </p>
          <button
            disabled
            className="mt-3 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold text-muted-foreground cursor-not-allowed"
          >
            {text("طلب التوثيق · قريباً", "Request verification · soon")}
          </button>
        </section>
      </main>
    </>
  );
}

function statusLabel(status: ListingStatus, language: Language) {
  switch (status) {
    case "draft":
      return language === "ar" ? "مسودة" : "Draft";
    case "pending_review":
      return language === "ar" ? "قيد المراجعة" : "Pending review";
    case "approved":
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

function profileText(value: string | undefined, language: Language) {
  if (!value || language === "ar") return value ?? "";
  const labels: Record<string, string> = {
    إعلاناتي: "My listings",
    "إضافة إعلان": "Post listing",
    المفضلة: "Favorites",
    "عمليات البحث المحفوظة": "Saved searches",
    الرسائل: "Chats",
    "الترويج والتمييز": "Promotion and featuring",
    "لوحة الإدارة — تظهر فقط للحسابات المخوّلة لاحقاً":
      "Admin dashboard - only for authorized accounts later",
    "الدعم والمساعدة": "Support and help",
    "نصائح الأمان": "Safety tips",
    "شروط الاستخدام": "Terms of use",
    "سياسة الخصوصية": "Privacy policy",
    قريباً: "Soon",
    "نموذج تجريبي": "Demo",
    "مستخدم عادي": "Regular user",
    "تصفح وحفظ وإضافة إعلانات لاحقاً": "Browse, save, and post listings later",
    بائع: "Seller",
    "حساب يملك إعلانات منشورة": "Account with published listings",
    "بائع موثّق": "Verified seller",
    "توثيق تجريبي يحتاج ربطاً تشغيلياً لاحقاً":
      "Demo verification that needs operational integration later",
    متجر: "Store",
    "واجهة بائع تجارية ضمن سوريا": "Commercial seller profile within Syria",
    "نشاط تجاري": "Business account",
    "حساب أعمال قيد التجهيز": "Business account in preparation",
    مشرف: "Moderator",
    "صلاحيات إدارية يحددها المالك لاحقاً": "Admin permissions defined by the owner later",
    "مالك المنصة": "Platform owner",
    "أعلى مستوى صلاحيات في RAWAJ": "Highest RAWAJ permission level",
    "المعلومات الشخصية": "Personal information",
    "بيانات التواصل": "Contact details",
    الخصوصية: "Privacy",
    الإشعارات: "Notifications",
    "إعدادات البائع/المتجر": "Seller/store settings",
    "توثيق الحساب": "Account verification",
    "إعدادات الحساب": "Account settings",
  };
  return labels[value] ?? value;
}
