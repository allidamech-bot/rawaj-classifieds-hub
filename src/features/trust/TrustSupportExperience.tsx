import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  ChevronLeft,
  CircleHelp,
  FileWarning,
  LifeBuoy,
  LockKeyhole,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { SupportRequest } from "@/lib/classifieds-types";
import type { Language } from "@/lib/ui-preferences";
import { supportStatusLabel } from "@/lib/status-labels";
import { useUiPreferences } from "@/lib/ui-preferences";

export function TrustHubHero({
  mode,
  displayName,
  location,
  avatarUrl,
  signedIn = false,
  verified = false,
  unreadActivity = 0,
  actions,
}: {
  mode: "more" | "support" | "safety";
  displayName?: string;
  location?: string;
  avatarUrl?: string | null;
  signedIn?: boolean;
  verified?: boolean;
  unreadActivity?: number;
  actions?: ReactNode;
}) {
  const { text } = useUiPreferences();
  const title =
    mode === "support"
      ? text("دعم واضح يمكن متابعته", "Support you can track")
      : mode === "safety"
        ? text("تعامل بوعي قبل أي اتفاق", "Deal carefully before any agreement")
        : signedIn
          ? text("مساحتك والخدمات المساندة", "Your space and supporting services")
          : text("اكتشف خدمات رواج المساندة", "Explore RAWAJ support services");
  const description =
    mode === "support"
      ? text(
          "أرسل طلباً محفوظاً، اربطه بإعلان عند الحاجة، وتابع حالته من الحساب نفسه دون وعود برد فوري.",
          "Submit a stored request, link it to a listing when relevant, and track its status without promises of an instant reply.",
        )
      : mode === "safety"
        ? text(
            "رواج يربط المستخدمين ولا يدير الدفع أو الضمان أو الإسكرو. المعاينة والتحقق مسؤولية الطرفين.",
            "RAWAJ connects users and does not handle payments, guarantees, or escrow. Inspection and verification remain the parties’ responsibility.",
          )
        : text(
            "إدارة الحساب والخدمات المساندة من نقطة وصول واحدة، بدون تكرار للاختصارات الموجودة في الترويسة.",
            "Manage your account and supporting services from one place without duplicating header shortcuts.",
          );
  const Icon = mode === "support" ? LifeBuoy : mode === "safety" ? ShieldAlert : Sparkles;

  return (
    <section className="rawaj-trust-hero" data-mode={mode}>
      <div className="rawaj-trust-hero__identity">
        {mode === "more" ? (
          <div className="rawaj-trust-hero__avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName ?? ""} decoding="async" />
            ) : (
              <Icon aria-hidden="true" />
            )}
          </div>
        ) : (
          <span className="rawaj-trust-hero__symbol">
            <Icon aria-hidden="true" />
          </span>
        )}
        <div>
          <p>
            {mode === "more"
              ? text("مركز المزيد", "More hub")
              : text("الثقة والمساعدة", "Trust and help")}
          </p>
          <h1>{mode === "more" && displayName ? displayName : title}</h1>
          {mode === "more" && displayName ? <strong>{title}</strong> : null}
          {location ? <small>{location}</small> : null}
        </div>
      </div>
      <p className="rawaj-trust-hero__description">{description}</p>
      <div className="rawaj-trust-hero__badges">
        <span>
          <ShieldCheck aria-hidden="true" />
          {text("إرشادات أمان واضحة", "Clear safety guidance")}
        </span>
        <span>
          <MessageSquareText aria-hidden="true" />
          {text("طلبات دعم محفوظة", "Stored support requests")}
        </span>
        {verified ? (
          <span>
            <BadgeCheck aria-hidden="true" />
            {text("حساب موثّق", "Verified account")}
          </span>
        ) : null}
        {unreadActivity > 0 ? (
          <b>
            {unreadActivity} {text("بحاجة لانتباه", "need attention")}
          </b>
        ) : null}
      </div>
      {mode !== "more" ? (
        <nav className="rawaj-trust-hero__actions">
          <Link to="/support">
            <LifeBuoy aria-hidden="true" />
            {text("الدعم", "Support")}
          </Link>
          <Link to="/safety">
            <ShieldAlert aria-hidden="true" />
            {text("الأمان", "Safety")}
          </Link>
          <Link to="/privacy">
            <LockKeyhole aria-hidden="true" />
            {text("الخصوصية", "Privacy")}
          </Link>
          {actions}
        </nav>
      ) : null}
    </section>
  );
}

export function TrustSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="rawaj-trust-section-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <span>{description}</span> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}

export function SafetyGuideCard({
  icon: Icon,
  title,
  items,
  warning = false,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  warning?: boolean;
}) {
  return (
    <section className="rawaj-safety-guide" data-warning={warning}>
      <header>
        <span>
          <Icon aria-hidden="true" />
        </span>
        <h2>{title}</h2>
      </header>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <ShieldCheck aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SupportRequestTimeline({
  requests,
  language,
}: {
  requests: SupportRequest[];
  language: Language;
}) {
  const { text } = useUiPreferences();
  if (requests.length === 0) {
    return (
      <div className="rawaj-trust-empty">
        <CircleHelp aria-hidden="true" />
        <p>{text("لا توجد طلبات دعم محفوظة حتى الآن.", "No stored support requests yet.")}</p>
      </div>
    );
  }

  return (
    <div className="rawaj-support-timeline">
      {requests.slice(0, 5).map((request) => (
        <article key={request.id} data-status={request.status}>
          <span className="rawaj-support-timeline__icon">
            <FileWarning aria-hidden="true" />
          </span>
          <div>
            <header>
              <h3>{request.subject}</h3>
              <b>{supportStatusLabel(request.status, language)}</b>
            </header>
            <p>{request.message}</p>
            {request.publicResponse ? <blockquote>{request.publicResponse}</blockquote> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function TrustLinkCard({
  to,
  icon: Icon,
  title,
  description,
  tone = "default",
}: {
  to:
    "/support" | "/safety" | "/privacy" | "/terms" | "/prohibited" | "/verification" | "/promotion";
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "default" | "primary" | "warning";
}) {
  return (
    <Link to={to} className="rawaj-trust-link-card" data-tone={tone}>
      <span>
        <Icon aria-hidden="true" />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
    </Link>
  );
}
