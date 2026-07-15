import { Link } from "@tanstack/react-router";
import { UserCheck, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSellerFollowSummary,
  setSellerFollow,
  type SellerFollowSummary,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

interface SellerFollowButtonProps {
  sellerId: string;
  className?: string;
  showCount?: boolean;
}

const emptySummary: SellerFollowSummary = { followerCount: 0, isFollowing: false };

export function SellerFollowButton({
  sellerId,
  className,
  showCount = true,
}: SellerFollowButtonProps) {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [summary, setSummary] = useState<SellerFollowSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);
  const writeInFlightRef = useRef(false);
  const profileId = auth.profile?.id ?? null;
  const isOwnProfile = auth.status === "signedIn" && profileId === sellerId;

  const loadSummary = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    const result = await fetchSellerFollowSummary(sellerId);
    if (requestId !== requestIdRef.current) return;
    if (result.ok) setSummary(result.data);
    else setError(result.error.message);
    setLoading(false);
  }, [sellerId]);

  useEffect(() => {
    void loadSummary();
    return () => {
      requestIdRef.current += 1;
    };
  }, [auth.status, profileId, loadSummary]);

  if (isOwnProfile) return null;

  const countLabel = new Intl.NumberFormat(language === "ar" ? "ar-SY" : "en-US").format(
    summary.followerCount,
  );
  const actionLabel = summary.isFollowing
    ? text("إلغاء المتابعة", "Unfollow")
    : text("متابعة البائع", "Follow seller");
  const visibleLabel = showCount ? `${actionLabel} · ${countLabel}` : actionLabel;
  const title = error || visibleLabel;
  const Icon = summary.isFollowing ? UserCheck : UserPlus;
  const sharedClassName = className ?? "";

  if (auth.status !== "signedIn" || !profileId) {
    return (
      <Link
        to="/login"
        search={{ returnTo: `/seller/${sellerId}` }}
        className={sharedClassName}
        title={title}
        aria-label={text(
          `سجّل الدخول لمتابعة البائع. لديه ${countLabel} متابع`,
          `Log in to follow this seller. ${countLabel} followers`,
        )}
      >
        <UserPlus aria-hidden="true" />
        <span>{loading ? text("جارٍ التحميل", "Loading") : visibleLabel}</span>
      </Link>
    );
  }

  async function toggleFollow() {
    if (writeInFlightRef.current || busy) return;
    writeInFlightRef.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await setSellerFollow(profileId, sellerId, !summary.isFollowing);
      if (profileId !== auth.profile?.id) return;
      if (result.ok) setSummary(result.data);
      else setError(result.error.message);
    } finally {
      writeInFlightRef.current = false;
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggleFollow()}
      disabled={loading || busy}
      aria-pressed={summary.isFollowing}
      aria-label={visibleLabel}
      className={sharedClassName}
      title={title}
      data-following={summary.isFollowing}
      data-error={error ? "true" : "false"}
    >
      <Icon aria-hidden="true" />
      <span>
        {busy
          ? text("جارٍ الحفظ", "Saving")
          : loading
            ? text("جارٍ التحميل", "Loading")
            : visibleLabel}
      </span>
    </button>
  );
}
