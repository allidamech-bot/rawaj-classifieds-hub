import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`Missing expected source in ${path}: ${before.slice(0, 120)}`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Expected one match in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(path, source.slice(0, first) + after + source.slice(first + before.length));
}

await writeFile(
  "src/lib/auth-context.ts",
  `import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { RolePermission, RolePermissions, UserProfile } from "./auth-types";
import type { AuthStatus } from "./auth-status";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  reason: string | null;
  permissions: RolePermissions;
  hasPermission: (permission: RolePermission) => boolean;
  canAccessAdmin: boolean;
  canAccessOwnerControls: boolean;
  signOut: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<{ error: string | null }>;
  signInWithGoogle: (returnTo?: string) => Promise<{ error: string | null }>;
  emailConfirmed: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
`,
);

await replaceOnce(
  "src/lib/auth.tsx",
  `  signOut: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
`,
  `  signOut: async () => ({ error: null }),
  refreshProfile: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
`,
);

await replaceOnce(
  "src/lib/auth.tsx",
  `    const signInWithGoogle = async (returnTo?: string) => {
`,
  `    const refreshProfile = async () => {
      const client = supabase;
      const user = session?.user ?? null;
      if (!client || !user) {
        return { error: unavailableReason ?? "يجب تسجيل الدخول لتحديث بيانات الحساب." };
      }

      try {
        const nextProfile = await fetchProfile(client, user);
        setProfile(nextProfile);
        setReason(null);
        setStatus("signedIn");
        return { error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذّر تحديث بيانات الحساب.";
        setReason(message);
        return { error: message };
      }
    };

    const signInWithGoogle = async (returnTo?: string) => {
`,
);

await replaceOnce(
  "src/lib/auth.tsx",
  `        signOut,
        signInWithGoogle,
`,
  `        signOut,
        refreshProfile,
        signInWithGoogle,
`,
);

await replaceOnce(
  "src/lib/auth.tsx",
  `      signOut,
      signInWithGoogle,
`,
  `      signOut,
      refreshProfile,
      signInWithGoogle,
`,
);

await writeFile(
  "src/lib/api/account-security.ts",
  `import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { getClient, mapError } from "@/lib/api/shared";

export async function changeOwnPassword(
  userId: string | null,
  newPassword: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتغيير كلمة المرور." },
    };
  }

  if (newPassword.length < 8 || newPassword.length > 72) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "يجب أن تكون كلمة المرور بين 8 و72 حرفاً.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError) return { ok: false, error: mapError(userError, "account_password_verify") };
  if (userResult.user?.id !== userId) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "تعذر التحقق من جلسة الحساب. أعد تسجيل الدخول ثم حاول مجدداً.",
        operation: "account_password_verify",
      },
    };
  }

  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: mapError(error, "account_password_update") };
  return { ok: true, data: null };
}
`,
);

await replaceOnce(
  "src/lib/classifieds-api.ts",
  `export * from "@/lib/api/profile";
`,
  `export * from "@/lib/api/profile";
export * from "@/lib/api/account-security";
`,
);

await replaceOnce(
  "src/lib/api/support.ts",
  `export async function fetchMySupportRequests(
`,
  `const ACCOUNT_DELETION_SUBJECT = "طلب حذف حساب رواج";

export async function createAccountDeletionRequest(
  userId: string | null,
): Promise<ClassifiedsResult<SupportRequest>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لطلب حذف الحساب." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const { data: existing, error: existingError } = await clientResult.data
    .from("support_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("subject", ACCOUNT_DELETION_SUBJECT)
    .in("status", ["new", "under_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: mapError(existingError, "account_deletion_request_lookup") };
  }
  if (existing) {
    return { ok: true, data: mapSupportRequest(existing as Record<string, unknown>) };
  }

  return createSupportRequest(userId, {
    type: "other",
    subject: ACCOUNT_DELETION_SUBJECT,
    message:
      "أطلب حذف حسابي وبياناته الشخصية من منصة رواج. أفهم أن الإدارة ستراجع الطلب وتتحقق من الالتزامات والعمليات المفتوحة قبل تنفيذ الحذف الآمن.",
  });
}

export async function fetchMySupportRequests(
`,
);

