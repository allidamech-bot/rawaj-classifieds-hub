import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export type ReferralClaim = {
  id: string;
  referrerUserId: string;
  sourceListingId: string | null;
  referredListingId: string | null;
  status: "claimed" | "qualified" | "rewarded" | "disqualified";
};

export type ReferralReward = {
  id: string;
  claimId: string;
  rewardType: "listing_boost_24h";
  status: "available" | "redeemed" | "revoked";
  durationHours: number;
  suggestedListingId: string | null;
  suggestedListingTitle: string | null;
  listingId: string | null;
  listingTitle: string | null;
  promotionRequestId: string | null;
  grantedAt: string | null;
  redeemedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ReferralSummary = {
  referrals: {
    claimed: number;
    qualified: number;
    rewarded: number;
    disqualified: number;
  };
  availableRewardCount: number;
  rewards: ReferralReward[];
};

export async function claimListingShareReferral(sourceListingId: string, referredListingId: string) {
  return cloudflareApiRequest<ReferralClaim>("/v1/account/referrals/claim", {
    method: "POST",
    body: { sourceListingId, referredListingId },
  });
}

export async function fetchReferralSummary() {
  return cloudflareApiRequest<ReferralSummary>("/v1/account/referrals");
}

export async function redeemReferralReward(rewardId: string, listingId: string) {
  return cloudflareApiRequest<ReferralReward>(
    `/v1/account/referrals/rewards/${encodeURIComponent(rewardId)}/redeem`,
    {
      method: "POST",
      body: { listingId },
    },
  );
}
