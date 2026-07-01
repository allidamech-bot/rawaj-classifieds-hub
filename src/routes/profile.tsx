import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  Bookmark,
  Camera,
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
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  deleteOwnerListing,
  createSellerVerificationRequest,
  fetchCurrentUserListings,
  fetchMyVerificationRequests,
  removeProfileMedia,
  resubmitOwnerListing,
  updateOwnProfileBasics,
  uploadProfileMedia,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  SellerVerificationRequest,
  VerificationRequestType,
} from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { listingStatusLabel } from "@/lib/status-labels";
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
  const [settingsFirstName, setSettingsFirstName] = useState("");
  const [settingsLastName, setSettingsLastName] = useState("");
  const [settingsGovernorate, setSettingsGovernorate] = useState("");
  const [settingsCityArea, setSettingsCityArea] = useState("");
  const [settingsBio, setSettingsBio] = useState("");
  const [settingsBusinessName, setSettingsBusinessName] = useState("");
  const [settingsPhone, setSettingsPhone] = useState("");
  const [settingsWhatsapp, setSettingsWhatsapp] = useState("");
  const [settingsPreferredContact, setSettingsPreferredContact] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [mediaSaving, setMediaSaving] = useState<"avatar" | "cover" | null>(null);
  const [verificationRequests, setVerificationRequests] = useState<SellerVerificationRequest[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationType, setVerificationType] = useState<VerificationRequestType>("personal");
  const [verificationLegalName, setVerificationLegalName] = useState("");
  const [verificationBusinessName, setVerificationBusinessName] = useState("");
  const [verificationDocumentType, setVerificationDocumentType] = useState("");
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState("");
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
      firstName: settingsFirstName,
      lastName: settingsLastName,
      displayName: settingsDisplayName || null,
      governorate: settingsGovernorate || null,
      cityArea: settingsCityArea || null,
      bio: settingsBio || null,
      businessName: settingsBusinessName || null,
      phone: settingsPhone || null,
      whatsapp: settingsWhatsapp || null,
      preferredContactMethod: settingsPreferredContact || null,
    });
    setSettingsSaving(false);
    setSettingsNotice(
      result.ok
        ? text("تم حفظ بيانات الحساب الأساسية.", "Account basics saved.")
        : result.error.message,
    );
  }

  async function handleProfileMedia(kind: "avatar" | "cover", file: File | undefined) {
    if (!file) return;
    setSettingsNotice("");
    setMediaSaving(kind);
    const result = await uploadProfileMedia({
      userId: profileId ?? null,
      kind,
      file,
      oldPath: kind === "avatar" ? auth.profile?.avatarPath : auth.profile?.coverPath,
    });
    setMediaSaving(null);
    setSettingsNotice(
      result.ok
        ? text(
            "تم حفظ الصورة. أعد تحميل الصفحة إذا لم تظهر فورا.",
            "Image saved. Refresh if it does not appear immediately.",
          )
        : result.error.message,
    );
  }

  async function handleRemoveProfileMedia(kind: "avatar" | "cover") {
    setSettingsNotice("");
    setMediaSaving(kind);
    const result = await removeProfileMedia(
      profileId ?? null,
      kind,
      kind === "avatar" ? auth.profile?.avatarPath : auth.profile?.coverPath,
    );
    setMediaSaving(null);
    setSettingsNotice(
      result.ok
        ? text("تمت إزالة الصورة من الملف.", "Image removed from profile.")
        : result.error.message,
    );
  }

  async function loadVerificationRequests() {
    if (!profileId) return;
    setVerificationLoading(true);
    const result = await fetchMyVerificationRequests(profileId);
    if (result.ok) setVerificationRequests(result.data);
    else setVerificationNotice(result.error.message);
    setVerificationLoading(false);
  }

  async function handleVerificationRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerificationNotice("");
    setVerificationSaving(true);
    const result = await createSellerVerificationRequest({
      userId: profileId ?? null,
      requestType: verificationType,
      legalName: verificationLegalName,
      businessName: verificationBusinessName || null,
      documentType: verificationDocumentType || null,
    });
    setVerificationSaving(false);
    if (result.ok) {
      setVerificationLegalName("");
      setVerificationBusinessName("");
      setVerificationDocumentType("");
      setVerificationNotice(
        text("تم إرسال طلب التوثيق للمراجعة.", "Verification request sent for review."),
      );
      await loadVerificationRequests();
    } else {
      setVerificationNotice(result.error.message);
    }
  }

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    setSettingsDisplayName(auth.profile?.displayName ?? "");
    setSettingsFirstName(
      auth.profile?.firstName ?? auth.profile?.displayName?.split(" ").filter(Boolean).at(0) ?? "",
    );
    setSettingsLastName(
      auth.profile?.lastName ??
        auth.profile?.displayName?.split(" ").filter(Boolean).slice(1).join(" ") ??
        "",
    );
    setSettingsGovernorate(auth.profile?.governorate ?? "");
    setSettingsCityArea(auth.profile?.cityArea ?? "");
    setSettingsBio(auth.profile?.bio ?? "");
    setSettingsBusinessName(auth.profile?.businessName ?? "");
    setSettingsPhone(auth.profile?.phone ?? "");
    setSettingsWhatsapp(auth.profile?.whatsapp ?? "");
    setSettingsPreferredContact(auth.profile?.preferredContactMethod ?? "");
  }, [auth.profile, auth.status]);

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

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) return;
    void loadVerificationRequests();
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
              <div className="grid gap-3 sm:grid-cols-2">
                <SettingsInput
                  label={text("المدينة / المنطقة", "City / area")}
                  value={settingsCityArea}
                  onChange={setSettingsCityArea}
                  maxLength={80}
                />
                <SettingsInput
                  label={text("اسم النشاط التجاري", "Business name")}
                  value={settingsBusinessName}
                  onChange={setSettingsBusinessName}
                  maxLength={120}
                />
              </div>
              <label className="block">
                <span className="text-xs font-bold text-muted-foreground">
                  {text("نبذة عنك", "Bio")}
                </span>
                <textarea
                  value={settingsBio}
                  onChange={(event) => setSettingsBio(event.target.value)}
                  maxLength={600}
                  rows={4}
                  className="mt-1 w-full rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <SettingsInput
                  label={text("الهاتف", "Phone")}
                  value={settingsPhone}
                  onChange={setSettingsPhone}
                  maxLength={40}
                />
                <SettingsInput
                  label={text("واتساب", "WhatsApp")}
                  value={settingsWhatsapp}
                  onChange={setSettingsWhatsapp}
                  maxLength={40}
                />
                <SettingsInput
                  label={text("طريقة التواصل المفضلة", "Preferred contact")}
                  value={settingsPreferredContact}
                  onChange={setSettingsPreferredContact}
                  maxLength={40}
                />
              </div>
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

        <section id="settings" className="rounded-2xl bg-card p-4 hairline">
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
                            loading="lazy"
                            decoding="async"
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
                              {listingStatusLabel(listing.status, language)}
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
              <div className="grid gap-3 lg:grid-cols-2">
                <MediaField
                  title={text("الصورة الشخصية", "Profile image")}
                  imageUrl={auth.profile?.avatarUrl}
                  busy={mediaSaving === "avatar"}
                  onUpload={(file) => void handleProfileMedia("avatar", file)}
                  onRemove={() => void handleRemoveProfileMedia("avatar")}
                />
                <MediaField
                  title={text("صورة الغلاف", "Cover image")}
                  imageUrl={auth.profile?.coverUrl}
                  busy={mediaSaving === "cover"}
                  wide
                  onUpload={(file) => void handleProfileMedia("cover", file)}
                  onRemove={() => void handleRemoveProfileMedia("cover")}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SettingsInput
                  label={text("الاسم الأول", "First name")}
                  value={settingsFirstName}
                  onChange={setSettingsFirstName}
                  maxLength={40}
                />
                <SettingsInput
                  label={text("اسم العائلة", "Last name")}
                  value={settingsLastName}
                  onChange={setSettingsLastName}
                  maxLength={40}
                />
              </div>
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
              <div className="rounded-xl bg-destructive/5 p-3 text-xs leading-6 text-muted-foreground hairline">
                <p className="font-bold text-foreground">
                  {text("حذف الحساب", "Account deletion")}
                </p>
                <p>
                  {text(
                    "الحذف النهائي غير مفعل من الواجهة لأنه يحتاج مسار Auth وقاعدة بيانات وتنظيف ملفات آمن. يمكن إرسال طلب مراجعة عبر الدعم.",
                    "Permanent deletion is not enabled here because it needs a safe Auth, database, and media cleanup process. You can request review through support.",
                  )}
                </p>
                <Link
                  to="/support"
                  className="mt-2 inline-flex rounded-lg bg-card px-3 py-1.5 font-bold hairline"
                >
                  {text("طلب حذف الحساب", "Request deletion")}
                </Link>
              </div>
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
          {auth.status === "signedIn" ? (
            <div className="space-y-3">
              <p className="text-xs leading-6 text-muted-foreground">
                {text(
                  "يظهر شارة التوثيق فقط بعد موافقة إدارية حقيقية. رفع الوثائق الخاصة مؤجل حتى اعتماد bucket خاص وآمن.",
                  "Verified status appears only after real admin approval. Private document upload is deferred until a reviewed private bucket is available.",
                )}
              </p>
              <div className="rounded-xl bg-card p-3 text-xs hairline">
                <p className="font-bold">
                  {text("حالة التوثيق الحالية", "Current verification status")}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {auth.profile?.verificationStatus ?? "unverified"}
                </p>
              </div>
              <form
                onSubmit={(event) => void handleVerificationRequest(event)}
                className="grid gap-3"
              >
                <label className="block">
                  <span className="text-xs font-bold text-muted-foreground">
                    {text("نوع الطلب", "Request type")}
                  </span>
                  <select
                    value={verificationType}
                    onChange={(event) =>
                      setVerificationType(event.target.value as VerificationRequestType)
                    }
                    className="mt-1 w-full rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline"
                  >
                    <option value="personal">{text("شخصي", "Personal")}</option>
                    <option value="business">{text("نشاط تجاري", "Business")}</option>
                  </select>
                </label>
                <SettingsInput
                  label={text("الاسم القانوني", "Legal name")}
                  value={verificationLegalName}
                  onChange={setVerificationLegalName}
                  maxLength={120}
                />
                <SettingsInput
                  label={text("اسم النشاط إن وجد", "Business name if any")}
                  value={verificationBusinessName}
                  onChange={setVerificationBusinessName}
                  maxLength={120}
                />
                <SettingsInput
                  label={text("نوع المستند بدون رفع ملف", "Document type without upload")}
                  value={verificationDocumentType}
                  onChange={setVerificationDocumentType}
                  maxLength={80}
                />
                <button
                  type="submit"
                  disabled={verificationSaving || verificationLegalName.trim().length < 3}
                  className="rounded-xl bg-emerald-trust px-4 py-2 text-xs font-bold text-emerald-trust-foreground disabled:opacity-60"
                >
                  {verificationSaving
                    ? text("جارٍ الإرسال", "Sending")
                    : text("إرسال طلب توثيق", "Request verification")}
                </button>
              </form>
              <div className="rounded-xl bg-muted-surface p-3 text-xs leading-6">
                <p className="font-bold">{text("طلباتك", "Your requests")}</p>
                {verificationLoading ? (
                  <p className="text-muted-foreground">{text("جارٍ التحميل", "Loading")}</p>
                ) : verificationRequests.length === 0 ? (
                  <p className="text-muted-foreground">
                    {text("لا توجد طلبات توثيق بعد.", "No verification requests yet.")}
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {verificationRequests.slice(0, 3).map((request) => (
                      <div key={request.id} className="rounded-lg bg-card p-2 hairline">
                        <p className="font-bold">{request.legalName}</p>
                        <p className="text-muted-foreground">{request.status}</p>
                        {request.adminNote && (
                          <p className="text-muted-foreground">{request.adminNote}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {verificationNotice && (
                <p className="rounded-xl bg-muted-surface p-3 text-center text-xs font-semibold">
                  {verificationNotice}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs leading-6 text-muted-foreground">
              {text("سجل الدخول لطلب توثيق الحساب.", "Log in to request account verification.")}
            </p>
          )}
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

function SettingsInput({
  label,
  value,
  onChange,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        className="mt-1 w-full rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline"
      />
    </label>
  );
}

function MediaField({
  title,
  imageUrl,
  busy,
  wide = false,
  onUpload,
  onRemove,
}: {
  title: string;
  imageUrl?: string | null;
  busy: boolean;
  wide?: boolean;
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl bg-muted-surface p-3 hairline">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground">{title}</span>
        {busy && <span className="text-[10px] font-bold text-primary">Saving</span>}
      </div>
      <div
        className={`grid place-items-center overflow-hidden rounded-xl bg-card ${
          wide ? "aspect-[5/2]" : "aspect-square"
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <Camera className="h-6 w-6 text-muted-foreground" />
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-card px-3 py-1.5 text-[11px] font-bold hairline">
          <Camera className="h-3.5 w-3.5" />
          Upload
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(event) => onUpload(event.target.files?.[0])}
          />
        </label>
        {imageUrl && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg bg-card px-3 py-1.5 text-[11px] font-bold text-destructive hairline disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