await replaceOnce(
  "src/features/account/AccountExperience.tsx",
  `        title={text("متجري", "My store")}
        description={text("الإعلانات والحالات", "Listings and statuses")}
`,
  `        title={text("إعلاناتي", "My listings")}
        description={text("الإدارة والحالات", "Management and statuses")}
`,
);

await replaceOnce(
  "src/features/storefront/StorefrontIdentityHero.tsx",
  `              ? text("مساحة متجري", "My store workspace")
`,
  `              ? text("إدارة إعلاناتي", "My listings workspace")
`,
);

await replaceOnce(
  "src/routes/profile/listings.tsx",
  `          title={text("إعلاناتي / متجري", "My listings / store")}
`,
  `          title={text("إعلاناتي", "My listings")}
`,
);
await replaceOnce(
  "src/routes/profile/listings.tsx",
  `              "سجل الدخول لعرض واجهة متجرك والإعلانات المرتبطة بحسابك.",
              "Log in to view your store and listings linked to your account.",
`,
  `              "سجل الدخول لإدارة الإعلانات المرتبطة بحسابك وعرض متجرك العام بصورة منفصلة.",
              "Log in to manage listings linked to your account and open your public store separately.",
`,
);
await replaceOnce(
  "src/routes/profile/listings.tsx",
  `        title={text("إعلاناتي / متجري", "My listings / store")}
`,
  `        title={text("إعلاناتي", "My listings")}
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `  FileSpreadsheet,
  LifeBuoy,
  LogIn,
`,
  `  FileSpreadsheet,
  KeyRound,
  LockKeyhole,
  LogIn,
`,
);
await replaceOnce(
  "src/routes/profile.tsx",
  `  ShieldCheck,
  User,
`,
  `  ShieldCheck,
  Trash2,
  User,
`,
);
await replaceOnce(
  "src/routes/profile.tsx",
  `  fetchCurrentUserListings,
`,
  `  changeOwnPassword,
  createAccountDeletionRequest,
  fetchCurrentUserListings,
`,
);
await replaceOnce(
  "src/routes/profile.tsx",
  `  const [settingsNotice, setSettingsNotice] = useState("");
`,
  `  const [settingsNotice, setSettingsNotice] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletionSaving, setDeletionSaving] = useState(false);
  const [deletionNotice, setDeletionNotice] = useState("");
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `  async function handleSaveProfileBasics(event: FormEvent<HTMLFormElement>) {
`,
  `  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordNotice("");
    if (newPassword !== confirmPassword) {
      setPasswordNotice(text("كلمتا المرور غير متطابقتين.", "Passwords do not match."));
      return;
    }

    setPasswordSaving(true);
    const result = await changeOwnPassword(profileId ?? null, newPassword);
    setPasswordSaving(false);
    if (!result.ok) {
      setPasswordNotice(result.error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordNotice(text("تم تغيير كلمة المرور بنجاح.", "Password changed successfully."));
  }

  async function handleAccountDeletionRequest() {
    setDeletionSaving(true);
    setDeletionNotice("");
    const result = await createAccountDeletionRequest(profileId ?? null);
    setDeletionSaving(false);
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
  }

  async function handleSaveProfileBasics(event: FormEvent<HTMLFormElement>) {
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `    setSettingsSaving(false);
    setSettingsNotice(
      result.ok
        ? text("تم حفظ معلومات الحساب.", "Account information saved.")
        : result.error.message,
    );
