import { Bug, CircleAlert, Lightbulb, MessageSquare, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { fetchFeedbackConfig, submitFeedback, type FeedbackType } from "@/lib/api/feedback";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const DRAFT_KEY = "rawaj-feedback-draft-v1";
const TEASER_SESSION_KEY = "rawaj-feedback-teaser-shown";
const TEASER_DURATION_MS = 5000;

type Draft = {
  type: FeedbackType;
  subject: string;
  message: string;
};

const EMPTY_DRAFT: Draft = { type: "technical_issue", subject: "", message: "" };

export function FeedbackWidget({
  pathname,
  triggerHidden = false,
}: {
  pathname: string;
  triggerHidden?: boolean;
}) {
  const auth = useAuth();
  const { language, theme, isArabic, text } = useUiPreferences();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [showTeaser, setShowTeaser] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (force = false) => {
      const result = await fetchFeedbackConfig(force);
      if (!cancelled) setEnabled(result.ok ? result.data.enabled : false);
    };
    void load();
    const onChange = () => void load(true);
    window.addEventListener("rawaj:feedback-config-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("rawaj:feedback-config-changed", onChange);
    };
  }, []);

  useEffect(() => {
    if (enabled !== true || triggerHidden) return;
    try {
      const shownThisSession = window.sessionStorage.getItem(TEASER_SESSION_KEY);
      if (!shownThisSession) {
        setShowTeaser(true);
        window.sessionStorage.setItem(TEASER_SESSION_KEY, "1");
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const delay = reduceMotion ? Math.min(TEASER_DURATION_MS, 2000) : TEASER_DURATION_MS;
        const timer = window.setTimeout(() => setShowTeaser(false), delay);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // sessionStorage may be unavailable; skip teaser silently.
    }
  }, [enabled, triggerHidden]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DRAFT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Draft>;
        const type: FeedbackType = ["complaint", "suggestion", "technical_issue", "other"].includes(
          parsed.type ?? "",
        )
          ? (parsed.type as FeedbackType)
          : "technical_issue";
        setDraft({
          type,
          subject: typeof parsed.subject === "string" ? parsed.subject.slice(0, 160) : "",
          message: typeof parsed.message === "string" ? parsed.message.slice(0, 3000) : "",
        });
      }

      const url = new URL(window.location.href);
      if (url.searchParams.get("feedback") === "1") {
        setOpen(true);
        url.searchParams.delete("feedback");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // Storage and URL recovery are best-effort only.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    try {
      if (draft.subject.trim() || draft.message.trim()) {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch {
      // Draft persistence is best-effort only.
    }
  }, [draft, open]);

  useEffect(() => {
    if (enabled === false && open) setOpen(false);
  }, [enabled, open]);

  useEffect(() => {
    if (showTeaser) setShowTeaser(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting]);

  const signInHref = useMemo(() => {
    if (typeof window === "undefined") return "/login";
    const returnUrl = new URL(window.location.href);
    returnUrl.searchParams.set("feedback", "1");
    const returnTo = `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`;
    return `/login?returnTo=${encodeURIComponent(returnTo)}`;
  }, [pathname, open]);

  function updateDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
    setNeedsSignIn(false);
    setSuccess(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const subject = draft.subject.trim();
    const message = draft.message.trim();
    if (subject.length < 4) {
      setNotice(
        text(
          "اكتب عنواناً واضحاً من 4 أحرف على الأقل.",
          "Enter a subject of at least 4 characters.",
        ),
      );
      return;
    }
    if (message.length < 10) {
      setNotice(
        text("اكتب تفاصيل أوضح من 10 أحرف على الأقل.", "Enter at least 10 characters of detail."),
      );
      return;
    }

    if (auth.status !== "signedIn") {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, subject, message }));
      } catch {
        // Continue to sign-in even if storage is unavailable.
      }
      setNeedsSignIn(true);
      setNotice(
        text(
          "سجّل الدخول لإرسال الملاحظة. حفظنا ما كتبته على هذا الجهاز.",
          "Sign in to send this feedback. Your draft is saved on this device.",
        ),
      );
      return;
    }

    setSubmitting(true);
    setNeedsSignIn(false);
    setNotice("");
    try {
      const result = await submitFeedback({
        type: draft.type,
        subject,
        message,
        context: {
          path: pathname,
          url: `${window.location.origin}${pathname}`.slice(0, 1000),
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          language,
          theme,
          clientTimestamp: new Date().toISOString(),
          userAgent: window.navigator.userAgent.slice(0, 500),
        },
      });
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }
      setDraft(EMPTY_DRAFT);
      setSuccess(true);
      setNotice(
        text(
          "وصلتنا ملاحظتك، شكراً لمساعدتنا في تحسين رواج.",
          "We received your feedback. Thank you for helping us improve RAWAJ.",
        ),
      );
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Ignore storage cleanup failures.
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (enabled !== true) return null;

  const typeOptions: Array<{
    value: FeedbackType;
    label: string;
    icon: typeof Bug;
  }> = [
    { value: "technical_issue", label: text("مشكلة تقنية", "Technical issue"), icon: Bug },
    { value: "complaint", label: text("شكوى", "Complaint"), icon: CircleAlert },
    { value: "suggestion", label: text("اقتراح", "Suggestion"), icon: Lightbulb },
    { value: "other", label: text("أخرى", "Other"), icon: MessageSquare },
  ];

  const triggerLabel = text("اقتراح أو شكوى", "Suggestion or complaint");
  const teaserLine1 = text("عندك اقتراح أو شكوى؟", "Have a suggestion or complaint?");
  const teaserLine2 = text("أرسلها لنا", "Send it to us");

  return (
    <>
      {!triggerHidden ? (
        <div
          className={`group rawaj-feedback-trigger fixed z-[58] ${isArabic ? "left-2 sm:left-3" : "right-2 sm:right-3"}`}
          style={{ bottom: "calc(var(--rawaj-mobile-obstruction, 0px) + 5.5rem)" }}
          data-feedback-trigger="true"
          data-teaser-visible={showTeaser ? "true" : "false"}
        >
          {showTeaser ? (
            <button
              type="button"
              onClick={() => {
                setShowTeaser(false);
                setOpen(true);
                setSuccess(false);
                setNotice("");
                setNeedsSignIn(false);
              }}
              className="rawaj-feedback-teaser flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 px-3 py-2.5 text-white shadow-xl ring-2 ring-white/30 transition hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
              aria-label={`${teaserLine1} ${teaserLine2}`}
            >
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex flex-col items-start text-right leading-tight">
                <span className="text-[11px] font-bold">{teaserLine1}</span>
                <span className="text-[10px] font-semibold opacity-90">{teaserLine2}</span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setSuccess(false);
                setNotice("");
                setNeedsSignIn(false);
              }}
              className="rawaj-feedback-button grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 text-white shadow-xl ring-2 ring-white/25 transition hover:scale-105 hover:from-pink-600 hover:via-fuchsia-600 hover:to-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-fuchsia-400/60"
              aria-label={triggerLabel}
              title={triggerLabel}
            >
              <MessageSquare className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {!showTeaser ? (
            <span
              className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-bold text-background opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 sm:block ${isArabic ? "left-full ml-2" : "right-full mr-2"}`}
              aria-hidden="true"
            >
              {triggerLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) setOpen(false);
          }}
          role="presentation"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rawaj-feedback-title"
            className="max-h-[min(88dvh,720px)] w-full overflow-y-auto rounded-t-3xl bg-card p-4 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-primary">
                  {text("ساعدنا نحسّن رواج", "Help us improve RAWAJ")}
                </p>
                <h2 id="rawaj-feedback-title" className="mt-1 text-lg font-extrabold">
                  {text("إرسال اقتراح أو شكوى", "Send suggestion or complaint")}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {text(
                    "أرسل لنا المشكلة أو الفكرة، وسنرفق معلومات تقنية بسيطة عن الصفحة لمساعدتنا على تشخيصها.",
                    "Tell us about an issue or idea. Basic page diagnostics will be attached to help us investigate.",
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted-surface"
                aria-label={text("إغلاق", "Close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => void submit(event)}
              aria-busy={submitting}
            >
              <fieldset>
                <legend className="mb-2 text-xs font-extrabold">
                  {text("نوع الملاحظة", "Feedback type")}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {typeOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = draft.type === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateDraft("type", option.value)}
                        className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}
                        aria-pressed={selected}
                      >
                        <Icon className="h-4 w-4" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold">
                  {text("العنوان", "Subject")}
                </span>
                <input
                  value={draft.subject}
                  onChange={(event) => updateDraft("subject", event.target.value.slice(0, 160))}
                  maxLength={160}
                  className="input"
                  placeholder={text(
                    "مثال: زر إضافة الصورة لا يعمل",
                    "Example: image upload button does not work",
                  )}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold">
                  {text("التفاصيل", "Details")}
                </span>
                <textarea
                  value={draft.message}
                  onChange={(event) => updateDraft("message", event.target.value.slice(0, 3000))}
                  maxLength={3000}
                  rows={5}
                  className="input min-h-32 resize-y"
                  placeholder={text(
                    "شو صار معك؟ وشو كنت متوقع يصير؟",
                    "What happened, and what did you expect to happen?",
                  )}
                />
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {draft.message.length}/3000
                </span>
              </label>

              <div className="rounded-xl bg-muted-surface px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                {text(
                  `سيُرفق تلقائياً: الصفحة الحالية، حجم الشاشة، اللغة ووقت الإرسال. لن نطلب منك معلومات حساسة.`,
                  `Attached automatically: current page, screen size, language, and submission time. We do not ask for sensitive information.`,
                )}
              </div>

              {notice ? (
                <div
                  className={`rounded-xl px-3 py-2 text-xs font-semibold ${success ? "bg-success/10 text-success" : "bg-warning/10 text-foreground"}`}
                  role="status"
                >
                  {notice}
                </div>
              ) : null}

              {needsSignIn ? (
                <a
                  href={signInHref}
                  className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground"
                >
                  {text("تسجيل الدخول والمتابعة", "Sign in and continue")}
                </a>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || success}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {submitting
                    ? text("جاري الإرسال...", "Sending...")
                    : success
                      ? text("تم الإرسال", "Sent")
                      : text("إرسال للإدارة", "Send to management")}
                </button>
              )}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
