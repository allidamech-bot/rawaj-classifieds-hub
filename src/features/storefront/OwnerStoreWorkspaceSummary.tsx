import { Link } from "@tanstack/react-router";
import {
  Archive,
  BadgeCheck,
  CircleDashed,
  Eye,
  FileWarning,
  MapPin,
  Pencil,
  Plus,
  Store,
} from "lucide-react";
import { useState } from "react";

import { useUiPreferences } from "@/lib/ui-preferences";

interface OwnerStoreWorkspaceSummaryProps {
  sellerId: string;
  displayName: string;
  secondaryName?: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  verified?: boolean;
  approvedCount: number;
  pendingCount: number;
  needsEditCount: number;
  closedCount: number;
}

export function OwnerStoreWorkspaceSummary({
  sellerId,
  displayName,
  secondaryName,
  avatarUrl,
  location,
  verified = false,
  approvedCount,
  pendingCount,
  needsEditCount,
  closedCount,
}: OwnerStoreWorkspaceSummaryProps) {
  const { text } = useUiPreferences();
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const showAvatar = Boolean(avatarUrl && failedAvatarUrl !== avatarUrl);
  const avatarFallback = displayName.trim().slice(0, 1).toUpperCase() || "R";

  const metrics = [
    {
      key: "approved",
      label: text("نشطة", "Live"),
      value: approvedCount,
      icon: Store,
      tone: "live",
    },
    {
      key: "pending",
      label: text("قيد المراجعة", "In review"),
      value: pendingCount,
      icon: CircleDashed,
      tone: "pending",
    },
    {
      key: "needs-edit",
      label: text("تحتاج تدخلاً", "Needs action"),
      value: needsEditCount,
      icon: FileWarning,
      tone: "action",
    },
    {
      key: "closed",
      label: text("مغلقة", "Closed"),
      value: closedCount,
      icon: Archive,
      tone: "closed",
    },
  ] as const;

  return (
    <section className="rawaj-owner-workspace-summary" aria-labelledby="rawaj-owner-workspace-title">
      <div className="rawaj-owner-workspace-summary__identity">
        <div className="rawaj-owner-workspace-summary__avatar">
          {showAvatar ? (
            <img
              src={avatarUrl ?? undefined}
              alt={displayName}
              width={72}
              height={72}
              loading="eager"
              decoding="async"
              onError={() => setFailedAvatarUrl(avatarUrl ?? null)}
            />
          ) : (
            <span>{avatarFallback}</span>
          )}
        </div>

        <div className="rawaj-owner-workspace-summary__copy">
          <p>{text("مركز إدارة إعلاناتك", "Your listings workspace")}</p>
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
          {secondaryName && secondaryName !== displayName ? <strong dir="auto">{secondaryName}</strong> : null}
          <span className="rawaj-owner-workspace-summary__location">
            <MapPin aria-hidden="true" />
            {location || text("سوريا", "Syria")}
          </span>
        </div>
      </div>

      <div className="rawaj-owner-workspace-summary__metrics" aria-label={text("ملخص حالات الإعلانات", "Listing status summary")}>
        {metrics.map(({ key, label, value, icon: Icon, tone }) => (
          <div key={key} data-tone={tone}>
            <Icon aria-hidden="true" />
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="rawaj-owner-workspace-summary__actions">
        <Link to="/add-listing" data-tone="primary">
          <Plus aria-hidden="true" />
          {text("إضافة إعلان", "Post listing")}
        </Link>
        <Link to="/seller/$id" params={{ id: sellerId }}>
          <Eye aria-hidden="true" />
          {text("عرض المتجر العام", "View public store")}
        </Link>
        <Link to="/profile">
          <Pencil aria-hidden="true" />
          {text("تعديل الهوية", "Edit identity")}
        </Link>
      </div>
    </section>
  );
}
