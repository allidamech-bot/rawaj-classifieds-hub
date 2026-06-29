import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, LogIn, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "تسجيل الدخول | رَوَاج" }] }),
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const client = supabase;
    if (!client) {
      setError("تسجيل الدخول غير متاح حالياً. يلزم ضبط Supabase أولاً.");
      return;
    }

    setSubmitting(true);
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (error) {
      setError("خطأ في البريد أو كلمة المرور");
      return;
    }

    setMessage("تم تسجيل الدخول");
    navigate({ to: "/profile" });
  }

  return (
    <>
      <PageHeader title="تسجيل الدخول" />
      <main className="container-wide pt-4 pb-10">
        <section className="mx-auto max-w-md rounded-2xl bg-card p-5 hairline shadow-soft">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Lock className="h-5 w-5 text-gold" />
            </span>
            <div>
              <h1 className="text-base font-extrabold">دخول الحساب</h1>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                استخدم بريدك وكلمة المرور المسجلة في Supabase. لا يوجد إنشاء حساب من الواجهة حالياً.
              </p>
            </div>
          </div>

          {auth.status === "authUnavailable" ? (
            <div className="rounded-xl bg-warning/10 p-3 text-xs text-foreground/90 hairline">
              الحسابات غير مهيأة حالياً. التصفح العام لا يزال متاحاً.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  البريد الإلكتروني
                </span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  كلمة المرور
                </span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </label>

              {submitting && (
                <p className="rounded-xl bg-muted-surface p-2 text-xs font-bold text-muted-foreground">
                  جارٍ تسجيل الدخول
                </p>
              )}
              {message && (
                <p className="rounded-xl bg-emerald-trust/10 p-2 text-xs font-bold text-emerald-trust">
                  {message}
                </p>
              )}
              {error && (
                <p className="rounded-xl bg-destructive/10 p-2 text-xs font-bold text-destructive">
                  {error}
                </p>
              )}
              {auth.status === "authError" && (
                <p className="rounded-xl bg-warning/10 p-2 text-xs font-bold text-warning">
                  الحساب غير جاهز أو غير مصرح
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                تسجيل الدخول
              </button>
            </form>
          )}

          <div className="mt-4 rounded-xl bg-muted-surface p-3 text-[11px] leading-6 text-muted-foreground">
            <ShieldCheck className="me-1 inline h-3.5 w-3.5 text-emerald-trust" />
            صلاحيات المالك والمشرفين تُقرأ من جدول الأدوار في Supabase فقط، ولا تعتمد على البريد
            داخل الواجهة.
          </div>

          <Link to="/" className="mt-4 inline-flex text-xs font-bold text-primary">
            العودة للرئيسية
          </Link>
        </section>
      </main>
    </>
  );
}
