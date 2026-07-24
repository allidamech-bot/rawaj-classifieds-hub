// Permanent regression contract for RAWAJ launch-critical authentication, ownership and image-ordering journeys.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [login, callback, addRoute, editRoute, api, barrel, packageJson] = await Promise.all([
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/auth.callback.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.$id.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-image-order.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("new accounts with an immediate Cloudflare session enter RAWAJ directly", () => {
  const registerStart = login.indexOf('if (mode === "register")');
  const loginSuccess = login.indexOf('setMessage(text("تم تسجيل الدخول"', registerStart);
  const registrationBranch = login.slice(registerStart, loginSuccess);
  assert.ok(registerStart >= 0 && loginSuccess > registerStart);
  assert.ok(login.includes("await auth.signUpWithPassword"));
  assert.ok(login.includes("Account created. Opening RAWAJ now."));
  assert.ok(login.includes("await navigate({ to: returnTo });"));
  assert.ok(!login.includes("result.data.session"));
  assert.ok(!login.includes("confirm your email"));
});

test("authentication callback always releases its auth listener", () => {
  assert.ok(callback.includes("let unsubscribeAuth: (() => void) | undefined;"));
  assert.ok(callback.includes("unsubscribeAuth = () => listener.subscription.unsubscribe();"));
  assert.ok(callback.includes("unsubscribeAuth?.();"));
});

test("owner deletion UI uses the shared API status contract", () => {
  assert.ok(editRoute.includes("isOwnerDeletableStatus(listing.status)"));
  assert.ok(!editRoute.includes('const isDeletable = listing?.status === "draft"'));
});

test("listing image ordering is persisted with ownership state and zero-row checks", () => {
  assert.ok(barrel.includes('export * from "@/lib/api/listing-image-order";'));
  assert.ok(api.includes("export async function reorderListingImages"));
  assert.ok(api.includes('.eq("owner_id", userId)'));
  assert.ok(api.includes('.in("status", ["draft", "rejected"])'));
  assert.ok(api.includes("current.length !== normalized.length"));
  assert.ok(api.includes("if (updateError || !updated)"));
  assert.ok(api.includes("originalOrder"));
});

test("create and edit studios expose deterministic photo order controls", () => {
  assert.ok(addRoute.includes("async function moveSelectedImage"));
  assert.ok(addRoute.includes("reorderListingImages"));
  assert.ok(editRoute.includes("async function moveExistingImage"));
  assert.ok(editRoute.includes("function moveSelectedPendingImage"));
  assert.ok(addRoute.includes("Move photo earlier"));
  assert.ok(editRoute.includes("Move photo later"));
});

test("Batch 1 and auth recovery contracts are permanent Quality Gate inputs", () => {
  const parsed = JSON.parse(packageJson);
  assert.ok(parsed.scripts["test:auth-recovery"]);
  assert.ok(parsed.scripts["test:launch-readiness-batch-1"]);
  assert.ok(parsed.scripts.check.includes("test:auth-recovery"));
  assert.ok(parsed.scripts.check.includes("test:launch-readiness-batch-1"));
});
