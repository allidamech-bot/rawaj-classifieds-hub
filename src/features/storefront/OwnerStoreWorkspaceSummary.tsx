import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BadgeCheck,
  MapPin,
  Pencil,
  Plus,
  Store,
  Package,
  Users,
  Star,
  Share2,
} from "lucide-react";
import { useState } from "react";

import { useUiPreferences } from "@/lib/ui-preferences";

interface OwnerStoreWorkspaceSummaryProps {
  sellerId: string;
  displayName: string;
  secondaryName?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  verified?: boolean;
  completeness: number;
  approvedCount?: number;
  ratingAverage?: number | null;
  ratingCount?: number;
  followerCount?: number | null;
}

export function OwnerStoreWorkspaceSummary({
  sellerId,
  displayName,
  secondaryName,
  avatarUrl,
  coverUrl,
  bio,
  location,
  verified,
  completeness,
  approvedCount = 0,
  ratingAverage,
  ratingCount = 0,
  followerCount,
}: OwnerStoreWorkspaceSummaryProps) {
  const { text } = useUiPreferences();
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const showCover = Boolean(coverUrl && failedCover !== coverUrl);

  const [feedback, setFeedback] = useState("");
  async function shareStore() {
    const url = new URL("/seller/" + encodeURIComponent(sellerId), window.location.origin).href;
    try {
      if (navigator.share) await navigator.share({ title: displayName, url });
      else {
        await navigator.clipboard.writeText(url);
        setFeedback(text("تم نسخ رابط المتجر", "Store link copied"));
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFeedback(text("تعذرت مشاركة الرابط", "Could not share the link"));
      }
    }
  }

  return (
    <section className="rawaj-shop-header" aria-labelledby="rawaj-owner-workspace-title">
      <div className="rawaj-shop-header__cover" data-has-cover={showCover}>
        {showCover ? (
          <img
            src={coverUrl ?? undefined}
            alt=""
            onError={() => setFailedCover(coverUrl ?? null)}
          />
        ) : (
          <Store strokeWidth={1} aria-hidden="true" />
        )}
        <span className="rawaj-approved-cover-title">{text("متجري", "My Store")}</span>
      </div>
      <div className="rawaj-shop-header__body">
        <div className="rawaj-shop-header__identity">
          <span className="rawaj-shop-header__avatar" aria-hidden="true">
            {avatarUrl && failedAvatar !== avatarUrl ? (
              <img src={avatarUrl} alt="" onError={() => setFailedAvatar(avatarUrl)} />
            ) : (
              <bdi>{Array.from(displayName.trim())[0] || "ر"}</bdi>
            )}
          </span>
          <div className="rawaj-shop-header__name">
            <h1 id="rawaj-owner-workspace-title" dir="auto">
              {displayName}
            </h1>
            {secondaryName && secondaryName !== displayName ? (
              <p dir="auto">{secondaryName}</p>
            ) : null}
            <div className="rawaj-shop-header__meta">
              <span>
                <MapPin aria-hidden="true" />
                <bdi>{location || text("سوريا", "Syria")}</bdi>
              </span>
              {verified ? (
                <span>
                  <BadgeCheck aria-hidden="true" />
                  {text("موثّق", "Verified")}
                </span>
              ) : null}
              {ratingAverage != null && ratingCount > 0 ? (
                <span>
                  <Star aria-hidden="true" />
                  {ratingAverage.toFixed(1)} ({ratingCount})
                </span>
              ) : null}
            </div>
            {bio ? (
              <p className="rawaj-approved-bio" dir="auto">
                {bio}
              </p>
            ) : null}
          </div>
          <Link to="/profile" className="rawaj-shop-edit">
            <Pencil aria-hidden="true" />
            {text("تعديل الملف", "Edit profile")}
          </Link>
        </div>
        <div className="rawaj-shop-header__actions">
          <Link to="/add-listing" className="rawaj-shop-post">
            <Plus aria-hidden="true" />
            {text("إضافة إعلان", "Post listing")}
          </Link>
          <Link to="/seller/$id" params={{ id: sellerId }}>
            {text("معاينة المتجر", "Preview store")}
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="rawaj-approved-share"
            onClick={() => void shareStore()}
            aria-label={text("مشاركة المتجر", "Share store")}
          >
            <Share2 aria-hidden="true" />
          </button>
        </div>
        {feedback ? <p role="status">{feedback}</p> : null}
        <dl className="rawaj-approved-stats">
          <div>
            <Package aria-hidden="true" />
            <dt>{text("الإعلانات", "Listings")}</dt>
            <dd>{approvedCount}</dd>
          </div>
          <div>
            <Users aria-hidden="true" />
            <dt>{text("المتابعون", "Followers")}</dt>
            <dd>{followerCount ?? "—"}</dd>
          </div>
          <div>
            <Star aria-hidden="true" />
            <dt>{text("التقييم", "Rating")}</dt>
            <dd>{ratingAverage == null || !ratingCount ? "—" : ratingAverage.toFixed(1)}</dd>
          </div>
        </dl>
        {completeness < 100 ? (
          <details className="rawaj-shop-profile-details">
            <summary>{text("تفاصيل المتجر", "Store profile details")}</summary>
            <label>
              {text("اكتمال الملف", "Profile completeness")}
              <progress value={completeness} max={100}>
                {completeness}%
              </progress>
            </label>
          </details>
        ) : null}
      </div>
    </section>
  );
}
