import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { PageHeader } from "@/components/PageHeader";
import { sanitizeAuthReturnTo } from "@/lib/auth-return";
import { supabase } from "@/lib/supabase";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "تسجيل الدخول | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LoginPage,
});

type AuthMode = "login" | "register" | "forgot";

function GoogleButton({ returnTo }: { returnTo: string }) {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    const result = await auth.signInWithGoogle(returnTo);
    setLoading(false);
    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading || auth.status === "authUnavailable"}
        onClick={handleGoogleSignIn}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[1rem] border border-border/80 bg-card/85 px-4 py-2.5 text-sm font-semibold text-foreground shadow-soft transition hover:border-gold/40 hover:bg-card disabled:opacity-60"
      >
        {loading ? (
          <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        {text("المتابعة باستخدام Google", "Continue with Google")}
      </button>
      {error && (
        <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs font-bold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function LoginPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const navigate = useNavigate();
  const locationSearch = useRouterState({ select: (state) => state.location.search });
  const looseSearch = locationSearch as unknown as Record<string, unknown>;
  const rawReturnTo = typeof looseSearch.returnTo === "string" ? looseSearch.returnTo : undefined;
  const returnTo = sanitizeAuthReturnTo(rawReturnTo, "/more");
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const client = supabase;
    if (!client) {
      setError(
        text(
          "خدمة الحسابات غير متاحة الآن. يمكنك تصفح الإعلانات والمحاولة لاحقاً.",
          "Account service is unavailable right now. You can browse listings and try again later.",
        ),
      );
      return;
    }

    const cleanEmail = email.trim();
    const cleanName = displayName.trim();

    if (mode === "forgot") {
      if (!cleanEmail) {
        setError(
          text(
            "أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين.",
            "Enter your email to send the reset link.",
          ),
        );
        return;
      }
      setSubmitting(true);
      const redirectTo = `${window.location.origin}/auth/callback?type=recovery`;
      const { error: resetError } = await client.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });
      setSubmitting(false);
      if (resetError) {
        setError(
          text(
            "تعذر إرسال رابط إعادة التعيين الآن. حاول مرة أخرى.",
            "Could not send the reset link right now. Try again.",
          ),
        );
        return;
      }
      setMessage(
        text(
          "إذا كان البريد مسجلاً، ستصلك رسالة لإعادة تعيين كلمة المرور. تحقق من البريد الوارد أو الرسائل غير المرغوب بها.",
          "If the email is registered, you will receive a password reset message. Check your inbox or spam folder.",
        ),
      );
      return;
    }

    if (mode === "register" && cleanName.length < 2) {
      setError(text("أدخل اسما واضحا للحساب.", "Enter a clear account name."));
      return;
    }

    setSubmitting(true);
    const result =
      mode === "login"
        ? await client.auth.signInWithPassword({ email: cleanEmail, password })
        : await client.auth.signUp({
            email: cleanEmail,
            password,
            options: { data: { display_name: cleanName } },
          });

    if (result.error) {
      setSubmitting(false);
      setError(
        mode === "login"
          ? text("خطأ في البريد أو كلمة المرور", "Incorrect email or password")
          : result.error.message,
      );
      return;
    }

    const profileError =
      result.data.session && result.data.user
        ? await ensureOwnProfile(client, result.data.user, cleanName)
        : null;
    setSubmitting(false);

    if (profileError) {
      setError(
        text(
          "تم تسجيل الدخول، لكن تعذر تجهيز بيانات الحساب الآن. حاول مرة أخرى أو تواصل مع الدعم.",
          "You are signed in, but account details could not be prepared right now. Try again or contact support.",
        ),
      );
      return;
    }

    if (mode === "register") {
      setMessage(
        result.data.session
          ? text(
              "تم إنشاء الحساب ويمكنك متابعة إدارة إعلاناتك ورسائلك.",
              "Account created. You can continue managing your listings and messages.",
            )
          : text(
              "تم إرسال رابط تفعيل الحساب إلى بريدك الإلكتروني. افتح البريد واضغط على رابط التفعيل لإكمال إنشاء الحساب. إذا لم تجد الرسالة خلال دقائق، تحقق من مجلد الرسائل غير المرغوبة / Spam.",
              "We sent an account activation link to your email. Open your inbox and click the activation link to complete account setup. If you do not see it within a few minutes, check your Spam or Junk folder.",
            ),
      );
      return;
    }

    setMessage(text("تم تسجيل الدخول", "Logged in"));
    void navigate({ to: returnTo });
  }

  return (
    <>
      <PageHeader title={text("الحساب", "Account")} />
      <main className="container-wide pb-10 pt-3 sm:pt-5">
        <section className="rawaj-hero-surface mx-auto max-w-md rounded-[1.65rem] p-5 sm:rounded-[1.9rem] sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1.05rem] bg-primary text-primary-foreground shadow-[0_9px_22px_rgba(16,43,70,0.16)]">
              <Lock className="h-5 w-5 text-gold" />
            </span>
            <div>
              <h1 className="text-base font-bold text-primary sm:text-lg">
                {mode === "login"
                  ? text("دخول الحساب", "Account login")
                  : mode === "forgot"
                    ? text("إعادة تعيين كلمة المرور", "Reset password")
                    : text("إنشاء حساب", "Create account")}
              </h1>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {mode === "login"
                  ? text(
                      "سجل الدخول ببريدك وكلمة المرور لإدارة إعلاناتك.",
                      "Log in with your email and password to manage your listings.",
                    )
                  : mode === "forgot"
                    ? text(
                        "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.",
                        "Enter your email and we will send a password reset link.",
                      )
                    : text(
                        "أنشئ حسابك لإدارة إعلاناتك ومتابعة الرسائل والتنبيهات.",
                        "Create your account to manage listings, messages, and notifications.",
                      )}
              </p>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-1 rounded-[1.05rem] border border-border/65 bg-card-warm/65 p-1.5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
                setError("");
              }}
              className={`rounded-[0.8rem] px-3 py-2.5 text-xs font-semibold transition ${mode === "login" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-primary"}`}
            >
              {text("تسجيل الدخول", "Log in")}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setMessage("");
                setError("");
              }}
              className={`rounded-[0.8rem] px-3 py-2.5 text-xs font-semibold transition ${mode === "register" ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-primary"}`}
            >
              {text("إنشاء حساب", "Register")}
            </button>
          </div>

          {auth.status === "authUnavailable" ? (
            <div className="rounded-[1rem] border border-warning/15 bg-warning/8 p-3.5 text-xs leading-5 text-foreground/90">
              {text(
                "خدمة الحسابات غير متاحة الآن. يمكنك تصفح الإعلانات والمحاولة لاحقاً.",
                "Account service is unavailable right now. You can browse listings and try again later.",
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
                    {text("اسم الحساب", "Account name")}
                  </span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    type="text"
                    autoComplete="name"
                    required
                    className="input"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
                  {text("البريد الإلكتروني", "Email")}
                </span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                  className="input"
                />
              </label>

              {mode !== "forgot" && (
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
                    {text("كلمة المرور", "Password")}
                  </span>
                  <div className="relative">
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={passwordVisible ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required
                      minLength={6}
                      className="input pe-11"
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible((value) => !value)}
                      className="absolute inset-y-0 end-0 grid w-11 place-items-center text-muted-foreground"
                      aria-label={
                        passwordVisible
                          ? text("إخفاء كلمة المرور", "Hide password")
                          : text("إظهار كلمة المرور", "Show password")
                      }
                    >
                      {passwordVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </label>
              )}

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setMessage("");
                    setError("");
                  }}
                  className="inline-flex rounded-lg px-1 py-1 text-xs font-semibold text-brand-orange transition hover:text-primary"
                >
                  {text("نسيت كلمة المرور؟", "Forgot password?")}
                </button>
              )}

              {submitting && (
                <p className="rounded-[1rem] border border-border/65 bg-card-warm/70 p-2.5 text-xs font-medium text-muted-foreground">
                  {mode === "forgot"
                    ? text("جارٍ إرسال الرابط", "Sending link")
                    : mode === "login"
                      ? text("جاري تسجيل الدخول", "Logging in")
                      : text("جاري إنشاء الحساب", "Creating account")}
                </p>
              )}
              {message && (
                <p className="rounded-[1rem] border border-emerald-trust/15 bg-emerald-trust/8 p-2.5 text-xs font-medium text-emerald-trust">
                  {message}
                </p>
              )}
              {error && (
                <p className="rounded-[1rem] border border-destructive/15 bg-destructive/8 p-2.5 text-xs font-medium text-destructive">
                  {error}
                </p>
              )}
              {auth.status === "authError" && (
                <p className="rounded-[1rem] border border-warning/15 bg-warning/8 p-2.5 text-xs font-medium text-warning">
                  {text(
                    "تعذر فتح الحساب الآن. حاول مرة أخرى.",
                    "Could not open the account right now. Try again.",
                  )}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="rawaj-button-primary min-h-11 w-full rounded-[1rem] px-4 py-2.5 disabled:opacity-60"
              >
                {mode === "login" ? (
                  <LogIn className="h-4 w-4" />
                ) : mode === "forgot" ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {mode === "login"
                  ? text("تسجيل الدخول", "Log in")
                  : mode === "forgot"
                    ? text("إرسال رابط إعادة التعيين", "Send reset link")
                    : text("إنشاء حساب", "Register")}
              </button>
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setMessage("");
                    setError("");
                  }}
                  className="w-full text-center text-xs font-semibold text-primary transition hover:text-brand-orange"
                >
                  {text("العودة لتسجيل الدخول", "Back to login")}
                </button>
              )}
            </form>
          )}

          {mode !== "forgot" && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/80" />
                </div>
                <div className="relative flex justify-center text-[10px] font-semibold text-muted-foreground">
                  <span className="rounded-full bg-card/90 px-3 py-1">{text("أو", "Or")}</span>
                </div>
              </div>

              <GoogleButton returnTo={returnTo} />
            </>
          )}

          <div className="mt-5 rounded-[1rem] border border-border/65 bg-card-warm/65 p-3.5 text-[11px] leading-6 text-muted-foreground">
            <ShieldCheck className="me-1 inline h-3.5 w-3.5 text-emerald-trust" />
            {text(
              "تتم حماية الحسابات والصلاحيات من خلال إعدادات المنصة المعتمدة.",
              "Accounts and permissions are protected through the platform's approved settings.",
            )}
          </div>

          <Link
            to="/"
            className="mt-4 inline-flex text-xs font-semibold text-primary transition hover:text-brand-orange"
          >
            {text("العودة للرئيسية", "Back to home")}
          </Link>
        </section>
      </main>
    </>
  );
}

async function ensureOwnProfile(
  client: SupabaseClient,
  user: User,
  displayName: string,
): Promise<string | null> {
  const metadataName =
    typeof user.user_metadata.display_name === "string" ? user.user_metadata.display_name : null;

  const { data: existingProfile, error: readError } = await client
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) return readError.message;
  if (existingProfile) return null;

  const { error } = await client.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name: displayName.trim() || metadataName,
    },
    { onConflict: "id", ignoreDuplicates: false },
  );

  if (!error || error.code === "23505") return null;
  return error.message;
}
