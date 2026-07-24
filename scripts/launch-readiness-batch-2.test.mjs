import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  authContext,
  authProvider,
  accountSecurity,
  accountIdentity,
  support,
  accountMigration,
  profile,
  quickLinks,
  ownerListings,
  storefront,
  notifications,
  barrel,
  packageJson,
  qualityGate,
] = await Promise.all([
  readFile(new URL("../src/lib/auth-context.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/account-security.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/account-identity.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/support.ts", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../supabase/migrations/202607170002_account_profile_verification_integrity.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/routes/profile.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/account/AccountExperience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/storefront/StorefrontIdentityHero.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/notifications.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("profile mutations refresh the shared authenticated profile", () => {
  assert.ok(authContext.includes("refreshProfile: () => Promise"));
  assert.ok(authProvider.includes("refreshProfile: load"));
  assert.ok(authProvider.includes("await loadCloudflareUserProfile(next)"));
  assert.ok(profile.match(/auth\.refreshProfile\(\)/g)?.length >= 3);
});

test("password change verifies the current password through Cloudflare Auth", () => {
  assert.ok(barrel.includes('export * from "@/lib/api/account-security";'));
  assert.ok(accountSecurity.includes("authChangePassword(currentPassword, newPassword)"));
  assert.ok(!accountSecurity.includes("client.auth.updateUser"));
  assert.ok(!accountSecurity.includes("getClient()"));
  assert.ok(profile.includes("handleChangePassword"));
  assert.ok(profile.includes('autoComplete="current-password"'));
  assert.ok(profile.includes('autoComplete="new-password"'));
});

test("account deletion creates a server-authoritative deduplicated support request", () => {
  assert.ok(support.includes("createAccountDeletionRequest"));
  assert.ok(support.includes('rpc("rawaj_request_my_account_deletion")'));
  assert.ok(support.includes("resolveAuthenticatedAccountId("));
  assert.ok(support.includes("accountSessionStillMatches("));
  assert.ok(accountMigration.includes("idx_support_account_deletion_open_unique"));
  assert.ok(accountMigration.includes("pg_advisory_xact_lock"));
  assert.ok(accountMigration.includes("rawaj_request_my_account_deletion"));
  assert.ok(profile.includes("handleAccountDeletionRequest"));
  assert.ok(profile.includes("تأكيد طلب الحذف"));
  assert.ok(!profile.includes("Request account review"));
});

test("account and public store navigation are clearly separated", () => {
  assert.ok(quickLinks.includes('title={text("إعلاناتي", "My listings")}'));
  assert.ok(ownerListings.includes('title={text("إعلاناتي", "My listings")}'));
  assert.ok(storefront.includes('text("إدارة إعلاناتي", "My listings workspace")'));
  assert.ok(storefront.includes('text("عرض المتجر العام", "View public store")'));
});

test("account status labels cover the persisted frozen and disabled states", () => {
  assert.ok(profile.includes('status === "frozen"'));
  assert.ok(profile.includes('status === "disabled"'));
  assert.ok(profile.includes('text("مجمّد", "Frozen")'));
  assert.ok(profile.includes('text("معطّل", "Disabled")'));
});

test("opening a notification records it as read before awaited navigation", () => {
  const openTargetStart = notifications.indexOf(
    "async function openNotificationTarget(notification: NotificationItem)",
  );
  const resolveIndex = notifications.indexOf(
    "await resolveNotificationTarget(notification.id)",
    openTargetStart,
  );
  const markReadIndex = notifications.indexOf("await markOne(notification.id)", openTargetStart);
  const firstNavigationIndex = notifications.indexOf("await navigate(", openTargetStart);

  assert.ok(openTargetStart >= 0);
  assert.ok(resolveIndex > openTargetStart);
  assert.ok(markReadIndex > resolveIndex);
  assert.ok(firstNavigationIndex > markReadIndex);
  assert.match(
    notifications,
    /if \(!notification\.readAt\) \{[\s\S]*await markOne\(notification\.id\)/,
  );
  assert.match(notifications, /openingTargetScopesRef\.current\.has\(scopeKey\)/);
  assert.match(notifications, /openingTargetScopesRef\.current\.delete\(scopeKey\)/);
  assert.ok(notifications.includes("markAllNotificationsRead"));
  assert.ok(notifications.includes("resolveNotificationTarget"));
});

test("Batch 2 regression remains in local and GitHub quality gates", () => {
  const parsed = JSON.parse(packageJson);
  assert.ok(parsed.scripts["test:launch-readiness-batch-2"]);
  assert.ok(parsed.scripts.check.includes("test:launch-readiness-batch-2"));
  assert.ok(qualityGate.includes("Launch readiness Batch 2 contract"));
  assert.ok(qualityGate.includes("npm run test:launch-readiness-batch-2"));
});
