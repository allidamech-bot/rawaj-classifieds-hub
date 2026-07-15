import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  authContext,
  authProvider,
  accountSecurity,
  support,
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
  readFile(new URL("../src/lib/api/support.ts", import.meta.url), "utf8"),
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
  assert.ok(authProvider.includes("const refreshProfile = async () =>"));
  assert.ok(authProvider.includes("const nextProfile = await fetchProfile(client, user)"));
  assert.ok(profile.match(/auth.refreshProfile()/g)?.length >= 3);
});

test("password change verifies ownership and uses Supabase Auth", () => {
  assert.ok(barrel.includes('export * from "@/lib/api/account-security";'));
  assert.ok(accountSecurity.includes("client.auth.getUser()"));
  assert.ok(accountSecurity.includes("userResult.user?.id !== userId"));
  assert.ok(accountSecurity.includes("client.auth.updateUser({ password: newPassword })"));
  assert.ok(profile.includes("handleChangePassword"));
  assert.ok(profile.includes('autoComplete="new-password"'));
});

test("account deletion creates a deduplicated trackable support request", () => {
  assert.ok(support.includes("createAccountDeletionRequest"));
  assert.ok(support.includes('.eq("subject", ACCOUNT_DELETION_SUBJECT)'));
  assert.ok(support.includes('.in("status", ["new", "under_review"])'));
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

test("opening a notification records it as read before navigation", () => {
  const openTargetStart = notifications.indexOf(
    "async function openNotificationTarget(notification: NotificationItem)",
  );
  const markReadIndex = notifications.indexOf("await markOne(notification.id)", openTargetStart);
  const firstNavigationIndex = notifications.indexOf("void navigate(", openTargetStart);

  assert.ok(openTargetStart >= 0);
  assert.ok(markReadIndex > openTargetStart);
  assert.ok(firstNavigationIndex > markReadIndex);
  assert.match(notifications, /if \(!notification\.readAt\) \{[\s\S]*await markOne\(notification\.id\)/);
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
