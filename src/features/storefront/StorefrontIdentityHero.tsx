import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarDays,
  Eye,
  MapPin,
  Pencil,
  Plus,
  Star,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useUiPreferences } from "@/lib/ui-preferences";

interface StorefrontMetric {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "live" | "pending" | "action" | "closed";
}

interface StorefrontIdentityHeroProps {
  mode: "public" | "owner";
  sellerId: string;
  displayName: string;
  secondaryName?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  verified?: boolean;
  joinedAt?: string | null;
  ratingAverage?: number | null;
  ratingCount?: number;
  approvedCount: number;
  pendingCount?: number;
  needsEditCount?: number;
  closedCount?: number;
  extraActions?: ReactNode;
}

export function StorefrontIdentityHero({
  mode,
  sellerId,
  displayName,
  secondaryName,
  avatarUrl,
  coverUrl,
  bio,
  location,
  verified = false,
  joinedAt,
  ratingAverage,
  ratingCount = 0,
  approvedCount,
  pendingCount = 0,
  needsEditCount = 0,
  closedCount = 0,
  extraActions,
}: StorefrontIdentityHeroProps) {
  const { language, text } = useUiPreferences();
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const showCover = Boolean(coverUrl && failedCoverUrl !== coverUrl);
  const showAvatar = Boolean(avatarUrl && failedAvatarUrl !== avatarUrl);
  const avatarFallback = displayName.trim().slice(0, 1).toUpperCase() || "R";
  const joinedLabel = joinedAt
    ? new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
        month: "short",
        year: "numeric",
      }).format(new Date(joinedAt))
    : null;
  const metrics: StorefrontMetric[] =
    mode === "owner"
      ? [
          { label: text("نشط", "Live"), value: approvedCount, tone: "live" },
          { label: text("قيد المراجعة", "In review"), value: pendingCount, tone: "pending" },
          { label: text("تحتاج تدخلاً", "Needs action"), value: needsEditCount, tone: "action" },
          { label: text("مغلقة", "Closed"), value: closedCount, tone: "closed" },
        ]
      : [
          { label: text("إعلان معتمد", "Approved listings"), value: approvedCount, icon: Store },
          {
            label:
              ratingCount > 0
                ? text("تقييمات معتمدة", "Approved reviews")
                : text("بائع جديد", "New seller"),
            value: ratingCount > 0 && ratingAverage != null ? ratingAverage.toFixed(1) : "—",
            icon: Star,
          },
        ];

  return (
    <section
      className="rawaj-storefront-identity"
      data-mode={mode}
      aria-labelledby="rawaj-storefront-name"
    >
      <div className="rawaj-storefront-identity__media">
        {showCover ? (
          <img
            src={coverUrl ?? undefined}
            alt=""
            decoding="async"
            onError={() => setFailedCoverUrl(coverUrl ?? null)}
          />
        ) : null}
        <div className="rawaj-storefront-identity__pattern" aria-hidden="true" />
        <div className="rawaj-storefront-identity__scrim" aria-hidden="true" />
      </div>

      <div className="rawaj-storefront-identity__content">
        <div className="rawaj-storefront-identity__topline">
          <span>
            {mode === "owner"
              ? text("إدارة إعلاناتي", "My listings workspace")
              : text("واجهة على رواج", "RAWAJ storefront")}
          </span>
          {verified ? (
            <strong>
              <BadgeCheck aria-hidden="true" />
              {text("بائع موثّق", "Verified seller")}
            </strong>
          ) : null}
        </div>

        <div className="rawaj-storefront-identity__main">
          <div className="rawaj-storefront-identity__avatar">
            {showAvatar ? (
              <img
                src={avatarUrl ?? undefined}
                alt={displayName}
                decoding="async"
                onError={() => setFailedAvatarUrl(avatarUrl ?? null)}
              />
            ) : (
              <span>{avatarFallback}</span>
            )}
          </div>

          <div className="rawaj-storefront-identity__copy">
            <h1 id="rawaj-storefront-name">{displayName}</h1>
            {secondaryName && secondaryName !== displayName ? <p>{secondaryName}</p> : null}
            <div className="rawaj-storefront-identity__meta">
              <span>
                <MapPin aria-hidden="true" />
                {location || text("سوريا", "Syria")}
              </span>
              {joinedLabel ? (
                <span>
                  <CalendarDays aria-hidden="true" />
                  {text("عضو منذ", "Member since")} {joinedLabel}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <p className="rawaj-storefront-identity__bio">
          {bio ||
            (mode === "owner"
              ? text(
                  "أضف نبذة قصيرة ليعرف المشترون طبيعة متجرك وما تقدمه.",
                  "Add a short bio so buyers understand your store and what you offer.",
                )
              : text(
                  "تعرض هذه الصفحة المعلومات العامة والإعلانات المعتمدة فقط.",
                  "This page shows public information and approved listings only.",
                ))}
        </p>

        <div className="rawaj-storefront-identity__metrics">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} data-tone={metric.tone ?? "default"}>
                {Icon ? <Icon aria-hidden="true" /> : null}
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            );
          })}
        </div>

        <div className="rawaj-storefront-identity__actions">
          {mode === "owner" ? (
            <>
              <Link to="/seller/$id" params={{ id: sellerId }}>
                <Eye aria-hidden="true" />
                {text("عرض المتجر العام", "View public store")}
              </Link>
              <Link to="/profile">
                <Pencil aria-hidden="true" />
                {text("تعديل الهوية", "Edit identity")}
              </Link>
              <Link to="/add-listing" data-tone="primary">
                <Plus aria-hidden="true" />
                {text("إضافة إعلان", "Post listing")}
              </Link>
            </>
          ) : (
            <>
              <a href="#storefront-listings">
                <Store aria-hidden="true" />
                {text("تصفح الإعلانات", "Browse listings")}
              </a>
              <a href="#seller-reviews">
                <Star aria-hidden="true" />
                {text("التقييمات", "Reviews")}
              </a>
            </>
          )}
          {extraActions}
        </div>
      </div>
    </section>
  );
}

export function StorefrontSectionHeader({
  eyebrow,
  title,
  description,
  count,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <header className="rawaj-storefront-section-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <span>{description}</span> : null}
      </div>
      <div className="rawaj-storefront-section-header__actions">
        {typeof count === "number" ? <strong>{count}</strong> : null}
        {action}
      </div>
    </header>
  );
}

export function StorefrontNotice({
  title,
  description,
  action,
  tone = "neutral",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "neutral" | "draft" | "empty";
}) {
  return (
    <section className="rawaj-storefront-notice" data-tone={tone}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </section>
  );
}