`,
  `    setSettingsSaving(false);
    if (!result.ok) {
      setSettingsNotice(result.error.message);
      return;
    }
    const refreshResult = await auth.refreshProfile();
    setSettingsNotice(
      refreshResult.error
        ? text(
            "تم الحفظ، لكن تعذر تحديث العرض فوراً. أعد فتح الصفحة عند الحاجة.",
            "Saved, but the view could not refresh immediately. Reopen the page if needed.",
          )
        : text("تم حفظ معلومات الحساب وتحديثها.", "Account information saved and refreshed."),
    );
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `    setMediaSaving(null);
    setSettingsNotice(
      result.ok
        ? text(
            "تم حفظ الصورة. قد تحتاج لتحديث الصفحة إذا لم تظهر فوراً.",
            "Image saved. Refresh if it does not appear immediately.",
          )
        : result.error.message,
    );
`,
  `    setMediaSaving(null);
    if (!result.ok) {
      setSettingsNotice(result.error.message);
      return;
    }
    const refreshResult = await auth.refreshProfile();
    setSettingsNotice(
      refreshResult.error
        ? text("تم حفظ الصورة، لكن تعذر تحديث العرض فوراً.", "Image saved, but the view could not refresh immediately.")
        : text("تم حفظ الصورة وتحديث الحساب.", "Image saved and account refreshed."),
    );
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `    setMediaSaving(null);
    setSettingsNotice(
      result.ok
        ? text("تمت إزالة الصورة من الحساب.", "Image removed from account.")
        : result.error.message,
    );
`,
  `    setMediaSaving(null);
    if (!result.ok) {
      setSettingsNotice(result.error.message);
      return;
    }
    const refreshResult = await auth.refreshProfile();
    setSettingsNotice(
      refreshResult.error
        ? text("تمت إزالة الصورة، لكن تعذر تحديث العرض فوراً.", "Image removed, but the view could not refresh immediately.")
        : text("تمت إزالة الصورة وتحديث الحساب.", "Image removed and account refreshed."),
    );
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `                  {text("متجري", "My store")}
`,
  `                  {text("إعلاناتي", "My listings")}
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `            "حدّث الصور والاسم والموقع ووسائل التواصل التي تستخدمها في متجرك وإعلاناتك.",
            "Update the images, name, location, and contact methods used by your store and listings.",
`,
  `            "حدّث هوية حسابك ومعلوماته. تظهر واجهة المتجر العامة والإعلانات في مساحة منفصلة.",
            "Update your account identity and details. Your public store and listings live in a separate workspace.",
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `        <section className="rawaj-account-overview-grid">
`,
  `        <AccountSection
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
                className="rounded-2xl bg-muted-surface p-4 hairline"
              >
                <h3 className="inline-flex items-center gap-2 text-sm font-extrabold">
                  <KeyRound className="h-4 w-4 text-primary" />
                  {text("تغيير كلمة المرور", "Change password")}
                </h3>
                <div className="mt-3 grid gap-3">
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
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `
        <section className="rawaj-account-card">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted-surface text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold">
                {text("مراجعة الحساب أو حذفه", "Account review or deletion")}
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "لحذف الحساب أو مراجعة بياناته، أرسل طلباً عبر الدعم ليتم التعامل معه بطريقة آمنة.",
                  "To delete the account or review its data, send a support request so it can be handled safely.",
                )}
              </p>
              <Link
                to="/support"
                className="mt-3 inline-flex items-center gap-1 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
              >
                <LifeBuoy className="h-4 w-4" />
                {text("طلب مراجعة الحساب", "Request account review")}
              </Link>
            </div>
          </div>
        </section>
`,
  `
`,
);

await replaceOnce(
  "src/routes/profile.tsx",
  `  if (status === "suspended") return text("موقوف", "Suspended");
  if (status === "pending_review") return text("قيد المراجعة", "Pending review");
  return text("نشط", "Active");
`,
  `  if (status === "frozen" || status === "suspended") return text("مجمّد", "Frozen");
  if (status === "disabled" || status === "blocked") return text("معطّل", "Disabled");
  if (status === "pending_review") return text("قيد المراجعة", "Pending review");
  return text("نشط", "Active");
