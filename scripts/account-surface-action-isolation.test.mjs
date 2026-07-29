import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  favorites,
  savedSearches,
  ownerListings,
  reviewCard,
  sellerRoute,
  profile,
  authProvider,
  activity,
  support,
  sellerFollow,
  offers,
  packageSource,
] = await Promise.all([
  readFile(new URL("../src/routes/favorites.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/saved-searches.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/reviews/SellerReviewCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/seller.$id.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/activity.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/support.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/retention/SellerFollowButton.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/offers.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("favorites reject stale removals with account-scoped locks", () => {
  assert.match(favorites, /profileIdRef = useRef<string \| null>/);
  assert.match(favorites, /const scopeKey = \[currentProfileId, listingId\]\.join\(":"\)/);
  assert.match(favorites, /currentProfileId !== profileIdRef\.current/);
  assert.match(favorites, /removeInFlightRef\.current\.delete\(scopeKey\)/);
});

test("saved searches reset local state and isolate every account mutation", () => {
  assert.match(savedSearches, /loadedProfileIdRef = useRef<string \| null>/);
  assert.match(savedSearches, /setLocalItems\(\[\]\)/);
  assert.match(savedSearches, /creatingSearchProfilesRef = useRef<Set<string>>/);
  assert.match(savedSearches, /frequencyScopesRef = useRef<Set<string>>/);
  assert.match(savedSearches, /deletingSearchScopesRef = useRef<Set<string>>/);
  assert.match(savedSearches, /currentProfileId !== profileIdRef\.current/);
});

test("owner listing results are scoped to the initiating account", () => {
  assert.match(ownerListings, /actionProfileId !== profileIdRef\.current/);
  assert.ok(ownerListings.includes('key={`${profileId ?? "signed-out"}:${listing.id}`}'));
  assert.match(ownerListings, /onDeleted\(userId, listing\.id\)/);
  assert.match(ownerListings, /onChanged\(userId, result\.data\)/);
});

test("seller review actions and forms reject replacement accounts", () => {
  assert.match(reviewCard, /responseScopesRef = useRef<Set<string>>/);
  assert.match(reviewCard, /reportScopesRef = useRef<Set<string>>/);
  assert.match(reviewCard, /currentProfileId !== profileIdRef\.current/);
  assert.match(sellerRoute, /reviewSubmitScopesRef = useRef<Set<string>>/);
  assert.match(sellerRoute, /const scopeKey = \[currentProfileId, currentSellerId\]\.join\(":"\)/);
  assert.doesNotMatch(sellerRoute, /reviewerUserId:/);
  assert.match(sellerRoute, /currentProfileId !== profileIdRef\.current/);
  assert.match(sellerRoute, /currentSellerId !== sellerIdRef\.current/);
});

test("profile mutations and refreshes remain bound to one account", () => {
  assert.match(profile, /settingsSavingProfilesRef = useRef<Set<string>>/);
  assert.match(profile, /passwordSavingProfilesRef = useRef<Set<string>>/);
  assert.match(profile, /deletionSavingProfilesRef = useRef<Set<string>>/);
  assert.match(profile, /mediaSavingProfilesRef = useRef<Set<string>>/);
  assert.match(profile, /if \(currentProfileId !== profileIdRef\.current\) return;/);
  assert.match(profile, /loadedProfileIdRef\.current = null/);
});

test("auth provider rejects stale session, profile, and refresh results", () => {
  assert.match(authProvider, /loadRequestIdRef = useRef\(0\)/);
  assert.match(authProvider, /const requestId = \+\+loadRequestIdRef\.current/);
  assert.equal((authProvider.match(/requestId !== loadRequestIdRef\.current/g) ?? []).length, 3);
  assert.match(authProvider, /const nextProfile = next \? await loadCloudflareUserProfile\(next\)/);
  assert.match(authProvider, /loadRequestIdRef\.current \+= 1/);
  assert.match(authProvider, /setProfile\(null\)/);
});

test("activity center reads compare results with the live account", () => {
  assert.match(activity, /profileIdRef = useRef<string \| null>/);
  assert.equal((activity.match(/currentProfileId !== profileIdRef\.current/g) ?? []).length, 2);
  assert.doesNotMatch(activity, /currentProfileId !== auth\.profile\?\.id/);
});

test("support reads, form state, writes, and finalizers are account-scoped", () => {
  assert.match(support, /loadedProfileIdRef = useRef<string \| null>/);
  assert.match(support, /submitScopesRef = useRef<Set<string>>/);
  assert.match(support, /submitScopesRef\.current\.has\(currentProfileId\)/);
  assert.match(support, /const payload = \{/);
  assert.match(support, /currentProfileId !== profileIdRef\.current/);
  assert.match(support, /submitScopesRef\.current\.delete\(currentProfileId\)/);
  assert.match(support, /if \(accountChanged\) \{[\s\S]*setSubject\(""\)/);
  assert.doesNotMatch(support, /submitInFlightRef/);
});

test("seller follow reads and writes are scoped to account and seller", () => {
  assert.match(sellerFollow, /profileIdRef = useRef<string \| null>/);
  assert.match(sellerFollow, /sellerIdRef = useRef\(sellerId\)/);
  assert.match(sellerFollow, /writeScopesRef = useRef<Set<string>>/);
  assert.match(sellerFollow, /const scopeKey = \[currentProfileId, currentSellerId\]\.join\(":"\)/);
  assert.match(sellerFollow, /currentProfileId !== profileIdRef\.current/);
  assert.match(sellerFollow, /currentSellerId !== sellerIdRef\.current/);
  assert.match(sellerFollow, /writeScopesRef\.current\.delete\(scopeKey\)/);
  assert.doesNotMatch(sellerFollow, /writeInFlightRef/);
});

test("offers stay public and outside account isolation state", () => {
  assert.doesNotMatch(offers, /useAuth/);
  assert.match(offers, /fetchActivePriceDropOffers/);
});

test("account surface isolation remains in the permanent activity contract", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(
    packageJson.scripts["test:activity-center"],
    /account-surface-action-isolation\.test\.mjs/,
  );
  assert.match(packageJson.scripts.check, /npm run test:activity-center/);
});
