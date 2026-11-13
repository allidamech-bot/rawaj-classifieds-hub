import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  MoreHorizontal,
  Settings,
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
import { useRef, useState } from "react";

import { useUiPreferences } from "@/lib/ui-preferences";

interface MyStoreIdentityProps {
  sellerId: string;
  displayName: string;
  secondaryName?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  verified?: boolean;
  completeness: number;
  onManage: () => void;
  approvedCount?: number;
  ratingAverage?: number | null;
  ratingCount?: number;
  followerCount?: number | null;
}

export function MyStoreIdentity({
  sellerId,
  onManage,
  displayName,
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
}: MyStoreIdentityProps) {
  const { text } = useUiPreferences();
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const showCover = Boolean(coverUrl && failedCover !== coverUrl);

  const [feedback, setFeedback] = useState("");
  const ownerMenuRef = useRef<HTMLDetailsElement>(null);
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
    <section className="my-store-hero" aria-labelledby="my-store-title">
      <div className="my-store-cover" data-has-cover={showCover}>
        {showCover ? (
          <img src={coverUrl!} alt="" onError={() => setFailedCover(coverUrl ?? null)} />
        ) : (
          <Store className="my-store-cover-placeholder" aria-hidden="true" />
        )}
        <svg
          className="my-store-cover-curve"
          viewBox="0 0 1100 300"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 0H550C370 35 245 145 150 300H0Z" fill="#103c3e" />
          <path
            d="M0 0H610C395 38 270 155 175 300H150C245 145 370 35 550 0Z"
            fill="#215251"
            fillOpacity=".7"
          />
        </svg>
        <span className="my-store-cover-title">{text("متجري", "My Store")}</span>
        <svg
          className="my-store-cover-wave"
          viewBox="0 0 1100 60"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 35Q150 0 350 34T800 30T1100 30V60H0Z" fill="#fcfaf7" />
        </svg>
      </div>
      <div className="my-store-identity-row">
        <div className="my-store-avatar">
          {avatarUrl && failedAvatar !== avatarUrl ? (
            <img src={avatarUrl} alt="" onError={() => setFailedAvatar(avatarUrl)} />
          ) : (
            <bdi>{Array.from(displayName.trim())[0] || "ر"}</bdi>
          )}
          {verified ? (
            <BadgeCheck className="my-store-avatar-badge" aria-label={text("موثق", "Verified")} />
          ) : null}
        </div>
        <div className="my-store-identity">
          <h1 id="my-store-title">
            <bdi>{displayName}</bdi>
            {verified ? <BadgeCheck aria-label={text("موثق", "Verified")} /> : null}
          </h1>
          <div className="my-store-meta">
            {location ? (
              <span>
                <MapPin aria-hidden="true" />
                <bdi>{location}</bdi>
              </span>
            ) : null}
            {ratingAverage != null && ratingCount > 0 ? (
              <span>
                <Star className="my-store-rating-star" aria-hidden="true" />
                <b>{ratingAverage.toFixed(1)}</b> ({ratingCount})
              </span>
            ) : null}
          </div>
          {bio ? (
            <p className="my-store-bio" dir="auto">
              {bio}
            </p>
          ) : null}
        </div>
        <div className="my-store-actions">
          <Link to="/add-listing" className="my-store-add">
            <Plus aria-hidden="true" />
            {text("إضافة إعلان", "Add Listing")}
          </Link>
          <button
            type="button"
            onClick={() => void shareStore()}
            aria-label={text("مشاركة المتجر", "Share store")}
          >
            <Share2 />
          </button>
          <details className="my-store-owner-menu" ref={ownerMenuRef}>
            <summary aria-label={text("خيارات المتجر", "Store options")}>
              <MoreHorizontal />
            </summary>
            <div>
              <Link to="/profile">
                <Pencil />
                {text("تعديل الملف", "Edit profile")}
              </Link>
              <Link to="/seller/$id" params={{ id: sellerId }}>
                <ArrowUpRight />
                {text("معاينة المتجر", "View store")}
              </Link>
              <button
                type="button"
                onClick={() => {
                  ownerMenuRef.current?.removeAttribute("open");
                  onManage();
                }}
              >
                <Settings />
                {text("إدارة المتجر", "Manage store")}
              </button>
              {completeness < 100 ? (
                <small>
                  {text("اكتمال الملف", "Profile completeness")}: {completeness}%
                </small>
              ) : null}
            </div>
          </details>
        </div>
      </div>
      {feedback ? (
        <p role="status" className="my-store-feedback">
          {feedback}
        </p>
      ) : null}
      <dl className="my-store-stats">
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
    </section>
  );
}