`,
);

await replaceOnce(
  "src/routes/notifications.tsx",
  `    const target = result.data;
    if (!target) return;

    if (target.kind === "listing") {
`,
  `    const target = result.data;
    if (!target) return;
    if (!notification.readAt) await markOne(notification.id);

    if (target.kind === "listing") {
`,
);

await writeFile(
  "scripts/launch-readiness-batch-2.test.mjs",
  `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [authContext, authProvider, accountSecurity, support, profile, quickLinks, ownerListings, storefront, notifications, barrel, packageJson, qualityGate] = await Promise.all([
  readFile(new URL("../src/lib/auth-context.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/account-security.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/support.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/account/AccountExperience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/storefront/StorefrontIdentityHero.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/notifications.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("profile mutations refresh the shared authenticated profile", () => {
  assert.ok(authContext.includes("refreshProfile: () => Promise"));
  assert.ok(authProvider.includes("const refreshProfile = async () =>"));
  assert.ok(authProvider.includes("const nextProfile = await fetchProfile(client, user)"));
  assert.ok(profile.match(/auth\.refreshProfile\(\)/g)?.length >= 3);
});

test("password change verifies ownership and uses Supabase Auth", () => {
  assert.ok(barrel.includes('export * from "@/lib/api/account-security";'));
  assert.ok(accountSecurity.includes("client.auth.getUser()"));
  assert.ok(accountSecurity.includes("userResult.user?.id !== userId"));
  assert.ok(accountSecurity.includes("client.auth.updateUser({ password: newPassword })"));
  assert.ok(profile.includes("handleChangePassword"));
  assert.ok(profile.includes('autoComplete="new-password"'));
});

test("account deletion creates a deduplicated trackable support request", () => {
  assert.ok(support.includes("createAccountDeletionRequest"));
  assert.ok(support.includes('.eq("subject", ACCOUNT_DELETION_SUBJECT)'));
  assert.ok(support.includes('.in("status", ["new", "under_review"])'));
  assert.ok(profile.includes("handleAccountDeletionRequest"));
  assert.ok(profile.includes("تأكيد طلب الحذف"));
  assert.ok(!profile.includes("Request account review"));
});

test("account and public store navigation are clearly separated", () => {
  assert.ok(quickLinks.includes('title={text("إعلاناتي", "My listings")}'));
  assert.ok(ownerListings.includes('title={text("إعلاناتي", "My listings")}'));
  assert.ok(storefront.includes('text("إدارة إعلاناتي", "My listings workspace")'));
  assert.ok(storefront.includes('text("عرض المتجر العام", "View public store")'));
});

test("account status labels cover the persisted frozen and disabled states", () => {
  assert.ok(profile.includes('status === "frozen"'));
  assert.ok(profile.includes('status === "disabled"'));
  assert.ok(profile.includes('text("مجمّد", "Frozen")'));
  assert.ok(profile.includes('text("معطّل", "Disabled")'));
});

test("opening a notification records it as read before navigation", () => {
  assert.ok(notifications.includes("if (!notification.readAt) await markOne(notification.id);"));
  assert.ok(notifications.includes("markAllNotificationsRead"));
  assert.ok(notifications.includes("resolveNotificationTarget"));
});

test("Batch 2 regression remains in local and GitHub quality gates", () => {
  const parsed = JSON.parse(packageJson);
  assert.ok(parsed.scripts["test:launch-readiness-batch-2"]);
  assert.ok(parsed.scripts.check.includes("test:launch-readiness-batch-2"));
  assert.ok(qualityGate.includes("Launch readiness Batch 2 contract"));
  assert.ok(qualityGate.includes("npm run test:launch-readiness-batch-2"));
});
`,
);

await replaceOnce(
  "package.json",
  `&& npm run test:launch-readiness-batch-1 && npm run test:activity-center`,
  `&& npm run test:launch-readiness-batch-1 && npm run test:launch-readiness-batch-2 && npm run test:activity-center`,
);
await replaceOnce(
  "package.json",
  `    "test:launch-readiness-batch-1": "node --test scripts/launch-readiness-batch-1.test.mjs",
`,
  `    "test:launch-readiness-batch-1": "node --test scripts/launch-readiness-batch-1.test.mjs",
    "test:launch-readiness-batch-2": "node --test scripts/launch-readiness-batch-2.test.mjs",
`,
);

await replaceOnce(
  ".github/workflows/quality-gate.yml",
  `      - name: Communication Center V2 contract
        run: node --test scripts/communication-center-v2.test.mjs
`,
  `      - name: Communication Center V2 contract
        run: node --test scripts/communication-center-v2.test.mjs

      - name: Launch readiness Batch 2 contract
        run: npm run test:launch-readiness-batch-2
`,
);

console.log("Launch readiness Batch 2 patch applied.");
