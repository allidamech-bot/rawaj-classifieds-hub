import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "تسجيل الدخول | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: LoginPage,
});

type AuthMode = "login" | "register";

function LoginPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
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
      setError(
        text(
          "تعذر الوصول إلى خدمة الحسابات الآن. التصفح العام متاح ويمكنك المحاولة مرة أخرى.",
          "Account service is unavailable right now. Public browsing is available and you can try again.",
        ),
      );
      return;
    }

    const cleanEmail = email.trim();
    const cleanName = displayName.trim();

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
          "تعذر تحضير بيانات الحساب بعد المصادقة. يحتاج المشرف إلى مراجعة إعدادات Supabase.",
          "Account authentication worked, but the profile could not be prepared. An administrator must review the Supabase setup.",
        ),
      );
      return;
    }

    if (mode === "register") {
      setMessage(
        result.data.session
          ? text(
              "تم إنشاء الحساب. إذا لم تظهر بيانات الحساب، يحتاج المشروع إلى تهيئة إنشاء الملف الشخصي في Supabase.",
              "Account created. If account data does not appear, the project needs Supabase profile bootstrap configuration.",
            )
          : text(
              "تم إرسال طلب إنشاء الحساب. راجع بريدك إذا كان تأكيد البريد مطلوبا في Supabase.",
              "Account request sent. Check your email if email confirmation is required in Supabase.",
            ),
      );
      return;
    }

    setMessage(text("تم تسجيل الدخول", "Logged in"));
    void navigate({ to: "/profile" });
  }

  return (
    <>
      <PageHeader title={text("الحساب", "Account")} />
      <main className="container-wide pt-4 pb-10">
        <section className="mx-auto max-w-md rounded-2xl bg-card p-5 hairline shadow-soft">
          <div className="mb-4 flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Lock className="h-5 w-5 text-gold" />
            </span>
            <div>
              <h1 className="text-base font-extrabold">
                {mode === "login"
                  ? text("دخول الحساب", "Account login")
                  : text("إنشاء حساب", "Create account")}
              </h1>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {mode === "login"
                  ? text(
                      "سجل الدخول ببريدك وكلمة المرور لإدارة إعلاناتك.",
                      "Log in with your email and password to manage your listings.",
                    )
                  : text(
                      "إنشاء الحساب يستخدم Supabase Auth مباشرة. تفعيل الحساب النهائي يعتمد على إعدادات البريد والملف الشخصي في Supabase.",
                      "Account creation uses Supabase Auth directly. Final activation depends on Supabase email and profile settings.",
                    )}
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-muted-surface p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
                setError("");
              }}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "login" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
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
              className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === "register" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}
            >
              {text("إنشاء حساب", "Register")}
            </button>
          </div>

          {auth.status === "authUnavailable" ? (
            <div className="rounded-xl bg-warning/10 p-3 text-xs text-foreground/90 hairline">
              {auth.reason ??
                text(
                  "تعذر الوصول إلى خدمة الحسابات الآن. التصفح العام متاح ويمكنك المحاولة مرة أخرى.",
                  "Account service is unavailable right now. Public browsing is available and you can try again.",
                )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">
                    {text("اسم الحساب", "Account name")}
                  </span>
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    type="text"
                    autoComplete="name"
                    required
                    className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  {text("البريد الإلكتروني", "Email")}
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
                  {text("كلمة المرور", "Password")}
                </span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  minLength={6}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </label>

              {submitting && (
                <p className="rounded-xl bg-muted-surface p-2 text-xs font-bold text-muted-foreground">
                  {mode === "login"
                    ? text("جاري تسجيل الدخول", "Logging in")
                    : text("جاري إنشاء الحساب", "Creating account")}
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
                  {text("الحساب غير جاهز أو غير مصرح.", "Account is not ready or not authorized.")}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {mode === "login" ? (
                  <LogIn className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {mode === "login" ? text("تسجيل الدخول", "Log in") : text("إنشاء حساب", "Register")}
              </button>
            </form>
          )}

          <div className="mt-4 rounded-xl bg-muted-surface p-3 text-[11px] leading-6 text-muted-foreground">
            <ShieldCheck className="me-1 inline h-3.5 w-3.5 text-emerald-trust" />
            {text(
              "صلاحيات المالك والمشرفين تقرأ من جدول الأدوار فقط، ولا تمنح من الواجهة أو من البريد داخل المتصفح.",
              "Owner and moderator permissions are read only from role tables, not granted in the frontend or by browser email checks.",
            )}
          </div>

          <Link to="/" className="mt-4 inline-flex text-xs font-bold text-primary">
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

  const { error } = await client.from("profiles").insert({
    id: user.id,
    email: user.email ?? null,
    display_name: displayName.trim() || metadataName,
  });

  if (!error || error.code === "23505") return null;
  return error.message;
}
