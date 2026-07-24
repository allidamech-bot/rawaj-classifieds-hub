import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  BadgeCheck,
  Camera,
  FileSpreadsheet,
  KeyRound,
  LockKeyhole,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  AccountIdentityHero,
  AccountQuickLinks,
  AccountSection,
  accountSectionIcons,
} from "@/features/account/AccountExperience";
import {
  changeOwnPassword,
  createAccountDeletionRequest,
  fetchCurrentUserListings,
  fetchMyVerificationRequests,
  removeProfileMedia,
  updateOwnProfileBasics,
  uploadProfileMedia,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  SellerVerificationRequest,
} from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { listingStatusLabel } from "@/lib/status-labels";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "حسابي | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ProfileRoute,
});

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
  const [loggingOut, setLoggingOut] = useState(false);
  const [myListings, setMyListings] = useState<ClassifiedListing[]>([]);
  const [myListingsError, setMyListingsError] = useState<ClassifiedsError | null>(null);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [myListingsHasLoaded, setMyListingsHasLoaded] = useState(false);
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletionSaving, setDeletionSaving] = useState(false);
  const [deletionNotice, setDeletionNotice] = useState("");
  const [mediaSaving, setMediaSaving] = useState<"avatar" | "cover" | null>(null);
  const [verificationRequests, setVerificationRequests] = useState<SellerVerificationRequest[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationHasLoaded, setVerificationHasLoaded] = useState(false);
  const [verificationError, setVerificationError] = useState<ClassifiedsError | null>(null);
  const listingsRequestIdRef = useRef(0);
  const verificationRequestIdRef = useRef(0);
  const loadedProfileIdRef = useRef<string | null>(null);
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  const settingsSavingProfilesRef = useRef<Set<string>>(new Set());
  const passwordSavingProfilesRef = useRef<Set<string>>(new Set());
  const deletionSavingProfilesRef = useRef<Set<string>>(new Set());
  const mediaSavingProfilesRef = useRef<Set<string>>(new Set());
  const logoutInFlightRef = useRef(false);
  profileIdRef.current = profileId;
  const displayName = auth.profile?.displayName || auth.profile?.email || text("زائر", "Guest");
  const recentListings = myListings.slice(0, 3);

  useEffect(() => {
    if (window.location.hash !== "#account-info") return;
    window.setTimeout(() => {
      document.getElementById("account-info")?.scrollIntoView({ block: "start" });
    }, 80);
  }, []);

  const reloadListings = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++listingsRequestIdRef.current;
    setMyListingsLoading(true);
    setMyListingsError(null);
    try {
      const result = await fetchCurrentUserListings(currentProfileId);
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      if (result.ok) {
        setMyListings(result.data);
        setMyListingsHasLoaded(true);
      } else {
        setMyListingsError(result.error);
      }
    } catch (caught) {
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      setMyListingsError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل إعلاناتك.", "Could not load your listings."),
        operation: "profile_listings_load",
      });
    } finally {
      if (requestId === listingsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setMyListingsLoading(false);
      }
    }
  }, [profileId, text]);

  const loadVerificationRequests = useCallback(async () => {
    if (!profileId) return;
    const currentProfileId = profileId;
    const requestId = ++verificationRequestIdRef.current;
    setVerificationLoading(true);
    setVerificationError(null);
    try {
      const result = await fetchMyVerificationRequests();
      if (
        requestId !== verificationRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      )
        return;
      if (result.ok) {
        setVerificationRequests(result.data);
        setVerificationHasLoaded(true);
      } else {
        setVerificationError(result.error);
      }
    } catch (caught) {
      if (
        requestId !== verificationRequestIdRef.current ||
        currentProfileId !== profileIdRef.current
      )
        return;
      setVerificationError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل طلبات التوثيق.", "Could not load verification requests."),
        operation: "profile_verification_load",
      });
    } finally {
      if (
        requestId === verificationRequestIdRef.current &&
        currentProfileId === profileIdRef.current
      ) {
        setVerificationLoading(false);
      }
    }
  }, [profileId, text]);

  async function handleLogout() {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const result = await auth.signOut();
      if (result.error) setLogoutError(result.error);
    } catch (caught) {
      setLogoutError(
        caught instanceof Error ? caught.message : text("تعذر تسجيل الخروج.", "Could not log out."),
      );
    } finally {
      logoutInFlightRef.current = false;
      setLoggingOut(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentProfileId = profileId;
    if (!currentProfileId || passwordSavingProfilesRef.current.has(currentProfileId)) return;

    setPasswordNotice("");
    if (newPassword.length < 8) {
      setPasswordNotice(
        text(
          "كلمة المرور يجب أن تكون 8 أحرف على الأقل.",
          "Password must be at least 8 characters.",
        ),
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice(text("كلمتا المرور غير متطابقتين.", "Passwords do not match."));
      return;
    }

    passwordSavingProfilesRef.current.add(currentProfileId);
    setPasswordSaving(true);
    try {
      const result = await changeOwnPassword(currentPassword, newPassword);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setPasswordNotice(result.error.message);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice(text("تم تغيير كلمة المرور بنجاح.", "Password changed successfully."));
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setPasswordNotice(
          caught instanceof Error
            ? caught.message
            : text("تعذر تغيير كلمة المرور.", "Could not change the password."),
        );
      }
    } finally {
      passwordSavingProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setPasswordSaving(false);
    }
  }

  async function handleAccountDeletionRequest() {
    const currentProfileId = profileId;
    if (!currentProfileId || deletionSavingProfilesRef.current.has(currentProfileId)) return;

    deletionSavingProfilesRef.current.add(currentProfileId);
    setDeletionSaving(true);
    setDeletionNotice("");
    try {
      const result = await createAccountDeletionRequest();
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setDeletionNotice(result.error.message);
        return;
      }
      setDeleteConfirmOpen(false);
      setDeletionNotice(
        text(
          "تم تسجيل طلب حذف الحساب. ستراجعه الإدارة قبل تنفيذ الحذف الآمن.",
          "Your account deletion request was recorded and will be reviewed before secure deletion.",
        ),
      );
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setDeletionNotice(
          caught instanceof Error
            ? caught.message
            : text("تعذر تسجيل طلب حذف الحساب.", "Could not record the account deletion request."),
        );
      }
    } finally {
      deletionSavingProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setDeletionSaving(false);
    }
  }

  async function handleSaveProfileBasics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentProfileId = profileId;
    if (!currentProfileId || settingsSavingProfilesRef.current.has(currentProfileId)) return;

    const payload = {
      firstName: settingsFirstName.trim(),
      lastName: settingsLastName.trim(),
      displayName: settingsDisplayName.trim() || null,
      governorate: settingsGovernorate.trim() || null,
      cityArea: settingsCityArea.trim() || null,
      bio: settingsBio.trim() || null,
      businessName: settingsBusinessName.trim() || null,
      phone: settingsPhone.trim() || null,
      whatsapp: settingsWhatsapp.trim() || null,
      preferredContactMethod: settingsPreferredContact.trim() || null,
    };
    settingsSavingProfilesRef.current.add(currentProfileId);
    setSettingsNotice("");
    setSettingsSaving(true);
    try {
      const result = await updateOwnProfileBasics(payload);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setSettingsNotice(result.error.message);
        return;
      }
      const refreshResult = await auth.refreshProfile();
      if (currentProfileId !== profileIdRef.current) return;
      setSettingsNotice(
        refreshResult.error
          ? text(
              "تم الحفظ، لكن تعذر تحديث العرض فوراً. أعد فتح الصفحة عند الحاجة.",
              "Saved, but the view could not refresh immediately. Reopen the page if needed.",
            )
          : text("تم حفظ معلومات الحساب وتحديثها.", "Account information saved and refreshed."),
      );
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setSettingsNotice(
          caught instanceof Error
            ? caught.message
            : text("تعذر حفظ معلومات الحساب.", "Could not save account information."),
        );
      }
    } finally {
      settingsSavingProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setSettingsSaving(false);
    }
  }

  async function handleProfileMedia(kind: "avatar" | "cover", file: File | undefined) {
    const currentProfileId = profileId;
    if (!file || !currentProfileId || mediaSavingProfilesRef.current.has(currentProfileId)) return;

    mediaSavingProfilesRef.current.add(currentProfileId);
    setSettingsNotice("");
    setMediaSaving(kind);
    try {
      const result = await uploadProfileMedia({
        kind,
        file,
      });
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setSettingsNotice(result.error.message);
        return;
      }
      const refreshResult = await auth.refreshProfile();
      if (currentProfileId !== profileIdRef.current) return;
      setSettingsNotice(
        refreshResult.error
          ? text(
              "تم حفظ الصورة، لكن تعذر تحديث العرض فوراً.",
              "Image saved, but the view could not refresh immediately.",
            )
          : text("تم حفظ الصورة وتحديث الحساب.", "Image saved and account refreshed."),
      );
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setSettingsNotice(
          caught instanceof Error
            ? caught.message
            : text("تعذر رفع صورة الحساب.", "Could not upload the account image."),
        );
      }
    } finally {
      mediaSavingProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setMediaSaving(null);
    }
  }

  async function handleRemoveProfileMedia(kind: "avatar" | "cover") {
    const currentProfileId = profileId;
    if (!currentProfileId || mediaSavingProfilesRef.current.has(currentProfileId)) return;

    mediaSavingProfilesRef.current.add(currentProfileId);
    setSettingsNotice("");
    setMediaSaving(kind);
    try {
      const result = await removeProfileMedia(kind);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setSettingsNotice(result.error.message);
        return;
      }
      const refreshResult = await auth.refreshProfile();
      if (currentProfileId !== profileIdRef.current) return;
      setSettingsNotice(
        refreshResult.error
          ? text(
              "تمت إزالة الصورة، لكن تعذر تحديث العرض فوراً.",
              "Image removed, but the view could not refresh immediately.",
            )
          : text("تمت إزالة الصورة وتحديث الحساب.", "Image removed and account refreshed."),
      );
    } catch (caught) {
      if (currentProfileId === profileIdRef.current) {
        setSettingsNotice(
          caught instanceof Error
            ? caught.message
            : text("تعذر إزالة صورة الحساب.", "Could not remove the account image."),
        );
      }
    } finally {
      mediaSavingProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setMediaSaving(null);
    }
  }

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      loadedProfileIdRef.current = null;
      setSettingsDisplayName("");
      setSettingsFirstName("");
      setSettingsLastName("");
      setSettingsGovernorate("");
      setSettingsCityArea("");
      setSettingsBio("");
      setSettingsBusinessName("");
      setSettingsPhone("");
      setSettingsWhatsapp("");
      setSettingsPreferredContact("");
      setSettingsSaving(false);
      setSettingsNotice("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaving(false);
      setPasswordNotice("");
      setDeleteConfirmOpen(false);
      setDeletionSaving(false);
      setDeletionNotice("");
      setMediaSaving(null);
      return;
    }

    const accountChanged = loadedProfileIdRef.current !== profileId;
    loadedProfileIdRef.current = profileId;
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
    if (accountChanged) {
      setSettingsSaving(false);
      setSettingsNotice("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaving(false);
      setPasswordNotice("");
      setDeleteConfirmOpen(false);
      setDeletionSaving(false);
      setDeletionNotice("");
      setMediaSaving(null);
    }
  }, [auth.profile, auth.status, profileId]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      listingsRequestIdRef.current += 1;
      setMyListings([]);
      setMyListingsLoading(false);
      setMyListingsHasLoaded(false);
      setMyListingsError(null);
      return;
    }

    listingsRequestIdRef.current += 1;
    setMyListings([]);
    setMyListingsLoading(false);
    setMyListingsHasLoaded(false);
    setMyListingsError(null);
    void reloadListings();

    return () => {
      listingsRequestIdRef.current += 1;
    };
  }, [auth.status, profileId, reloadListings]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      verificationRequestIdRef.current += 1;
      setVerificationRequests([]);
      setVerificationLoading(false);
      setVerificationHasLoaded(false);
      setVerificationError(null);
      return;
    }

    verificationRequestIdRef.current += 1;
    setVerificationRequests([]);
    setVerificationLoading(false);
    setVerificationHasLoaded(false);
    setVerificationError(null);
    void loadVerificationRequests();

    return () => {
      verificationRequestIdRef.current += 1;
    };
  }, [auth.status, loadVerificationRequests, profileId]);

  return (
    <>
      <PageHeader title={text("حسابي", "My account")} to="/more" backMode="history" />
      <main className="rawaj-account-v2 rawaj-account-hub-v3 container-wide mobile-page-bottom space-y-5 pb-8 pt-4">
        <AccountIdentityHero
          displayName={displayName}
          email={auth.profile?.email}
          avatarUrl={auth.profile?.avatarUrl}
          coverUrl={auth.profile?.coverUrl}
          location={auth.profile?.cityArea || auth.profile?.governorate}
          roleLabel={roleLabel(auth.profile?.role, text)}
          statusLabel={accountStatusLabel(auth.profile?.accountStatus, text)}
          verified={auth.profile?.verificationStatus === "verified"}
          signedIn={auth.status === "signedIn"}
          actions={
            auth.status === "signedIn" ? (
              <>
                <a href="#account-info">
                  <Pencil className="h-4 w-4" />
                  {text("تعديل الحساب", "Edit account")}
                </a>
                <Link to="/profile/listings">
                  <FileSpreadsheet className="h-4 w-4" />
                  {text("إعلاناتي", "My listings")}
                </Link>
                <Link to="/verification">
                  <BadgeCheck className="h-4 w-4" />
                  {text("التوثيق", "Verification")}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  aria-busy={loggingOut}
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? text("جارٍ الخروج", "Logging out") : text("خروج", "Log out")}
                </button>
              </>
            ) : (
              <Link to="/login">
                <LogIn className="h-4 w-4" />
                {text("تسجيل الدخول", "Log in")}
              </Link>
            )
          }
        />
        {logoutError ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-xs text-destructive">{logoutError}</p>
        ) : null}
        {auth.status === "signedIn" ? <AccountQuickLinks /> : null}

        <AccountSection
          id="account-info"
          eyebrow={text("الهوية والتواصل", "Identity and contact")}
          title={text("معلومات الحساب", "Account information")}
          description={text(
            "حدّث هوية حسابك ومعلوماته. تظهر واجهة المتجر العامة والإعلانات في مساحة منفصلة.",
            "Update your account identity and details. Your public store and listings live in a separate workspace.",
          )}
          icon={accountSectionIcons.identity}
        >
          {auth.status === "signedIn" ? (
            <form
              onSubmit={(event) => void handleSaveProfileBasics(event)}
              aria-busy={settingsSaving}
              className="space-y-4"
            >
              <div className="rounded-2xl bg-muted-surface p-3 hairline">
                <h3 className="mb-3 text-sm font-extrabold">
                  {text("صور الحساب", "Account photos")}
                </h3>
                <div className="grid gap-3 md:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
                  <MediaField
                    title={text("الصورة الشخصية", "Profile image")}
                    helper={text(
                      "يمكنك اختيار صورة من الجهاز.",
                      "Choose an image from your device.",
                    )}
                    imageUrl={auth.profile?.avatarUrl}
                    busy={mediaSaving === "avatar"}
                    text={text}
                    onUpload={(file) => void handleProfileMedia("avatar", file)}
                    onRemove={() => void handleRemoveProfileMedia("avatar")}
                  />
                  <MediaField
                    title={text("صورة الغلاف", "Cover image")}
                    helper={text(
                      "يمكنك اختيار صورة من الجهاز.",
                      "Choose an image from your device.",
                    )}
                    imageUrl={auth.profile?.coverUrl}
                    busy={mediaSaving === "cover"}
                    text={text}
                    wide
                    onUpload={(file) => void handleProfileMedia("cover", file)}
                    onRemove={() => void handleRemoveProfileMedia("cover")}
                  />
                </div>
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
                <SettingsInput
                  label={text("اسم العرض", "Display name")}
                  value={settingsDisplayName}
                  onChange={setSettingsDisplayName}
                  maxLength={80}
                />
                <SettingsInput
                  label={text("المحافظة", "Governorate")}
                  value={settingsGovernorate}
                  onChange={setSettingsGovernorate}
                  maxLength={80}
                />
                <SettingsInput
                  label={text("المدينة / المنطقة", "City / area")}
                  value={settingsCityArea}
                  onChange={setSettingsCityArea}
                  maxLength={120}
                />
                <SettingsInput
                  label={text("اسم المنشأة", "Business name")}
                  value={settingsBusinessName}
                  onChange={setSettingsBusinessName}
                  maxLength={120}
                />
                <SettingsInput
                  label={text("الهاتف", "Phone")}
                  value={settingsPhone}
                  onChange={setSettingsPhone}
                  maxLength={40}
                  inputMode="tel"
                />
                <SettingsInput
                  label={text("واتساب", "WhatsApp")}
                  value={settingsWhatsapp}
                  onChange={setSettingsWhatsapp}
                  maxLength={40}
                  inputMode="tel"
                />
                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    {text("طريقة التواصل المفضلة", "Preferred contact method")}
                  </span>
                  <select
                    value={settingsPreferredContact}
                    onChange={(event) => setSettingsPreferredContact(event.target.value)}
                    className="input mt-1"
                  >
                    <option value="">{text("اختر طريقة التواصل", "Choose contact method")}</option>
                    <option value="phone">{text("الهاتف", "Phone")}</option>
                    <option value="whatsapp">{text("واتساب", "WhatsApp")}</option>
                    <option value="messages">{text("رسائل رواج", "RAWAJ messages")}</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    {text("نبذة قصيرة", "Short bio")}
                  </span>
                  <textarea
                    value={settingsBio}
                    onChange={(event) => setSettingsBio(event.target.value)}
                    maxLength={500}
                    rows={4}
                    className="input mt-1 min-h-28"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                >
                  {settingsSaving
                    ? text("جارٍ الحفظ", "Saving")
                    : text("حفظ معلومات الحساب", "Save account information")}
                </button>
                {settingsNotice && (
                  <p className="rounded-xl bg-muted-surface p-3 text-xs font-semibold text-foreground">
                    {settingsNotice}
                  </p>
                )}
              </div>
            </form>
          ) : (
            <p className="rounded-xl bg-muted-surface p-3 text-xs leading-6 text-muted-foreground">
              {text("سجّل الدخول لتحديث معلومات الحساب.", "Log in to update account information.")}
            </p>
          )}
        </AccountSection>

        <AccountSection
          eyebrow={text("الأمان والخصوصية", "Security and privacy")}
          title={text("حماية الحساب والتحكم بالبيانات", "Account protection and data control")}
          description={text(
            "غيّر كلمة المرور وراجع طريقة ظهور بيانات التواصل واطلب حذف الحساب من مكان واحد.",
            "Change your password, review contact visibility, and request account deletion from one place.",
          )}
          icon={accountSectionIcons.security}
          tone="security"
        >
          {auth.status === "signedIn" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <form
                onSubmit={(event) => void handleChangePassword(event)}
                aria-busy={passwordSaving}
                className="rounded-2xl bg-muted-surface p-4 hairline"
              >
                <h3 className="inline-flex items-center gap-2 text-sm font-extrabold">
                  <KeyRound className="h-4 w-4 text-primary" />
                  {text("تغيير كلمة المرور", "Change password")}
                </h3>
                <div className="mt-3 grid gap-3">
                  <label className="block">
                    <span className="text-xs font-bold text-muted-foreground">
                      {text("كلمة المرور الحالية", "Current password")}
                    </span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      minLength={8}
                      maxLength={72}
                      required
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="input mt-1"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-muted-foreground">
                      {text("كلمة المرور الجديدة", "New password")}
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      required
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="input mt-1"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold text-muted-foreground">
                      {text("تأكيد كلمة المرور", "Confirm password")}
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={72}
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="input mt-1"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="mt-3 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-60"
                >
                  {passwordSaving
                    ? text("جارٍ التغيير", "Changing")
                    : text("حفظ كلمة المرور", "Save password")}
                </button>
                {passwordNotice ? (
                  <p className="mt-3 rounded-xl bg-card p-3 text-xs font-semibold hairline">
                    {passwordNotice}
                  </p>
                ) : null}
              </form>

              <div className="space-y-4">
                <section className="rounded-2xl bg-muted-surface p-4 hairline">
                  <h3 className="inline-flex items-center gap-2 text-sm font-extrabold">
                    <LockKeyhole className="h-4 w-4 text-primary" />
                    {text("خصوصية التواصل", "Contact privacy")}
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {text(
                      "رقم الهاتف وواتساب لا يظهران في صفحة البائع العامة. ظهور وسيلة التواصل يحدده صاحب الحساب داخل إعدادات كل إعلان.",
                      "Phone and WhatsApp are not shown on the public seller page. Contact visibility is controlled per listing by the account owner.",
                    )}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to="/profile/listings"
                      className="inline-flex rounded-xl bg-card px-3 py-2 text-xs font-bold hairline"
                    >
                      {text("إدارة الإعلانات", "Manage listings")}
                    </Link>
                    <Link
                      to="/notifications"
                      className="inline-flex rounded-xl bg-card px-3 py-2 text-xs font-bold hairline"
                    >
                      {text("إعدادات التنبيهات", "Notification settings")}
                    </Link>
                  </div>
                </section>

                <section className="rounded-2xl bg-destructive/5 p-4 hairline">
                  <h3 className="inline-flex items-center gap-2 text-sm font-extrabold text-destructive">
                    <Trash2 className="h-4 w-4" />
                    {text("حذف الحساب", "Delete account")}
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {text(
                      "يسجل هذا الإجراء طلب حذف رسمي قابل للتتبع. تراجع الإدارة الالتزامات والعمليات المفتوحة قبل تنفيذ الحذف الآمن.",
                      "This records a traceable deletion request. The team reviews open obligations and activity before secure deletion.",
                    )}
                  </p>
                  {deleteConfirmOpen ? (
                    <div className="mt-3 rounded-xl bg-card p-3 hairline">
                      <p className="text-xs font-bold">
                        {text(
                          "هل تريد تسجيل طلب حذف الحساب الآن؟",
                          "Record an account deletion request now?",
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={deletionSaving}
                          onClick={() => void handleAccountDeletionRequest()}
                          className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60"
                        >
                          {deletionSaving
                            ? text("جارٍ التسجيل", "Recording")
                            : text("تأكيد طلب الحذف", "Confirm deletion request")}
                        </button>
                        <button
                          type="button"
                          disabled={deletionSaving}
                          onClick={() => setDeleteConfirmOpen(false)}
                          className="rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
                        >
                          {text("إلغاء", "Cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(true)}
                      className="mt-3 rounded-xl bg-card px-3 py-2 text-xs font-bold text-destructive hairline"
                    >
                      {text("طلب حذف الحساب", "Request account deletion")}
                    </button>
                  )}
                  {deletionNotice ? (
                    <p className="mt-3 rounded-xl bg-card p-3 text-xs font-semibold hairline">
                      {deletionNotice}
                    </p>
                  ) : null}
                </section>
              </div>
            </div>
          ) : null}
        </AccountSection>

        <section className="rawaj-account-overview-grid">
          <section className="rawaj-account-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold">{text("إعلاناتي", "My listings")}</h2>
              <span className="rounded-full bg-muted-surface px-2.5 py-1 text-[11px] font-bold">
                {myListingsLoading && !myListingsHasLoaded
                  ? text("تحميل", "Loading")
                  : text(`${myListings.length} إعلان`, `${myListings.length} listings`)}
              </span>
            </div>
            {myListingsLoading && !myListingsHasLoaded ? (
              <p className="rounded-xl bg-muted-surface p-3 text-xs text-muted-foreground">
                {text("جارٍ تحميل إعلانات حسابك.", "Loading your account listings.")}
              </p>
            ) : myListingsError && !myListingsHasLoaded ? (
              <OverviewRecovery
                title={text("تعذر تحميل إعلاناتك", "Could not load your listings")}
                body={myListingsError.message}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onAction={() => void reloadListings()}
                disabled={myListingsLoading}
              />
            ) : (
              <>
                {myListingsError ? (
                  <OverviewRecovery
                    title={text("تعذر تحديث إعلاناتك", "Could not refresh your listings")}
                    body={myListingsError.message}
                    actionLabel={text("إعادة المحاولة", "Try again")}
                    onAction={() => void reloadListings()}
                    disabled={myListingsLoading}
                  />
                ) : null}
                {recentListings.length === 0 ? (
                  <p className="rounded-xl bg-muted-surface p-3 text-xs text-muted-foreground">
                    {text("لا توجد إعلانات في حسابك بعد.", "No listings in your account yet.")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentListings.map((listing) => (
                      <article
                        key={listing.id}
                        className="rounded-xl bg-muted-surface p-3 text-xs hairline"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate font-bold">{listing.title}</h3>
                            <p className="mt-1 text-muted-foreground">
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
                          </div>
                          <span className="shrink-0 rounded-md bg-card px-2 py-0.5 text-[10px] font-bold hairline">
                            {listingStatusLabel(listing.status, language)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/profile/listings"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {text("فتح إدارة الإعلانات", "Manage listings")}
              </Link>
              <Link
                to="/add-listing"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
              >
                <Plus className="h-4 w-4" />
                {text("إضافة إعلان", "Post listing")}
              </Link>
            </div>
          </section>

          <section className="rawaj-account-card">
            <h2 className="mb-2 inline-flex items-center gap-2 text-sm font-extrabold">
              <BadgeCheck className="h-4 w-4 text-emerald-trust" />
              {text("توثيق الحساب", "Account verification")}
            </h2>
            <div className="rounded-xl bg-muted-surface p-3 text-xs leading-6 hairline">
              <p className="font-bold">
                {text("حالة التوثيق الحالية", "Current verification status")}
              </p>
              <p className="mt-1 text-muted-foreground">
                {verificationStatusLabel(auth.profile?.verificationStatus, text)}
              </p>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {text(
                "يتم التوثيق بعد مراجعة الإدارة. قد يتم طلب مستندات إضافية عند الحاجة.",
                "Verification happens after admin review. Additional documents may be requested when needed.",
              )}
            </p>
            {verificationLoading && !verificationHasLoaded ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {text("جارٍ تحميل طلباتك", "Loading your requests")}
              </p>
            ) : verificationError && !verificationHasLoaded ? (
              <OverviewRecovery
                title={text("تعذر تحميل طلبات التوثيق", "Could not load verification requests")}
                body={verificationError.message}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onAction={() => void loadVerificationRequests()}
                disabled={verificationLoading}
              />
            ) : (
              <>
                {verificationError ? (
                  <OverviewRecovery
                    title={text(
                      "تعذر تحديث طلبات التوثيق",
                      "Could not refresh verification requests",
                    )}
                    body={verificationError.message}
                    actionLabel={text("إعادة المحاولة", "Try again")}
                    onAction={() => void loadVerificationRequests()}
                    disabled={verificationLoading}
                  />
                ) : null}
                {verificationRequests.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {verificationRequests.slice(0, 2).map((request) => (
                      <div
                        key={request.id}
                        className="rounded-xl bg-muted-surface p-3 text-xs hairline"
                      >
                        <p className="font-bold">{request.legalName}</p>
                        <p className="mt-1 text-muted-foreground">
                          {verificationStatusLabel(request.status, text)} ·{" "}
                          {verificationTypeLabel(request.requestType, text)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
            <Link
              to="/verification"
              className="mt-3 inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              {text("فتح طلب التوثيق", "Open verification request")}
            </Link>
          </section>
        </section>
      </main>
    </>
  );
}

function OverviewRecovery({
  title,
  body,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-destructive hairline">
      <p className="text-xs font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5">{body}</p>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-card px-3 py-2 text-xs font-bold text-foreground disabled:opacity-60 hairline"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function SettingsInput({
  label,
  value,
  onChange,
  maxLength,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        inputMode={inputMode}
        className="input mt-1"
      />
    </label>
  );
}

function MediaField({
  title,
  helper,
  imageUrl,
  busy,
  wide = false,
  text,
  onUpload,
  onRemove,
}: {
  title: string;
  helper: string;
  imageUrl?: string | null;
  busy: boolean;
  wide?: boolean;
  text: (ar: string, en: string) => string;
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl bg-card p-3 hairline">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground">{title}</span>
        {busy && (
          <span className="text-xs font-bold text-primary">{text("جارٍ الحفظ", "Saving")}</span>
        )}
      </div>
      <div
        className={`grid place-items-center overflow-hidden rounded-xl bg-muted-surface ${wide ? "h-36 sm:h-44 lg:h-48" : "h-40 sm:h-44 lg:h-48"}`}
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
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{helper}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-muted-surface px-3 py-1.5 text-[11px] font-bold hairline">
          <Camera className="h-3.5 w-3.5" />
          {text("رفع صورة", "Upload image")}
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
            className="inline-flex items-center gap-1 rounded-lg bg-muted-surface px-3 py-1.5 text-[11px] font-bold text-destructive hairline disabled:opacity-50"
          >
            <XCircle className="h-3.5 w-3.5" />
            {text("إزالة", "Remove")}
          </button>
        )}
      </div>
    </div>
  );
}

function roleLabel(role: string | null | undefined, text: (ar: string, en: string) => string) {
  if (role === "owner") return text("مالك", "Owner");
  if (role === "admin") return text("إدارة", "Admin");
  if (role === "moderator") return text("مشرف", "Moderator");
  return text("مستخدم", "User");
}

function accountStatusLabel(
  status: string | null | undefined,
  text: (ar: string, en: string) => string,
) {
  if (status === "frozen" || status === "suspended") return text("مجمّد", "Frozen");
  if (status === "disabled" || status === "blocked") return text("معطّل", "Disabled");
  if (status === "pending_review") return text("قيد المراجعة", "Pending review");
  return text("نشط", "Active");
}

function verificationStatusLabel(
  status: string | null | undefined,
  text: (ar: string, en: string) => string,
) {
  if (status === "approved") return text("موثق", "Verified");
  if (status === "rejected") return text("مرفوض", "Rejected");
  if (status === "pending" || status === "pending_review")
    return text("قيد المراجعة", "Pending review");
  return text("غير موثق", "Unverified");
}

function verificationTypeLabel(type: string, text: (ar: string, en: string) => string) {
  return type === "business" ? text("منشأة", "Business") : text("فرد", "Individual");
}
