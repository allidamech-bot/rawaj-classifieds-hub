import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, MapPin, Pencil, Plus, Store } from "lucide-react";
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
}: OwnerStoreWorkspaceSummaryProps) {
  const { text } = useUiPreferences();
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const showCover = Boolean(coverUrl && failedCover !== coverUrl);

  return (
    <section className="rawaj-shop-header" aria-labelledby="rawaj-owner-workspace-title">
      <div className="rawaj-shop-header__cover" data-has-cover={showCover} aria-hidden="true">
        {showCover ? (
          <img
            src={coverUrl ?? undefined}
            alt=""
            onError={() => setFailedCover(coverUrl ?? null)}
          />
        ) : (
          <Store strokeWidth={1} />
        )}
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
            </div>
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
        </div>
        {bio || completeness < 100 ? (
          <details className="rawaj-shop-profile-details">
            <summary>{text("تفاصيل المتجر", "Store profile details")}</summary>
            {bio ? <p dir="auto">{bio}</p> : null}
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
