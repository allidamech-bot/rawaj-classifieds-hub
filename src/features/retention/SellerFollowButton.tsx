import { Link } from "@tanstack/react-router";
import { UserCheck, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchSellerFollowSummary,
  setSellerFollow,
  type SellerFollowSummary,
} from "@/lib/classifieds-api";
import { marketLocale } from "@/lib/market-locale";
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
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  const sellerIdRef = useRef(sellerId);
  const writeScopesRef = useRef<Set<string>>(new Set());
  profileIdRef.current = profileId;
  sellerIdRef.current = sellerId;
  const isOwnProfile = auth.status === "signedIn" && profileId === sellerId;

  const loadSummary = useCallback(async () => {
    const currentProfileId = profileId;
    const currentSellerId = sellerId;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetchSellerFollowSummary(currentSellerId);
      if (
        requestId !== requestIdRef.current ||
        currentProfileId !== profileIdRef.current ||
        currentSellerId !== sellerIdRef.current
      )
        return;
      if (result.ok) setSummary(result.data);
      else setError(result.error.message);
    } catch (caught) {
      if (
        requestId !== requestIdRef.current ||
        currentProfileId !== profileIdRef.current ||
        currentSellerId !== sellerIdRef.current
      )
        return;
      setError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحميل بيانات المتابعة.", "Could not load follow data."),
      );
    } finally {
      if (
        requestId === requestIdRef.current &&
        currentProfileId === profileIdRef.current &&
        currentSellerId === sellerIdRef.current
      ) {
        setLoading(false);
      }
    }
  }, [profileId, sellerId, text]);

  useEffect(() => {
    requestIdRef.current += 1;
    setSummary(emptySummary);
    setLoading(false);
    setBusy(false);
    setError("");
    void loadSummary();
    return () => {
      requestIdRef.current += 1;
    };
  }, [auth.status, loadSummary, profileId, sellerId]);

  if (isOwnProfile) return null;

  const countLabel = new Intl.NumberFormat(marketLocale(language)).format(summary.followerCount);
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
    const currentProfileId = profileId;
    const currentSellerId = sellerId;
    if (!currentProfileId) return;
    const scopeKey = [currentProfileId, currentSellerId].join(":");
    if (writeScopesRef.current.has(scopeKey)) return;

    const nextFollowing = !summary.isFollowing;
    writeScopesRef.current.add(scopeKey);
    setBusy(true);
    setError("");
    try {
      const result = await setSellerFollow(currentProfileId, currentSellerId, nextFollowing);
      if (currentProfileId !== profileIdRef.current || currentSellerId !== sellerIdRef.current)
        return;
      if (result.ok) setSummary(result.data);
      else setError(result.error.message);
    } catch (caught) {
      if (currentProfileId === profileIdRef.current && currentSellerId === sellerIdRef.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : text("تعذر تحديث المتابعة.", "Could not update follow status."),
        );
      }
    } finally {
      writeScopesRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current && currentSellerId === sellerIdRef.current)
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
