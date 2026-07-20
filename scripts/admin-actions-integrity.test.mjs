import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const routeFiles = [
  "src/routes/admin.tsx",
  "src/routes/admin.index.tsx",
  "src/routes/admin.pending.tsx",
  "src/routes/admin.listings.tsx",
  "src/routes/admin.data-quality.tsx",
  "src/routes/admin.reviews.tsx",
  "src/routes/admin.reports.tsx",
  "src/routes/admin.message-reports.tsx",
  "src/routes/admin.safety.tsx",
  "src/routes/admin.verifications.tsx",
  "src/routes/admin.users.tsx",
  "src/routes/admin.promotions.tsx",
  "src/routes/admin.ad-placements.tsx",
  "src/routes/admin.campaigns.tsx",
  "src/routes/admin.audit.tsx",
  "src/routes/admin.owner-controls.tsx",
];

const routeSources = new Map(
  await Promise.all(
    routeFiles.map(async (file) => [
      file,
      await readFile(new URL(`../${file}`, import.meta.url), "utf8"),
    ]),
  ),
);
const allAdminSource = [...routeSources.values()].join("\n");
const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql"));
const migrationSql = (
  await Promise.all(migrationFiles.map((file) => readFile(new URL(file, migrationsDir), "utf8")))
).join("\n");

function source(path) {
  const value = routeSources.get(path);
  assert.ok(value, `Missing source: ${path}`);
  return value;
}

function count(sourceText, expression) {
  return [...sourceText.matchAll(expression)].length;
}

test("admin route inventory is complete", () => {
  assert.equal(routeFiles.length, 16);
  const inventory = {
    pages: routeFiles.length,
    buttons: count(allAdminSource, /<button\b/g),
    links: count(allAdminSource, /<(?:Link|a)\b/g),
    forms: count(allAdminSource, /<form\b/g),
    filtersAndFields: count(allAdminSource, /<(?:input|select|textarea)\b/g),
  };
  inventory.interactiveElements =
    inventory.buttons + inventory.links + inventory.forms + inventory.filtersAndFields;
  console.log(`ADMIN_ACTIONS_INVENTORY ${JSON.stringify(inventory)}`);
  assert.ok(inventory.buttons > 40, "Expected a substantial admin button inventory");
  assert.ok(
    inventory.interactiveElements > 100,
    "Expected all admin interactive controls to be inventoried",
  );
});

test("record mutations serialize conflicting decisions per record", () => {
  assert.match(source("src/routes/admin.listings.tsx"), /const actionKey = listing\.id;/);
  assert.doesNotMatch(source("src/routes/admin.listings.tsx"), /listing\.id}:\$\{action/);
  assert.match(source("src/routes/admin.data-quality.tsx"), /const actionKey = issue\.id;/);
  assert.doesNotMatch(source("src/routes/admin.data-quality.tsx"), /issue\.id}:\$\{decision/);
});

test("report moderation stays busy until authoritative refetch", () => {
  for (const file of ["src/routes/admin.reports.tsx", "src/routes/admin.message-reports.tsx"]) {
    const value = source(file);
    assert.match(value, /await loadReports\(\);/);
    assert.doesNotMatch(value, /const updatedAt = new Date\(\)\.toISOString\(\)/);
    assert.doesNotMatch(value, /void loadReports\(\);/);
  }
});

test("promotion and verification decisions expose loading and prevent duplicate actions", () => {
  for (const file of ["src/routes/admin.promotions.tsx", "src/routes/admin.verifications.tsx"]) {
    const value = source(file);
    assert.match(value, /disabled=\{workingRequestId === request\.id}/);
    assert.match(value, /aria-busy=\{workingRequestId === request\.id}/);
    assert.match(value, /type="button"/);
  }
  assert.match(
    source("src/routes/admin.promotions.tsx"),
    /receiptInFlightRef\.current\.size > 0/,
  );
  assert.match(
    source("src/routes/admin.verifications.tsx"),
    /documentInFlightRef\.current\.size > 0/,
  );
});

test("campaign payload and status controls reject malformed or repeated actions", () => {
  const value = source("src/routes/admin.campaigns.tsx");
  assert.match(value, /async function changeStatus[\s\S]*?if \(saving\) return;/);
  assert.match(value, /targetCategoryIds: \[\.\.\.new Set\(/);
  assert.match(value, /\.map\(\(value\) => value\.trim\(\)\)/);
  assert.match(value, /\.filter\(Boolean\)/);
  assert.doesNotMatch(
    value,
    /targetCategoryIds: campaignForm\.categoryIdsText\.split\(","\)/,
  );
});

test("critical admin RPC contracts exist in frontend and migration ledger", async () => {
  const contracts = [
    ["rawaj_admin_moderate_listing", "p_listing_id", "p_expected_updated_at"],
    ["rawaj_admin_moderate_listing_report_v2", "p_report_id", "p_expected_updated_at"],
    ["rawaj_admin_moderate_message_report", "p_report_id", "p_expected_updated_at"],
    ["rawaj_admin_moderate_promotion_request", "p_request_id", "p_expected_updated_at"],
    ["rawaj_admin_moderate_verification_request", "p_request_id", "p_expected_updated_at"],
    ["rawaj_owner_set_system_control", "p_key", "p_expected_version"],
  ];
  const apiFiles = [
    "src/lib/api/admin-listing-moderation.ts",
    "src/lib/api/reports.ts",
    "src/lib/api/messaging.ts",
    "src/lib/api/promotions.ts",
    "src/lib/api/verification.ts",
    "src/lib/api/owner-system-controls.ts",
  ];
  const apiSource = (
    await Promise.all(
      apiFiles.map((file) => readFile(new URL(`../${file}`, import.meta.url), "utf8")),
    )
  ).join("\n");

  for (const [rpc, ...keys] of contracts) {
    assert.ok(apiSource.includes(`rpc("${rpc}"`), `Frontend RPC missing: ${rpc}`);
    assert.ok(migrationSql.includes(rpc), `Migration ledger missing RPC: ${rpc}`);
    for (const key of keys) {
      assert.ok(apiSource.includes(key), `Payload key missing: ${rpc}.${key}`);
    }
  }
});

test("admin route permissions remain explicit", () => {
  const layout = source("src/routes/admin.tsx");
  const permissions = [
    "canViewAdminDashboard",
    "canModerateListings",
    "canManageReviews",
    "canManageReports",
    "canManageVerifications",
    "canManageUsers",
    "canManagePromotions",
    "canManageAdPlacements",
    "canManageAdCampaigns",
    "canViewAuditLogs",
    "canManageSystemSettings",
  ];
  for (const permission of permissions) {
    assert.ok(layout.includes(permission), `Missing route permission: ${permission}`);
  }
  assert.match(layout, /!auth\.hasPermission\(requestedTab\.permission\)/);
});
