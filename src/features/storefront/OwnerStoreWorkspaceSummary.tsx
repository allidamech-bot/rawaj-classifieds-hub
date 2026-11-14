import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Rocket,
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
  approvedCount: number;
}

export function OwnerStoreWorkspaceSummary({
  sellerId,
  displayName,
  secondaryName,
  avatarUrl,
  coverUrl,
  bio,
  location,
  verified = false,
  completeness,
  approvedCount,
}: OwnerStoreWorkspaceSummaryProps) {
  const { text } = useUiPreferences();
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const showAvatar = Boolean(avatarUrl && failedAvatarUrl !== avatarUrl);
  const showCover = Boolean(coverUrl && failedCoverUrl !== coverUrl);
  const avatarFallback = displayName.trim().slice(0, 1).toUpperCase() || "R";

  return (
    <section
      className="rawaj-owner-workspace-summary"
      aria-labelledby="rawaj-owner-workspace-title"
      data-has-cover={showCover}
    >
      {showCover ? (
        <div className="rawaj-owner-workspace-summary__cover" aria-hidden="true">
          <img
            src={coverUrl ?? undefined}
            alt=""
            width={1200}
            height={320}
            decoding="async"
            onError={() => setFailedCoverUrl(coverUrl ?? null)}
          />
        </div>
      ) : null}

      <div className="rawaj-owner-workspace-summary__topline">
        <strong data-tone={approvedCount > 0 ? "live" : "setup"}>
          <CheckCircle2 aria-hidden="true" />
          {approvedCount > 0
            ? text("متاح للزوار", "Open to visitors")
            : text("جاهز للبدء", "Ready to start")}
        </strong>
      </div>

      <div className="rawaj-owner-workspace-summary__body">
        <div className="rawaj-owner-workspace-summary__identity">
          <div className="rawaj-owner-workspace-summary__avatar">
            {showAvatar ? (
              <img
                src={avatarUrl ?? undefined}
                alt={displayName}
                width={88}
                height={88}
                loading="eager"
                decoding="async"
                onError={() => setFailedAvatarUrl(avatarUrl ?? null)}
              />
            ) : (
              <span>{avatarFallback}</span>
            )}
          </div>

          <div className="rawaj-owner-workspace-summary__copy">
            <div className="rawaj-owner-workspace-summary__name-row">
              <h1 id="rawaj-owner-workspace-title" dir="auto">
                {displayName}
              </h1>
              {verified ? (
                <span className="rawaj-owner-workspace-summary__verified">
                  <BadgeCheck aria-hidden="true" />
                  {text("موثّق", "Verified")}
                </span>
              ) : null}
            </div>
            {secondaryName && secondaryName !== displayName ? (
              <strong dir="auto">{secondaryName}</strong>
            ) : null}
            <span className="rawaj-owner-workspace-summary__location">
              <MapPin aria-hidden="true" />
              {location || text("سوريا", "Syria")}
            </span>
            <p className="rawaj-owner-workspace-summary__bio">
              {bio ||
                text(
                  "واجهة متجرك العامة وإعلاناتك في مكان واحد.",
                  "Your public presence and listings in one place.",
                )}
            </p>
          </div>
        </div>

        <div
          className="rawaj-owner-workspace-summary__completeness"
          data-complete={completeness === 100}
        >
          {completeness === 100 ? (
            <span className="rawaj-owner-workspace-summary__complete-label">
              <CheckCircle2 aria-hidden="true" />
              {text("ملف المتجر مكتمل", "Store profile complete")}
            </span>
          ) : (
            <>
              <div>
                <span>{text("اكتمال واجهة المتجر", "Storefront completeness")}</span>
                <strong>{completeness}%</strong>
              </div>
              <span
                className="rawaj-owner-workspace-summary__progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={completeness}
                aria-label={text("اكتمال واجهة المتجر", "Storefront completeness")}
              >
                <span style={{ inlineSize: `${completeness}%` }} />
              </span>
              <p>
                {text(
                  "أكمل الهوية لتزيد ثقة الزوار بمتجرك.",
                  "Complete your identity to strengthen visitor trust.",
                )}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="rawaj-owner-workspace-summary__actions">
        <Link to="/add-listing" data-tone="primary" data-priority="primary">
          <Plus aria-hidden="true" />
          <span>{text("إضافة إعلان", "Post listing")}</span>
        </Link>
        <Link to="/promotion" data-tone="boost" data-priority="promotion">
          <Rocket aria-hidden="true" />
          <span>Boost</span>
        </Link>
        <Link to="/promotion-request" data-tone="promotion" data-priority="promotion">
          <Megaphone aria-hidden="true" />
          <span>{text("ترويج", "Promote")}</span>
        </Link>
        <Link to="/seller/$id" params={{ id: sellerId }} data-priority="secondary">
          <Eye aria-hidden="true" />
          <span>{text("عرض", "View")}</span>
        </Link>
        <Link to="/profile" data-priority="secondary">
          <Pencil aria-hidden="true" />
          <span>{text("تعديل", "Edit")}</span>
        </Link>
      </div>
    </section>
  );
}
