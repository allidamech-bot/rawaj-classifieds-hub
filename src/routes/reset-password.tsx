import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  clearPasswordRecoverySession,
  hasActivePasswordRecoverySession,
  markPasswordRecoverySession,
} from "@/lib/auth-recovery-session";
import { sanitizeAuthReturnTo } from "@/lib/auth-return";
import { supabaseAuth } from "@/lib/supabase-auth";
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
  const returnTo = sanitizeAuthReturnTo(
    typeof looseSearch.returnTo === "string" ? looseSearch.returnTo : undefined,
    "/more",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    const client = supabaseAuth;
    if (!client) {
      setChecking(false);
      return;
    }

    let active = true;
    const accept = (session: Session) => {
      if (!active || !hasActivePasswordRecoverySession(session.user.id)) return;
      setRecoveryUserId(session.user.id);
      setChecking(false);
    };

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        markPasswordRecoverySession(session.user.id);
        accept(session);
      }
    });

    void client.auth.getSession().then(({ data }) => {
      if (data.session) accept(data.session);
    });

    const timeout = window.setTimeout(() => {
      if (active) setChecking(false);
    }, 15_000);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlightRef.current) return;
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

    const client = supabaseAuth;
    if (!client || !recoveryUserId) {
      setError(
        text(
          "جلسة الاستعادة غير صالحة. اطلب رابطًا جديدًا.",
          "The recovery session is invalid. Request a new link.",
        ),
      );
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      if (
        sessionError ||
        currentUserId !== recoveryUserId ||
        !hasActivePasswordRecoverySession(currentUserId)
      ) {
        clearPasswordRecoverySession();
        setRecoveryUserId(null);
        setError(
          text(
            "انتهت جلسة الاستعادة. اطلب رابطًا جديدًا.",
            "The recovery session expired. Request a new link.",
          ),
        );
        return;
      }

      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) {
        setError(authErrorMessage(updateError, "update-password", text));
        return;
      }

      clearPasswordRecoverySession();
      setPassword("");
      setConfirmPassword("");
      setMessage(text("تم تحديث كلمة المرور.", "Password updated."));
      window.setTimeout(() => void navigate({ to: returnTo }), 700);
    } catch (caught) {
      setError(authErrorMessage(caught instanceof Error ? caught : null, "update-password", text));
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  const requestNewLink = () =>
    window.location.assign(`/login?mode=forgot&returnTo=${encodeURIComponent(returnTo)}`);

  return (
    <>
      <PageHeader
        title={text("تعيين كلمة مرور جديدة", "Set a new password")}
        to="/login"
        backMode="history"
      />
      <main className="rawaj-auth-recovery-v3 container-wide pb-24 pt-3 sm:pt-5">
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
                  "Enter a new password and save the change.",
                )}
              </p>
            </div>
          </div>

          {checking ? (
            <div className="rounded-[1.1rem] border border-border/70 bg-card-warm/70 p-4 text-xs leading-6 text-muted-foreground">
              {text("جارٍ التحقق من جلسة الاستعادة...", "Checking the recovery session...")}
            </div>
          ) : !recoveryUserId ? (
            <div className="rounded-[1.1rem] border border-border/70 bg-card-warm/70 p-4 text-xs leading-6 text-muted-foreground">
              <p>
                {text(
                  "الرابط غير صالح أو منتهي. اطلب رابطًا جديدًا.",
                  "The link is invalid or expired. Request a new one.",
                )}
              </p>
              <button
                type="button"
                onClick={requestNewLink}
                className="rawaj-button-primary mt-3 px-4 py-2"
              >
                {text("طلب رابط جديد", "Request a new link")}
              </button>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} aria-busy={saving} className="space-y-3">
              <PasswordField
                label={text("كلمة المرور الجديدة", "New password")}
                value={password}
                visible={passwordVisible}
                saving={saving}
                onChange={setPassword}
                onToggle={() => setPasswordVisible((value) => !value)}
                showLabel={text("إظهار كلمة المرور", "Show password")}
                hideLabel={text("إخفاء كلمة المرور", "Hide password")}
              />
              <PasswordField
                label={text("تأكيد كلمة المرور", "Confirm password")}
                value={confirmPassword}
                visible={confirmVisible}
                saving={saving}
                onChange={setConfirmPassword}
                onToggle={() => setConfirmVisible((value) => !value)}
                showLabel={text("إظهار تأكيد كلمة المرور", "Show password confirmation")}
                hideLabel={text("إخفاء تأكيد كلمة المرور", "Hide password confirmation")}
              />
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
            </form>
          )}
        </section>
      </main>
    </>
  );
}

function PasswordField({
  label,
  value,
  visible,
  saving,
  onChange,
  onToggle,
  showLabel,
  hideLabel,
}: {
  label: string;
  value: string;
  visible: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      <div className="relative">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={6}
          required
          disabled={saving}
          className="input pe-11"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 end-0 grid w-11 place-items-center rounded-lg text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-label={visible ? hideLabel : showLabel}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
