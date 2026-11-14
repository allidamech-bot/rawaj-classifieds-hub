import {
  Check,
  CheckCircle2,
  CircleDashed,
  Cloud,
  CloudOff,
  Eye,
  ImagePlus,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export type ListingStudioStep = {
  label: string;
  description?: string;
};

export function ListingStudioShell({
  children,
  aside,
  mode = "create",
}: {
  children: ReactNode;
  aside?: ReactNode;
  mode?: "create" | "manage";
}) {
  return (
    <div className="rawaj-studio-shell" data-mode={mode}>
      <div className="rawaj-studio-shell__content">{children}</div>
      {aside ? <aside className="rawaj-studio-shell__aside">{aside}</aside> : null}
    </div>
  );
}

export function ListingStudioHero({
  eyebrow,
  title,
  description,
  status,
  actions,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className="rawaj-studio-hero"
      data-variant={compact ? "compact" : "default"}
      aria-labelledby="rawaj-studio-title"
    >
      <div className="rawaj-studio-hero__copy">
        <p className="rawaj-studio-hero__eyebrow">
          <Sparkles aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 id="rawaj-studio-title">{title}</h1>
        <p className="rawaj-studio-hero__description">{description}</p>
        {status ? <div className="rawaj-studio-hero__status">{status}</div> : null}
      </div>
      <div className="rawaj-studio-hero__visual" aria-hidden="true">
        <span>
          <ImagePlus />
        </span>
        <i />
        <b />
      </div>
      {actions ? <div className="rawaj-studio-hero__actions">{actions}</div> : null}
    </section>
  );
}

export function ListingStudioSteps({
  steps,
  current,
  maxReachable = current,
  onStepChange,
  progressLabel = "Listing progress",
}: {
  steps: ListingStudioStep[];
  current: number;
  maxReachable?: number;
  onStepChange?: (step: number) => void;
  progressLabel?: string;
}) {
  return (
    <ol className="rawaj-studio-steps" aria-label={progressLabel}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const reachable = index <= maxReachable;
        const content = (
          <>
            <span className="rawaj-studio-steps__index">
              {done ? <Check aria-hidden="true" /> : index + 1}
            </span>
            <span className="rawaj-studio-steps__copy">
              <strong>{step.label}</strong>
              {step.description ? <small>{step.description}</small> : null}
            </span>
            <span className="rawaj-studio-steps__line" aria-hidden="true" />
          </>
        );

        return (
          <li
            key={step.label}
            aria-current={active ? "step" : undefined}
            data-state={done ? "done" : active ? "active" : "upcoming"}
            data-reachable={reachable}
          >
            {onStepChange ? (
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onStepChange(index)}
                aria-label={step.label}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ListingStudioSection({
  title,
  description,
  children,
  tone = "default",
  icon,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "muted";
  icon?: ReactNode;
}) {
  return (
    <section className="rawaj-studio-section" data-tone={tone}>
      <div className="rawaj-studio-section__heading">
        {icon ? <span className="rawaj-studio-section__icon">{icon}</span> : null}
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="rawaj-studio-section__body">{children}</div>
    </section>
  );
}

export function ListingStudioMessage({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <div className="rawaj-studio-message" data-tone={tone}>
      {tone === "success" ? <CheckCircle2 aria-hidden="true" /> : null}
      <div>{children}</div>
    </div>
  );
}

export type ListingStudioAutosaveState = "idle" | "dirty" | "saving" | "saved" | "failed";

export function ListingStudioAutosaveStatus({
  state,
  error,
  lastSavedLabel,
  text,
}: {
  state: ListingStudioAutosaveState;
  error?: string | null;
  lastSavedLabel?: string | null;
  text: (ar: string, en: string) => string;
}) {
  if (state === "idle") return null;

  const Icon =
    state === "saving"
      ? Loader2
      : state === "failed"
        ? CloudOff
        : state === "saved"
          ? Cloud
          : CircleDashed;
  const label =
    state === "dirty"
      ? text("تغييرات بانتظار الحفظ", "Changes waiting to save")
      : state === "saving"
        ? text("جارٍ حفظ المسودة", "Saving draft")
        : state === "saved"
          ? text("تم حفظ المسودة", "Draft saved")
          : error || text("فشل حفظ المسودة تلقائياً", "Autosave failed");

  return (
    <div className="rawaj-studio-autosave" data-state={state} aria-live="polite">
      <Icon aria-hidden="true" className={state === "saving" ? "animate-spin" : undefined} />
      <strong>{label}</strong>
      {state === "saved" && lastSavedLabel ? <span>{lastSavedLabel}</span> : null}
    </div>
  );
}

export function ListingStudioPreview({
  imageUrl,
  title,
  category,
  price,
  location,
  imageCount,
  placeholder,
  text,
}: {
  imageUrl?: string | null;
  title: string;
  category: string;
  price: string;
  location: string;
  imageCount: number;
  placeholder?: ReactNode;
  text: (ar: string, en: string) => string;
}) {
  return (
    <section className="rawaj-studio-preview" aria-labelledby="rawaj-studio-preview-title">
      <div className="rawaj-studio-preview__heading">
        <div>
          <p>{text("معاينة مباشرة", "Live preview")}</p>
          <h2 id="rawaj-studio-preview-title">{text("شكل إعلانك", "Your listing")}</h2>
        </div>
        <span>{imageCount}</span>
      </div>
      <div className="rawaj-studio-preview__media">
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          (placeholder ?? <ImagePlus aria-hidden="true" />)
        )}
        <small>{text("الصورة الرئيسية", "Primary photo")}</small>
      </div>
      <div className="rawaj-studio-preview__body">
        <span>{category || text("اختر القسم", "Choose category")}</span>
        <h3>{title || text("عنوان إعلانك سيظهر هنا", "Your listing title appears here")}</h3>
        <strong>{price || text("السعر", "Price")}</strong>
        <p>
          <MapPin aria-hidden="true" />
          {location || text("اختر الموقع", "Choose location")}
        </p>
      </div>
    </section>
  );
}

export function ListingStudioQualityPanel({
  score,
  checks,
  text,
}: {
  score: number;
  checks: Array<{ label: string; done: boolean }>;
  text: (ar: string, en: string) => string;
}) {
  return (
    <section className="rawaj-studio-quality" aria-labelledby="rawaj-studio-quality-title">
      <div className="rawaj-studio-quality__score">
        <div>
          <p>{text("جودة الإعلان", "Listing quality")}</p>
          <h2 id="rawaj-studio-quality-title">{score}%</h2>
        </div>
        <span style={{ "--studio-score": `${score}%` } as CSSProperties} />
      </div>
      <div className="rawaj-studio-quality__track">
        <span style={{ width: `${score}%` }} />
      </div>
      <ul>
        {checks.map((check) => (
          <li key={check.label} data-done={check.done}>
            {check.done ? <CheckCircle2 aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
            {check.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ListingStudioTrustStrip({ text }: { text: (ar: string, en: string) => string }) {
  const items = [
    {
      icon: Cloud,
      label: text("مسودتك محفوظة تلقائياً", "Your draft is saved automatically"),
    },
    {
      icon: ShieldCheck,
      label: text("الإعلان يمر بمراجعة قبل النشر", "Listings are reviewed before publishing"),
    },
    {
      icon: Eye,
      label: text("عاين الإعلان قبل الإرسال", "Preview before submitting"),
    },
  ];

  return (
    <section
      className="rawaj-studio-trust-strip"
      aria-label={text("مزايا النشر", "Publishing benefits")}
    >
      {items.map(({ icon: Icon, label }) => (
        <div key={label}>
          <span>
            <Icon aria-hidden="true" />
          </span>
          <strong>{label}</strong>
        </div>
      ))}
    </section>
  );
}

export function ListingStudioCompletionCard({
  score,
  ready,
  title,
  body,
  text,
}: {
  score: number;
  ready: boolean;
  title: string;
  body: string;
  text: (ar: string, en: string) => string;
}) {
  return (
    <section className="rawaj-studio-completion" data-ready={ready}>
      <span className="rawaj-studio-completion__icon">
        {ready ? <CheckCircle2 aria-hidden="true" /> : <WandSparkles aria-hidden="true" />}
      </span>
      <div>
        <p>{text("جاهزية الإعلان", "Listing readiness")}</p>
        <h2>{title}</h2>
        <span>{body}</span>
      </div>
      <strong>{score}%</strong>
    </section>
  );
}

export function ListingStudioActionBar({ children }: { children: ReactNode }) {
  return <div className="rawaj-studio-action-bar">{children}</div>;
}
