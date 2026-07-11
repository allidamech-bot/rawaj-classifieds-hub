import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, LogIn, User } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { authErrorMessage } from "@/lib/auth-errors";
import { sanitizeAuthReturnTo } from "@/lib/auth-return";
import { supabase } from "@/lib/supabase";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة | رواج" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { text } = useUiPreferences();
  const navigate = useNavigate();
  const locationSearch = useRouterState({ select: (state) => state.location.search });
  const looseSearch = locationSearch as unknown as Record<string, unknown>;
  const rawReturnTo = typeof looseSearch.returnTo === "string" ? looseSearch.returnTo : undefined;
  const returnTo = sanitizeAuthReturnTo(rawReturnTo, "/more");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeAuth: (() => void) | undefined;

    async function checkSession() {
      const client = supabase;
      if (!client) {
        if (!cancelled) {
          setChecking(false);
          setReady(false);
        }
        return;
      }

      const markReady = () => {
        if (cancelled) return;
        clearTimeout(expiryTimer);
        setReady(true);
        setChecking(false);
      };

      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (!session) return;
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          markReady();
        }
      });
      unsubscribeAuth = () => listener.subscription.unsubscribe();

      const { data, error: sessionError } = await client.auth.getSession();
      if (cancelled) return;
      if (!sessionError && data.session) {
        markReady();
        return;
      }

      expiryTimer = setTimeout(async () => {
        if (cancelled) return;
        const { data: lateSession, error: lateError } = await client.auth.getSession();
        if (cancelled) return;
        setReady(Boolean(!lateError && lateSession.session));
        setChecking(false);
      }, 15000);
    }

    void checkSession();
    return () => {
      cancelled = true;
      clearTimeout(expiryTimer);
      unsubscribeAuth?.();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (password.length < 6) {
      setError(
        text(
          "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
          "Password must be at least 6 characters.",
        ),
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(text("تأكيد كلمة المرور غير مطابق.", "Password confirmation does not match."));
      return;
    }

    const client = supabase;
    if (!client) {
      setError(
        text(
          "خدمة الحسابات غير متاحة الآن. حاول لاحقاً.",
          "Account service is unavailable right now. Try later.",
        ),
      );
      return;
    }

    setSaving(true);
    const { error: updateError } = await client.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(authErrorMessage(updateError, "update-password", text));
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessage(
      text(
        "تم تحديث كلمة المرور. جارٍ إعادتك إلى الصفحة التي كنت تريدها.",
        "Password updated. Returning you to the page you wanted.",
      ),
    );
    setTimeout(() => void navigate({ to: returnTo }), 700);
  }

  const loginDestination = `/login?mode=forgot&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <>
      <PageHeader
        title={text("تعيين كلمة مرور جديدة", "Set a new password")}
        to="/login"
        backMode="history"
      />
      <main className="container-wide pb-24 pt-3 sm:pt-5">
        <section className="rawaj-hero-surface mx-auto max-w-md rounded-[1.65rem] p-5 sm:rounded-[1.9rem] sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1.05rem] bg-primary text-primary-foreground shadow-[0_9px_22px_rgba(16,43,70,0.16)]">
              <KeyRound className="h-5 w-5 text-gold" />
            </span>
            <div>
              <h1 className="text-base font-bold text-primary sm:text-lg">
                {text("تعيين كلمة مرور جديدة", "Set a new password")}
              </h1>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "اكتب كلمة مرور جديدة لحسابك ثم احفظ التغيير.",
                  "Enter a new password for your account and save the change.",
                )}
              </p>
            </div>
          </div>

          {checking ? (
            <Panel
              title={text(
                "جارٍ تجهيز جلسة الاستعادة الآمنة...",
                "Preparing the secure recovery session...",
              )}
            />
          ) : !ready ? (
            <div className="rounded-[1.1rem] border border-border/70 bg-card-warm/70 p-4 text-xs leading-6 text-muted-foreground">
              <p>
                {text(
                  "لم نتمكن من تجهيز جلسة الاستعادة بعد الانتظار. قد يكون الرابط منتهيًا أو استُخدم سابقًا. افتح أحدث رابط من بريدك أو اطلب رابطًا جديدًا.",
                  "We could not prepare the recovery session after waiting. The link may be expired or already used. Open the newest email link or request a new one.",
                )}
              </p>
              <button
                type="button"
                onClick={() => window.location.assign(loginDestination)}
                className="rawaj-button-primary mt-3 px-4 py-2"
              >
                {text("طلب رابط جديد", "Request a new link")}
              </button>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
                  {text("كلمة المرور الجديدة", "New password")}
                </span>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="input pe-11"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((value) => !value)}
                    className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-lg text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    aria-label={
                      passwordVisible
                        ? text("إخفاء كلمة المرور", "Hide password")
                        : text("إظهار كلمة المرور", "Show password")
                    }
                  >
                    {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
                  {text("تأكيد كلمة المرور", "Confirm password")}
                </span>
                <div className="relative">
                  <input
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    type={confirmVisible ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className="input pe-11"
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmVisible((value) => !value)}
                    className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-lg text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                    aria-label={
                      confirmVisible
                        ? text("إخفاء تأكيد كلمة المرور", "Hide password confirmation")
                        : text("إظهار تأكيد كلمة المرور", "Show password confirmation")
                    }
                  >
                    {confirmVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              {error && (
                <p className="rounded-[1rem] border border-destructive/15 bg-destructive/8 p-2.5 text-xs font-medium text-destructive">
                  {error}
                </p>
              )}
              {message && (
                <p className="rounded-[1rem] border border-emerald-trust/15 bg-emerald-trust/8 p-2.5 text-xs font-medium text-emerald-trust">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="rawaj-button-primary min-h-11 w-full rounded-[1rem] px-4 py-2.5 disabled:opacity-60"
              >
                {saving
                  ? text("جارٍ الحفظ", "Saving")
                  : text("تحديث كلمة المرور", "Update password")}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/profile"
                  className="rawaj-chip items-center justify-center gap-1 px-3 py-2 font-semibold text-primary transition hover:border-gold/40"
                >
                  <User className="h-4 w-4" />
                  {text("فتح حسابي", "Open profile")}
                </Link>
                <button
                  type="button"
                  onClick={() => window.location.assign(loginDestination)}
                  className="rawaj-chip items-center justify-center gap-1 px-3 py-2 font-semibold text-primary transition hover:border-gold/40"
                >
                  <LogIn className="h-4 w-4" />
                  {text("تسجيل الدخول", "Log in")}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </>
  );
}

function Panel({ title }: { title: string }) {
  return (
    <div className="rounded-[1.1rem] border border-border/70 bg-card-warm/70 p-4 text-center text-xs font-semibold text-muted-foreground">
      {title}
    </div>
  );
}
