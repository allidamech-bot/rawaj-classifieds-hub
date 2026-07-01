import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  Bookmark,
  ChevronLeft,
  Eye,
  FileSpreadsheet,
  FileText,
  Heart,
  LifeBuoy,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserCog,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  deleteOwnerListing,
  fetchCurrentUserListings,
  resubmitOwnerListing,
  updateOwnProfileBasics,
} from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError, ListingStatus } from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "حسابي | رواج" }] }),
  component: ProfileRoute,
});

const accountMenu = [
  { to: "/profile/listings", labelAr: "إعلاناتي", labelEn: "My listings", icon: FileSpreadsheet },
  { to: "/add-listing", labelAr: "إضافة إعلان", labelEn: "Post listing", icon: Plus },
  { to: "/favorites", labelAr: "المفضلة", labelEn: "Favorites", icon: Heart },
  {
    to: "/saved-searches",
    labelAr: "عمليات البحث المحفوظة",
    labelEn: "Saved searches",
    icon: Bookmark,
  },
  {
    to: "/promotion",
    labelAr: "الترويج والتمييز",
    labelEn: "Promotion and featuring",
    icon: Sparkles,
  },
  {
    to: "/admin",
    labelAr: "لوحة الإدارة",
    labelEn: "Admin dashboard",
    icon: UserCog,
    ownerOnly: true,
  },
  { to: "/support", labelAr: "الدعم والمساعدة", labelEn: "Support and help", icon: LifeBuoy },
  { to: "/safety", labelAr: "نصائح الأمان", labelEn: "Safety tips", icon: ShieldAlert },
  { to: "/terms", labelAr: "شروط الاستخدام", labelEn: "Terms of use", icon: FileText },
  { to: "/privacy", labelAr: "سياسة الخصوصية", labelEn: "Privacy policy", icon: ShieldCheck },
] satisfies Array<{
  to: string;
  labelAr: string;
  labelEn: string;
  icon: typeof User;
  ownerOnly?: boolean;
}>;

function ProfileRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/profile" && pathname !== "/profile/") {
    return <Outlet />;
  }

  return <ProfilePage />;
}

