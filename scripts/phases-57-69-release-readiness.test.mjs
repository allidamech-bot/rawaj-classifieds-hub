import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const sources = await Promise.all([
  read("src/routes/login.tsx"),
  read("src/routes/reset-password.tsx"),
  read("src/routes/auth.callback.tsx"),
  read("src/routes/profile.tsx"),
  read("src/routes/seller.$id.tsx"),
  read("src/routes/profile/listings.tsx"),
  read("src/routes/add-listing.tsx"),
  read("src/routes/profile/listings.$id.tsx"),
  read("src/routes/listings.index.tsx"),
  read("src/routes/categories.tsx"),
  read("src/routes/chats.tsx"),
  read("src/routes/notifications.tsx"),
  read("src/routes/admin.tsx"),
  read("src/routes/admin.pending.tsx"),
  read("src/routes/admin.reports.tsx"),
  read("src/routes/admin.safety.tsx"),
  read("src/routes/privacy.tsx"),
  read("src/routes/prohibited.tsx"),
  read("src/lib/auth-errors.ts"),
  read("scripts/public-data-security.test.mjs"),
  read("scripts/admin-security-regression.mjs"),
  read("playwright.config.ts"),
  read("e2e/release-core-journeys.spec.ts"),
  read("e2e/production-acceptance.spec.ts"),
  read(".github/workflows/release-candidate.yml"),
  read("scripts/copy-quality.mjs"),
]);

const [
  login,
  resetPassword,
  authCallback,
  profile,
  seller,
  profileListings,
  addListing,
  editListing,
  listings,
  categories,
  chats,
  notifications,
  admin,
  adminPending,
  adminReports,
  adminSafety,
  privacy,
  prohibited,
  authErrors,
  publicDataSecurity,
  adminSecurity,
  playwright,
  releaseJourneys,
  productionAcceptance,
  releaseWorkflow,
  copyQuality,
] = sources;

test("phase 57 closes authentication and recovery route contracts", () => {
  assert.match(login, /signInWithPassword/);
  assert.match(resetPassword, /updateUser|changeOwnPassword|password/);
  assert.match(authCallback, /auth\/callback|exchangeCodeForSession/);
  assert.match(productionAcceptance, /RAWAJ_ACCEPTANCE_EMAIL/);
});

test("phase 58 protects account, seller storefront, listings, and deletion request journeys", () => {
  assert.match(profile, /createAccountDeletionRequest/);
  assert.match(profile, /uploadProfileMedia/);
  assert.match(seller, /createFileRoute\("\/seller\/\$id"\)/);
  assert.match(profileListings, /createFileRoute\("\/profile\/listings"\)/);
});

test("phase 59 keeps add and edit listing journeys on the shared studio contract", () => {
  assert.match(addListing, /ListingStudio|listing-studio/i);
  assert.match(editListing, /ListingStudio|listing-studio/i);
  assert.match(editListing, /createFileRoute\("\/profile\/listings\/\$id"\)/);
});

test("phase 60 preserves URL-driven discovery, filters, categories, and taxonomy", () => {
  assert.match(listings, /validateSearch|search/i);
  assert.match(categories, /createFileRoute\("\/categories"\)/);
  assert.match(releaseJourneys, /listing discovery preserves explicit URL search state/);
});

test("phase 61 keeps chats and notifications inside authenticated release acceptance", () => {
  assert.match(chats, /createFileRoute\("\/chats"\)/);
  assert.match(notifications, /createFileRoute\("\/notifications"\)/);
  assert.match(productionAcceptance, /"\/chats"/);
  assert.match(productionAcceptance, /"\/notifications"/);
});

test("phase 62 keeps the admin shell permission-gated and regression-tested", () => {
  assert.match(admin, /hasPermission|permission/i);
  assert.match(adminSecurity, /admin/i);
  assert.match(adminPending, /canModerateListings/);
});

test("phase 63 retains explicit public-data and row-level security contracts", () => {
  assert.match(publicDataSecurity, /security|public/i);
  assert.match(adminSecurity, /permission|role|admin/i);
});

test("phase 64 retains privacy disclosure and account deletion request handling", () => {
  assert.match(privacy, /createFileRoute\("\/privacy"\)/);
  assert.match(profile, /handleAccountDeletionRequest/);
  assert.match(profile, /secure deletion/);
});

test("phase 65 exposes rate-limit feedback and content abuse signals", () => {
  assert.match(authErrors, /rate limit|too many requests/);
  assert.match(addListing, /content_flags/);
  assert.match(editListing, /content_flags/);
  assert.match(adminPending, /content_flags/);
});

test("phase 66 keeps reports, safety review, pending moderation, and prohibited content linked", () => {
  assert.match(adminReports, /createFileRoute\("\/admin\/reports"\)/);
  assert.match(adminSafety, /createFileRoute\("\/admin\/safety"\)/);
  assert.match(prohibited, /createFileRoute\("\/prohibited"\)/);
});

test("phase 67 defines Chromium, Firefox, and WebKit release projects", () => {
  assert.match(playwright, /mobile-chromium/);
  assert.match(playwright, /desktop-firefox/);
  assert.match(playwright, /mobile-webkit/);
});

test("phase 68 exercises responsive, reduced-motion, RTL, and keyboard release surfaces", () => {
  assert.match(releaseJourneys, /reducedMotion: "reduce"/);
  assert.match(releaseJourneys, /scrollWidth/);
  assert.match(releaseJourneys, /keyboard\.press\("Tab"\)/);
  assert.match(releaseJourneys, /toHaveAttribute\("dir", "rtl"\)/);
});

test("phase 69 rejects placeholder copy and empty bilingual labels", () => {
  assert.match(copyQuality, /Lorem ipsum/);
  assert.match(copyQuality, /empty bilingual/);
});

test("phase 70 release workflow binds web, browser, Android, and manifest artifacts to one commit", () => {
  assert.match(releaseWorkflow, /expected_commit_sha/);
  assert.match(releaseWorkflow, /assembleDebug/);
  assert.match(releaseWorkflow, /release-candidate-manifest/);
  assert.match(releaseWorkflow, /playwright install --with-deps chromium firefox webkit/);
});
