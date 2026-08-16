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
import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { SellerFollowButton } from "@/features/retention/SellerFollowButton";
import { OwnerStoreWorkspaceSummary } from "@/features/storefront/OwnerStoreWorkspaceSummary";
import { useUiPreferences } from "@/lib/ui-preferences";

interface StorefrontMetric {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  tone?: "default" | "live" | "pending" | "action" | "closed";
  href?: string;
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
  approvedCount: number | null;
  completeness?: number;
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
  completeness = 0,
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
        timeZone: "UTC",
      }).format(new Date(joinedAt))
    : null;

  if (mode === "owner") {
    return (
      <OwnerStoreWorkspaceSummary
        sellerId={sellerId}
        displayName={displayName}
        secondaryName={secondaryName}
        avatarUrl={avatarUrl}
        coverUrl={coverUrl}
        bio={bio}
        location={location}
        verified={verified}
        completeness={completeness}
        approvedCount={approvedCount ?? 0}
      />
    );
  }

  const metrics: StorefrontMetric[] = [
    {
      label: text("إعلان معتمد", "Approved listings"),
      value: approvedCount ?? "—",
      icon: Store,
    },
    {
      label:
        ratingCount > 0
          ? text("تقييمات معتمدة", "Approved reviews")
          : text("بائع جديد", "New seller"),
      value: ratingCount > 0 && ratingAverage != null ? ratingAverage.toFixed(1) : "—",
      icon: Star,
      href: "#seller-reviews",
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
            width={1440}
            height={480}
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={() => setFailedCoverUrl(coverUrl ?? null)}
          />
        ) : null}
        <div className="rawaj-storefront-identity__pattern" aria-hidden="true" />
        <div className="rawaj-storefront-identity__scrim" aria-hidden="true" />
      </div>

      <div className="rawaj-storefront-identity__content">
        <div className="rawaj-storefront-identity__topline">
          <span>{text("واجهة على رواج", "RAWAJ storefront")}</span>
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
                width={160}
                height={160}
                sizes="(max-width: 640px) 88px, 112px"
                loading="eager"
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
            text(
              "تعرض هذه الصفحة المعلومات العامة والإعلانات المعتمدة فقط.",
              "This page shows public information and approved listings only.",
            )}
        </p>

        {verified ? (
          <p className="text-xs leading-5 text-primary-foreground/75">
            {text(
              "تعني الشارة أن بيانات الملف خضعت لمراجعة المنصة، ولا تمثل ضمانًا للمنتج أو الدفع أو التسليم أو إتمام الصفقة.",
              "The badge means profile information was reviewed by the platform; it does not guarantee a product, payment, delivery, or transaction.",
            )}
          </p>
        ) : null}

        <div className="rawaj-storefront-identity__metrics">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const metricContent = (
              <>
                {Icon ? <Icon aria-hidden="true" /> : null}
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </>
            );

            return (
              <div
                key={metric.label}
                data-tone={metric.tone ?? "default"}
                data-interactive={metric.href ? "true" : undefined}
              >
                {metric.href ? (
                  <a
                    href={metric.href}
                    aria-label={text(
                      "عرض التقييمات والنجوم والتعليقات",
                      "View ratings, stars and review comments",
                    )}
                  >
                    {metricContent}
                  </a>
                ) : (
                  metricContent
                )}
              </div>
            );
          })}
        </div>

        <div className="rawaj-storefront-identity__actions">
          <a href="#storefront-listings">
            <Store aria-hidden="true" />
            {text("تصفح الإعلانات", "Browse listings")}
          </a>
          <SellerFollowButton sellerId={sellerId} />
          <a href="#seller-reviews">
            <Star aria-hidden="true" />
            {text("التقييمات", "Reviews")}
          </a>
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
      {action ? (
        <div onClickCapture={tone === "draft" ? handleDraftResumeNavigation : undefined}>
          {action}
        </div>
      ) : null}
    </section>
  );
}

function handleDraftResumeNavigation(event: ReactMouseEvent<HTMLDivElement>) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;

  const destination = new URL(anchor.href, window.location.href);
  const isOwnerListingEditor =
    destination.origin === window.location.origin &&
    /^\/profile\/listings\/[^/]+\/?$/.test(destination.pathname);
  if (!isOwnerListingEditor) return;

  event.preventDefault();
  event.stopPropagation();
  window.location.assign(destination.href);
}
