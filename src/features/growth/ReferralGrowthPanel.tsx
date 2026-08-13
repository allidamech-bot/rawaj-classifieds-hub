import { Gift, RefreshCw, Rocket, Share2, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { fetchCurrentUserListings } from "@/lib/api/listings";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import {
  fetchReferralSummary,
  redeemReferralReward,
  type ReferralReward,
  type ReferralSummary,
} from "@/lib/referral-growth-client";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export function ReferralGrowthPanel() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const profileId = auth.profile?.id ?? null;
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redeemingRewardId, setRedeemingRewardId] = useState<string | null>(null);
  const [selectedListingByReward, setSelectedListingByReward] = useState<Record<string, string>>({});

  const eligibleListings = listings.filter(
    (listing) =>
      listing.status === "approved" &&
      !listing.isDemo &&
      !listing.archivedAt &&
      (!listing.expiresAt || Date.parse(listing.expiresAt) > Date.now()) &&
      !isActiveFeature(listing),
  );

  const load = useCallback(async () => {
    if (auth.status !== "signedIn" || !profileId) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryResult, listingsResult] = await Promise.all([
        fetchReferralSummary(),
        fetchCurrentUserListings(profileId),
      ]);

      if (!summaryResult.ok) {
        setSummary(null);
        setError(text("تعذر تحميل مكافآت المشاركة الآن.", "Could not load share rewards right now."));
        return;
      }

      setSummary(summaryResult.data);
      if (listingsResult.ok) {
        setListings(listingsResult.data);
      } else {
        setListings([]);
        setError(
          text(
            "تم تحميل مكافآتك، لكن تعذر تحميل إعلاناتك المؤهلة الآن.",
            "Your rewards loaded, but your eligible listings could not be loaded right now.",
          ),
        );
      }
    } catch {
      setSummary(null);
      setListings([]);
      setError(text("تعذر تحميل مكافآت المشاركة الآن.", "Could not load share rewards right now."));
    } finally {
      setLoading(false);
    }
  }, [auth.status, profileId, text]);

  useEffect(() => {
    void load();
  }, [load]);

  if (auth.status !== "signedIn" || !profileId) return null;

  const awaitingApproval = summary?.referrals.claimed ?? 0;
  const availableRewards = summary?.rewards.filter((reward) => reward.status === "available") ?? [];
  const readyBoosts = summary?.availableRewardCount ?? availableRewards.length;
  const appliedBoosts = summary?.referrals.rewarded ?? 0;

  async function redeem(reward: ReferralReward) {
    const listingId =
      selectedListingByReward[reward.id] ||
      eligibleListings.find((listing) => listing.id === reward.suggestedListingId)?.id ||
      eligibleListings[0]?.id;
    if (!listingId || redeemingRewardId) return;

    setRedeemingRewardId(reward.id);
    setError(null);
    try {
      const result = await redeemReferralReward(reward.id, listingId);
      if (!result.ok) {
        setError(
          text(
            "تعذر تفعيل الـBoost على هذا الإعلان. قد يكون مميزاً بالفعل أو توجد ترقية قيد المراجعة.",
            "Could not activate the boost on this listing. It may already be boosted or have a promotion under review.",
          ),
        );
        return;
      }
      await load();
    } catch {
      setError(text("تعذر تفعيل المكافأة الآن.", "Could not activate the reward right now."));
    } finally {
      setRedeemingRewardId(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-brand-orange/20 bg-card shadow-soft">
      <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary via-primary to-primary/90 p-5 text-primary-foreground sm:p-6">
        <div className="absolute -end-16 -top-16 h-48 w-48 rounded-full bg-brand-orange/18 blur-2xl" />
        <div className="relative flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-orange text-white shadow-soft">
            <Rocket className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-brand-gold">
              {text("نمِّ رواج وارفع إعلانك", "Grow RAWAJ and boost your listing")}
            </p>
            <h2 className="mt-1 text-lg font-black sm:text-xl">
              {text(
                "شارك إعلانك، وإذا جلبت بائعاً جديداً تكسب Boost لمدة 24 ساعة",
                "Share your listing. Bring a new seller and earn a 24-hour boost",
              )}
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-primary-foreground/75">
              {text(
                "لا تُحتسب المكافأة لمجرد فتح الرابط أو التسجيل. الشخص الجديد يجب أن يرسل أول إعلان حقيقي له للمراجعة ثم تعتمد الإدارة ذلك الإعلان.",
                "A click or signup is not enough. The new user must submit their first real listing and that exact listing must be approved.",
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2">
          <GrowthStat icon={Share2} value={awaitingApproval} label={text("بانتظار الاعتماد", "Awaiting approval")} />
          <GrowthStat icon={Gift} value={readyBoosts} label={text("Boost جاهز", "Boosts ready")} />
          <GrowthStat icon={Users} value={appliedBoosts} label={text("تم تفعيله", "Activated")} />
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
            <p className="text-xs leading-6 text-muted-foreground">
              {text(
                "إذا كان الإعلان الذي شاركته ما زال متاحاً وغير مميز، يطبّق رواج المكافأة عليه تلقائياً. وإذا لم يكن مناسباً وقتها، تبقى المكافأة محفوظة هنا لتستخدمها على إعلان آخر مؤهل.",
                "If the listing you shared is still eligible, RAWAJ applies the reward automatically. Otherwise the reward stays here so you can use it on another eligible listing.",
              )}
            </p>
          </div>
        </div>

        {loading && !summary ? (
          <div className="mt-4 flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-border/60 text-xs font-bold text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {text("نحمّل مكافآتك...", "Loading your rewards...")}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/7 px-4 py-3 text-xs font-semibold text-destructive" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-destructive/20 px-2.5 py-1.5 text-[10px] font-black disabled:opacity-50">
              {loading ? text("جارٍ التحديث...", "Refreshing...") : text("إعادة المحاولة", "Retry")}
            </button>
          </div>
        ) : null}

        {availableRewards.length > 0 ? (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-foreground">{text("مكافآت جاهزة للاستخدام", "Rewards ready to use")}</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">{text("اختر إعلاناً مؤهلاً لكل Boost محفوظ.", "Choose an eligible listing for each saved boost.")}</p>
              </div>
              <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-[10px] font-black text-brand-orange">{availableRewards.length}</span>
            </div>

            {availableRewards.map((reward) => {
              const defaultListingId =
                eligibleListings.find((listing) => listing.id === reward.suggestedListingId)?.id ||
                eligibleListings[0]?.id ||
                "";
              const selectedListingId = selectedListingByReward[reward.id] ?? defaultListingId;
              return (
                <div key={reward.id} className="rounded-2xl border border-border/70 bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-foreground">{text("Boost مجاني — 24 ساعة", "Free boost — 24 hours")}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {reward.suggestedListingTitle
                          ? text(`نتج عن مشاركة: ${reward.suggestedListingTitle}`, `Earned from sharing: ${reward.suggestedListingTitle}`)
                          : text("مكافأة إحالة محفوظة", "Saved referral reward")}
                      </p>
                    </div>
                    <Rocket className="h-5 w-5 shrink-0 text-brand-orange" />
                  </div>

                  {eligibleListings.length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <select value={selectedListingId} onChange={(event) => setSelectedListingByReward((current) => ({ ...current, [reward.id]: event.target.value }))} className="min-h-11 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground outline-none focus:border-brand-orange" aria-label={text("اختر الإعلان للـBoost", "Choose listing for boost")}>
                        {eligibleListings.map((listing) => (
                          <option key={listing.id} value={listing.id}>{listing.title}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => void redeem(reward)} disabled={Boolean(redeemingRewardId)} className="rawaj-button-primary min-h-11 rounded-xl px-4 text-xs font-black disabled:opacity-50">
                        {redeemingRewardId === reward.id ? text("جارٍ التفعيل...", "Activating...") : text("فعّل Boost", "Activate boost")}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-[11px] leading-5 text-muted-foreground">
                      {text("لا يوجد حالياً إعلان معتمد ومتاح يمكن تطبيق المكافأة عليه. ستبقى المكافأة محفوظة.", "There is no eligible approved listing right now. Your reward will remain saved.")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : summary && appliedBoosts > 0 ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-xs font-semibold text-emerald-700">
            {text("مكافآتك الحالية تم تطبيقها. استمر بمشاركة إعلاناتك لجلب بائعين جدد.", "Your current rewards have been applied. Keep sharing listings to bring new sellers.")}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function GrowthStat({ icon: Icon, value, label }: { icon: typeof Share2; value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border/65 bg-background p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-brand-orange" aria-hidden="true" />
      <strong className="mt-2 block text-lg font-black text-foreground">{value}</strong>
      <span className="mt-0.5 block text-[9px] font-semibold leading-4 text-muted-foreground">{label}</span>
    </div>
  );
}

function isActiveFeature(listing: ClassifiedListing): boolean {
  if (!listing.isFeatured) return false;
  if (!listing.featuredUntil) return true;
  const expiry = Date.parse(listing.featuredUntil);
  return !Number.isFinite(expiry) || expiry > Date.now();
}
