import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, LogIn, User } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "تعيين كلمة مرور جديدة | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { text } = useUiPreferences();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function checkSession() {
      const client = supabase;
      if (!client) {
        setChecking(false);
        setReady(false);
        return;
      }
      const { data } = await client.auth.getSession();
      if (cancelled) return;
      setReady(Boolean(data.session));
      setChecking(false);
    }
    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (password.length < 6) {
      setError(text("كلمة المرور يجب أن تكون 6 أحرف على الأقل.", "Password must be at least 6 characters."));
      return;
    }
    if (password !== confirmPassword) {
      setError(text("تأكيد كلمة المرور غير مطابق.", "Password confirmation does not match."));
      return;
    }
    const client = supabase;
    if (!client) {
      setError(text("خدمة الحسابات غير متاحة الآن. حاول لاحقاً.", "Account service is unavailable right now. Try later."));
      return;
    }
    setSaving(true);
    const { error: updateError } = await client.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(text("تعذر تحديث كلمة المرور الآن. اطلب رابطاً جديداً وحاول مرة أخرى.", "Could not update the password right now. Request a new link and try again."));
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setMessage(text("تم تحديث كلمة المرور. يمكنك متابعة استخدام حسابك.", "Password updated. You can continue using your account."));
  }

  return (
    <>
      <PageHeader title={text("تعيين كلمة مرور جديدة", "Set a new password")} to="/login" backMode="history" />
      <main className="container-wide pt-4 pb-24">
        <section className="mx-auto max-w-md rounded-2xl bg-card p-5 shadow-soft hairline">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <KeyRound className="h-5 w-5 text-gold" />
            </span>
            <div>
              <h1 className="text-base font-extrabold">{text("تعيين كلمة مرور جديدة", "Set a new password")}</h1>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "اكتب كلمة مرور جديدة لحسابك ثم احفظ التغيير.",
                  "Enter a new password for your account and save the change.",
                )}
              </p>
            </div>
          </div>

          {checking ? (
            <Panel title={text("جارٍ تجهيز الصفحة", "Preparing the page")} />
          ) : !ready ? (
            <div className="rounded-xl bg-muted-surface p-4 text-xs leading-6 text-muted-foreground hairline">
              <p>
                {text(
                  "افتح رابط إعادة التعيين من بريدك الإلكتروني أو اطلب رابطاً جديداً.",
                  "Open the reset link from your email or request a new link.",
                )}
              </p>
              <Link
                to="/login"
                className="mt-3 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                {text("العودة لتسجيل الدخول", "Back to login")}
              </Link>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  {text("كلمة المرور الجديدة", "New password")}
                </span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  className="input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  {text("تأكيد كلمة المرور", "Confirm password")}
                </span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  className="input"
                />
              </label>
              {error && <p className="rounded-xl bg-destructive/10 p-2 text-xs font-bold text-destructive">{error}</p>}
              {message && <p className="rounded-xl bg-emerald-trust/10 p-2 text-xs font-bold text-emerald-trust">{message}</p>}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {saving ? text("جارٍ الحفظ", "Saving") : text("تحديث كلمة المرور", "Update password")}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <Link to="/profile" className="inline-flex items-center justify-center gap-1 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline">
                  <User className="h-4 w-4" />
                  {text("فتح حسابي", "Open profile")}
                </Link>
                <Link to="/login" className="inline-flex items-center justify-center gap-1 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline">
                  <LogIn className="h-4 w-4" />
                  {text("تسجيل الدخول", "Log in")}
                </Link>
              </div>
            </form>
          )}
        </section>
      </main>
    </>
  );
}

function Panel({ title }: { title: string }) {
  return <div className="rounded-xl bg-muted-surface p-4 text-center text-xs font-bold hairline">{title}</div>;
}
