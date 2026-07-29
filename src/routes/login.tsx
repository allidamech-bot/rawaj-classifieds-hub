import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { AuthExperienceAside, AuthExperienceHeader } from "@/features/account/AccountExperience";
import { authErrorMessage } from "@/lib/auth-errors";
import { sanitizeAuthReturnTo } from "@/lib/auth-return";
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
  const signInInFlightRef = useRef(false);

  async function handleGoogleSignIn() {
    if (signInInFlightRef.current) return;
    signInInFlightRef.current = true;
    setError("");
    setLoading(true);
    try {
      const result = await auth.signInWithGoogle(returnTo);
      if (result.error) {
        setError(authErrorMessage({ message: result.error }, "callback", text));
      }
    } catch (error) {
      setError(authErrorMessage(error instanceof Error ? error : null, "callback", text));
    } finally {
      signInInFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={loading || auth.status === "authUnavailable"}
        onClick={handleGoogleSignIn}
        className="rawaj-auth-google disabled:opacity-60"
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
        <p className="rawaj-auth-state mt-2 p-2" data-tone="error" role="alert">
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
  const initialMode: AuthMode = looseSearch.mode === "forgot" ? "forgot" : "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const submitInFlightRef = useRef(false);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setError("");
    setEmailError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitInFlightRef.current) return;
    setMessage("");
    setError("");
    setEmailError("");

    const cleanEmail = email.trim();
    const cleanName = displayName.trim();
    if (!cleanEmail) {
      setEmailError(text("أدخل بريدك الإلكتروني.", "Enter your email address."));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError(
        text(
          "أدخل بريدًا إلكترونيًا صالحًا، مثل name@example.com.",
          "Enter a valid email address, such as name@example.com.",
        ),
      );
      return;
    }

    if (mode === "forgot") {
      submitInFlightRef.current = true;
      setSubmitting(true);
      try {
        const resetResult = await auth.requestPasswordReset(cleanEmail);
        if (resetResult.error) {
          setError(authErrorMessage({ message: resetResult.error }, "recovery", text));
          return;
        }
        setMessage(
          text(
            "إذا كان البريد مسجلاً، ستصلك رسالة لإعادة تعيين كلمة المرور. تحقق من البريد الوارد أو الرسائل غير المرغوب بها.",
            "If the email is registered, you will receive a password reset message. Check your inbox or spam folder.",
          ),
        );
      } catch (error) {
        setError(authErrorMessage(error instanceof Error ? error : null, "recovery", text));
      } finally {
        submitInFlightRef.current = false;
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setError(
        text(
          "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
          "Password must be at least 6 characters.",
        ),
      );
      return;
    }
    if (mode === "register" && cleanName.length < 2) {
      setError(text("أدخل اسما واضحا للحساب.", "Enter a clear account name."));
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    try {
      const result =
        mode === "login"
          ? await auth.signInWithPassword(cleanEmail, password)
          : await auth.signUpWithPassword(cleanEmail, password, cleanName);

      if (result.error) {
        setError(
          authErrorMessage(
            { message: result.error },
            mode === "login" ? "login" : "register",
            text,
          ),
        );
        return;
      }

      if (mode === "register") {
        setMessage(
          text("تم إنشاء الحساب. جارٍ إدخالك إلى رواج.", "Account created. Opening RAWAJ now."),
        );
        await navigate({ to: returnTo });
        return;
      }

      setMessage(text("تم تسجيل الدخول", "Logged in"));
      await navigate({ to: returnTo });
    } catch (error) {
      setError(
        authErrorMessage(
          error instanceof Error ? error : null,
          mode === "login" ? "login" : "register",
          text,
        ),
      );
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title={text("الحساب", "Account")} titleIsPageHeading={false} />
      <main className="rawaj-auth-v2 rawaj-auth-premium-v3 rawaj-auth-audit-v12 container-wide mobile-page-bottom pt-3 sm:pt-5">
        <section className="rawaj-auth-layout">
          <AuthExperienceAside mode={mode} />
          <div className="rawaj-auth-card">
            <AuthExperienceHeader mode={mode} />

            {mode !== "forgot" ? (
              <div
                className="rawaj-auth-tabs"
                role="tablist"
                aria-label={text("اختيار نوع الدخول", "Choose account action")}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  aria-controls="rawaj-auth-form"
                  onClick={() => switchMode("login")}
                  data-active={mode === "login"}
                >
                  {text("تسجيل الدخول", "Log in")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "register"}
                  aria-controls="rawaj-auth-form"
                  onClick={() => switchMode("register")}
                  data-active={mode === "register"}
                >
                  {text("إنشاء حساب", "Register")}
                </button>
              </div>
            ) : null}

            {auth.status === "authUnavailable" ? (
              <div className="rawaj-auth-state p-3.5" data-tone="warning" role="alert">
                {text(
                  "خدمة الحسابات غير متاحة الآن. يمكنك تصفح الإعلانات والمحاولة لاحقاً.",
                  "Account service is unavailable right now. You can browse listings and try again later.",
                )}
              </div>
            ) : (
              <form
                id="rawaj-auth-form"
                onSubmit={handleSubmit}
                className="space-y-3"
                noValidate
                aria-busy={submitting}
              >
                {mode === "register" && (
                  <FieldLabel label={text("اسم الحساب", "Account name")}>
                    <input
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      type="text"
                      autoComplete="name"
                      required
                      className="input"
                    />
                  </FieldLabel>
                )}

                <FieldLabel label={text("البريد الإلكتروني", "Email")}>
                  <input
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (emailError) setEmailError("");
                    }}
                    type="email"
                    autoComplete="email"
                    required
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? "login-email-error" : undefined}
                    className="input"
                  />
                  {emailError ? (
                    <p id="login-email-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                      {emailError}
                    </p>
                  ) : null}
                </FieldLabel>

                {mode !== "forgot" && (
                  <FieldLabel label={text("كلمة المرور", "Password")}>
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
                        className="rawaj-auth-password-toggle absolute inset-y-0 end-0 grid w-11 place-items-center"
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
                  </FieldLabel>
                )}

                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="rawaj-auth-forgot-link inline-flex rounded-lg px-1 py-1 font-semibold transition"
                  >
                    {text("نسيت كلمة المرور؟", "Forgot password?")}
                  </button>
                )}

                {submitting && (
                  <p
                    className="rawaj-auth-state p-2.5"
                    data-tone="loading"
                    role="status"
                    aria-live="polite"
                  >
                    {mode === "forgot"
                      ? text("جارٍ إرسال الرابط", "Sending link")
                      : mode === "login"
                        ? text("جاري تسجيل الدخول", "Logging in")
                        : text("جاري إنشاء الحساب", "Creating account")}
                  </p>
                )}
                {message && (
                  <p
                    role="status"
                    aria-live="polite"
                    className="rawaj-auth-state p-2.5"
                    data-tone="success"
                  >
                    {message}
                  </p>
                )}
                {error && (
                  <p role="alert" className="rawaj-auth-state p-2.5" data-tone="error">
                    {error}
                  </p>
                )}
                {auth.status === "authError" && (
                  <p role="alert" className="rawaj-auth-state p-2.5" data-tone="warning">
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
                    onClick={() => switchMode("login")}
                    className="rawaj-auth-back-link flex w-full text-center font-semibold transition"
                  >
                    {text("العودة لتسجيل الدخول", "Back to login")}
                  </button>
                )}
              </form>
            )}

            {mode !== "forgot" && (
              <>
                <div className="rawaj-auth-divider relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/80" />
                  </div>
                  <div className="relative flex justify-center font-semibold text-muted-foreground">
                    <span className="rounded-full px-3 py-1">{text("أو", "Or")}</span>
                  </div>
                </div>
                <GoogleButton returnTo={returnTo} />
              </>
            )}

            <div className="rawaj-auth-security-note">
              <ShieldCheck className="me-1 inline h-3.5 w-3.5 text-emerald-trust" />
              {text(
                "تتم حماية الحسابات والصلاحيات من خلال إعدادات المنصة المعتمدة.",
                "Accounts and permissions are protected through the platform's approved settings.",
              )}
            </div>

            <Link to="/" className="rawaj-auth-home-link mt-3 inline-flex font-semibold transition">
              {text("العودة للرئيسية", "Back to home")}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="rawaj-auth-field-label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