function ProfilePage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [logoutError, setLogoutError] = useState("");
  const [myListings, setMyListings] = useState<ClassifiedListing[]>([]);
  const [myListingsError, setMyListingsError] = useState<ClassifiedsError | null>(null);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [listingActionLoading, setListingActionLoading] = useState<string | null>(null);
  const [listingActionNotice, setListingActionNotice] = useState("");
  const [settingsDisplayName, setSettingsDisplayName] = useState("");
  const [settingsGovernorate, setSettingsGovernorate] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState("");
  const profileId = auth.profile?.id;
  const displayName = auth.profile?.displayName || auth.profile?.email || text("زائر", "Guest");

  async function reloadListings() {
    if (!profileId) return;
    const result = await fetchCurrentUserListings(profileId);
    if (result.ok) setMyListings(result.data);
    else {
      setMyListings([]);
      setMyListingsError(result.error);
    }
  }

  async function handleLogout() {
    setLogoutError("");
    const result = await auth.signOut();
    if (result.error) setLogoutError(result.error);
  }

  async function handleResubmit(listingId: string) {
    setListingActionLoading(listingId);
    setListingActionNotice("");
    const result = await resubmitOwnerListing(profileId ?? null, listingId);
    setListingActionLoading(null);
    if (result.ok) {
      setListingActionNotice(
        text("تمت إعادة إرسال الإعلان للمراجعة.", "Listing resubmitted for review."),
      );
      void reloadListings();
    } else {
      setListingActionNotice(result.error.message);
    }
  }

  async function handleDelete(listingId: string) {
    if (!confirm(text("حذف الإعلان نهائيا؟", "Delete this listing permanently?"))) return;
    setListingActionLoading(listingId);
    setListingActionNotice("");
    const result = await deleteOwnerListing(profileId ?? null, listingId);
    setListingActionLoading(null);
    if (result.ok) {
      setListingActionNotice(text("تم حذف الإعلان.", "Listing deleted."));
      void reloadListings();
    } else {
      setListingActionNotice(result.error.message);
    }
  }

  async function handleSaveProfileBasics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsNotice("");
    setSettingsSaving(true);
    const result = await updateOwnProfileBasics(profileId ?? null, {
      displayName: settingsDisplayName,
      governorate: settingsGovernorate || null,
    });
    setSettingsSaving(false);
    setSettingsNotice(
      result.ok
        ? text("تم حفظ بيانات الحساب الأساسية.", "Account basics saved.")
        : result.error.message,
    );
  }

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    setSettingsDisplayName(auth.profile?.displayName ?? "");
    setSettingsGovernorate(auth.profile?.governorate ?? "");
  }, [auth.profile?.displayName, auth.profile?.governorate, auth.status]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) return;
    let cancelled = false;
    async function loadListings() {
      setMyListingsLoading(true);
      setMyListingsError(null);
      await reloadListings();
      if (!cancelled) setMyListingsLoading(false);
    }
    void loadListings();
    return () => {
      cancelled = true;
    };
  }, [auth.status, profileId]);

  const authNote =
    auth.status === "loading"
      ? text("جاري تحميل جلسة الحساب.", "Loading account session.")
      : auth.status === "authError"
        ? text(
            "تعذرت قراءة بيانات الحساب أو الصلاحيات.",
            "Could not read account or permission data.",
          )
        : auth.status === "signedIn"
          ? text(
              "جلسة الحساب جاهزة والصلاحيات تقرأ من مصدر الأدوار.",
              "Account session is ready, and permissions are read from the role source.",
            )
          : text(
              "تصفح رواج متاح، وسجل الدخول لإدارة إعلاناتك وحفظ تفضيلاتك.",
              "RAWAJ browsing is available; log in to manage listings and saved preferences.",
            );

  return (
    <>
      <PageHeader title={text("حسابي", "My account")} back={false} />
      <main className="container-wide space-y-5 pt-4 pb-10">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-foreground/10">
              <User className="h-6 w-6 text-gold" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold">{displayName}</h2>
              <p className="text-xs leading-6 text-primary-foreground/80">{authNote}</p>
            </div>
          </div>
          {auth.status === "signedIn" ? (
            <div className="mt-4">
              <button
                type="button"
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
                type="button"
                onClick={() =>
                  setNotice(
                    text(
                      "تجهيز الحساب يتم عبر مسار تسجيل الدخول المتاح.",
                      "Account access is handled through the available login flow.",
                    ),
                  )
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-foreground/10 px-3 py-2 text-xs font-bold"
              >
                <UserPlus className="h-4 w-4" /> {text("إعداد حساب", "Set up account")}
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-card p-4 hairline">
          <h3 className="mb-3 text-sm font-extrabold">{text("ملخص الحساب", "Account summary")}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label={text("الإعلانات", "Listings")} value={String(myListings.length)} />
            <Metric
              label={text("الدور", "Role")}
              value={auth.profile?.role ?? text("مستخدم", "User")}
            />
            <Metric
              label={text("الحالة", "Status")}
              value={auth.profile?.accountStatus ?? text("جاهز للتصفح", "Browse ready")}
            />
            <Metric
              label={text("الوصول الإداري", "Admin access")}
              value={auth.canAccessAdmin ? text("مسموح", "Allowed") : text("لا يوجد", "None")}
            />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-extrabold">{text("قائمة الحساب", "Account menu")}</h3>
          <nav className="overflow-hidden rounded-2xl bg-card hairline">
            {accountMenu
              .filter((item) => !item.ownerOnly || auth.canAccessAdmin)
              .map((item, index) => (
                <Link
                  key={item.to}
                  to={item.to as "/"}
                  className={`flex items-center gap-3 p-4 transition hover:bg-muted-surface ${index !== 0 ? "border-t border-border" : ""}`}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted-surface text-primary">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">
                    {language === "ar" ? item.labelAr : item.labelEn}
                  </span>
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
                {text("جاري تحميل إعلاناتك.", "Loading your listings.")}
              </p>
            ) : myListingsError ? (
              <p className="text-xs text-muted-foreground">{myListingsError.message}</p>
            ) : myListings.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {text(
                  "لا توجد إعلانات مرتبطة بحسابك الآن.",
                  "No listings are linked to your account now.",
                )}
              </p>
            ) : (
              <div className="space-y-2">
                {myListings.slice(0, 8).map((listing) => {
                  const busy = listingActionLoading === listing.id;
                  const canModify =
                    listing.status === "draft" ||
                    listing.status === "pending_review" ||
                    listing.status === "rejected";

                  return (
                    <div
                      key={listing.id}
                      className="rounded-xl bg-muted-surface p-3 transition hover:bg-secondary"
                    >
                      <div className="flex items-start gap-3">
                        {listing.primaryImageUrl ? (
                          <img
                            src={listing.primaryImageUrl}
                            alt={listing.title}
                            className="h-16 w-20 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-20 items-center justify-center rounded-lg bg-card text-[9px] text-muted-foreground">
                            {text("بدون صورة", "No photo")}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
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
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                            {listing.price !== null && (
                              <span className="font-semibold text-foreground">
                                {listing.price} {listing.currency}
                              </span>
                            )}
                            <span>
                              {text("أنشئ", "Created")}{" "}
                              {new Date(listing.createdAt).toLocaleDateString(
                                language === "ar" ? "ar-SY" : "en-US",
                                {
                                  dateStyle: "short",
                                },
                              )}
                            </span>
                          </div>
                          {listing.rejectionReason && (
                            <p className="mt-1 text-[10px] text-destructive">
                              {listing.rejectionReason}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Link
                              to="/listings/$id"
                              params={{ id: listing.id }}
                              className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-[10px] font-bold hairline transition hover:bg-secondary"
                            >
                              <Eye className="h-3 w-3" />
                              {text("عرض", "View")}
                            </Link>
                            {canModify && (
                              <Link
                                to="/profile/listings/$id"
                                params={{ id: listing.id }}
                                className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-[10px] font-bold hairline transition hover:bg-secondary"
                              >
                                <Pencil className="h-3 w-3" />
                                {text("تعديل", "Edit")}
                              </Link>
                            )}
                            {(listing.status === "draft" || listing.status === "rejected") && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleResubmit(listing.id)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-[10px] font-bold hairline transition hover:bg-secondary disabled:opacity-50"
                                >
                                  <RefreshCcw className="h-3 w-3" />
                                  {text("إعادة إرسال", "Resubmit")}
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => handleDelete(listing.id)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-[10px] font-bold hairline transition hover:bg-destructive/5 hover:text-destructive disabled:opacity-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  {text("حذف", "Delete")}
                                </button>
                              </>
                            )}
                            {listing.status === "approved" && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 text-[10px] text-muted-foreground hairline">
                                {text(
                                  "الإعلان المعتمد يظهر للزوار ولا يتم تعديله من هذه القائمة.",
                                  "Approved listings are visible to visitors and are not edited from this list.",
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {listingActionNotice && (
              <p className="mt-3 rounded-xl bg-muted-surface p-3 text-center text-xs font-semibold text-foreground">
                {listingActionNotice}
              </p>
            )}
          </section>
        )}

        <section className="rounded-2xl bg-card p-4 hairline">
          <h3 className="mb-2 text-sm font-extrabold">
            {text("إعدادات الحساب", "Account settings")}
          </h3>
          {auth.status === "signedIn" ? (
            <form onSubmit={(event) => void handleSaveProfileBasics(event)} className="space-y-3">
              <label className="block">
                <span className="text-xs font-bold text-muted-foreground">
                  {text("اسم العرض", "Display name")}
                </span>
                <input
                  value={settingsDisplayName}
                  onChange={(event) => setSettingsDisplayName(event.target.value)}
                  maxLength={80}
                  className="mt-1 w-full rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold text-muted-foreground">
                  {text("المحافظة", "Governorate")}
                </span>
                <input
                  value={settingsGovernorate}
                  onChange={(event) => setSettingsGovernorate(event.target.value)}
                  maxLength={80}
                  className="mt-1 w-full rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline"
                />
              </label>
              <p className="text-[11px] leading-5 text-muted-foreground">
                {text(
                  "لا يتم تعديل البريد أو حالة الحساب أو التوثيق من هذه المساحة.",
                  "Email, account status, and verification are not changed here.",
                )}
              </p>
              <button
                type="submit"
                disabled={settingsSaving}
                className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
              >
                {settingsSaving ? text("جار الحفظ", "Saving") : text("حفظ البيانات", "Save basics")}
              </button>
              {settingsNotice && (
                <p className="rounded-xl bg-muted-surface p-3 text-center text-xs font-semibold text-foreground">
                  {settingsNotice}
                </p>
              )}
            </form>
          ) : (
            <p className="text-xs leading-6 text-muted-foreground">
              {text(
                "سجل الدخول لتحديث بيانات الحساب الأساسية المخزنة في ملفك.",
                "Log in to update the account basics stored on your profile.",
              )}
            </p>
          )}
        </section>

        <section className="rounded-2xl bg-card-warm p-4 hairline">
          <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-extrabold">
            <BadgeCheck className="h-4 w-4 text-emerald-trust" />
            {text("توثيق الحساب", "Account verification")}
          </h3>
          <p className="text-xs leading-6 text-muted-foreground">
            {text(
              "أي موافقة فعلية على التوثيق تبقى خاضعة لمراجعة المالك والصلاحيات المحمية.",
              "Any real verification approval remains subject to owner review and protected permissions.",
            )}
          </p>
        </section>

        {notice && (
          <p className="rounded-2xl bg-emerald-trust/10 p-3 text-center text-xs font-bold text-emerald-trust hairline">
            {notice}
          </p>
        )}
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted-surface p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
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
