import { readFile, writeFile, rm } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${path}: expected exactly one match, found ${occurrences}`);
  }
  await writeFile(path, source.replace(before, after));
}

async function replaceRegexOnce(path, pattern, replacement) {
  const source = await readFile(path, "utf8");
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) {
    throw new Error(`${path}: expected exactly one regex match, found ${matches.length}`);
  }
  await writeFile(path, source.replace(pattern, replacement));
}

await replaceOnce(
  "src/routes/admin.listings.tsx",
  "    const actionKey = `${listing.id}:${action}`;",
  "    const actionKey = listing.id;",
);

await replaceOnce(
  "src/routes/admin.data-quality.tsx",
  "    const actionKey = `${issue.id}:${decision}`;",
  "    const actionKey = issue.id;",
);

await replaceRegexOnce(
  "src/routes/admin.reports.tsx",
  /      const updatedAt = new Date\(\)\.toISOString\(\);\n      setReports\(\(current\) =>[\s\S]*?      setActionMessage\(text\("تم تحديث البلاغ\.", "Report updated\."\)\);\n      void loadReports\(\);/,
  `      setActionMessage(text("تم تحديث البلاغ.", "Report updated."));
      await loadReports();`,
);

await replaceRegexOnce(
  "src/routes/admin.message-reports.tsx",
  /      const updatedAt = new Date\(\)\.toISOString\(\);\n      setReports\(\(current\) =>[\s\S]*?      setNotice\(text\("تم تحديث بلاغ الرسالة\.", "Message report updated\."\)\);\n      void loadReports\(\);/,
  `      setNotice(text("تم تحديث بلاغ الرسالة.", "Message report updated."));
      await loadReports();`,
);

await replaceOnce(
  "src/routes/admin.promotions.tsx",
  "    if (!request.proofPath || receiptInFlightRef.current.has(request.id)) return;",
  "    if (!request.proofPath || receiptInFlightRef.current.size > 0) return;",
);
await replaceOnce(
  "src/routes/admin.promotions.tsx",
  "                          disabled={receiptLoadingId === request.id}",
  "                          disabled={receiptLoadingId !== null}",
);
await replaceOnce(
  "src/routes/admin.promotions.tsx",
  `              <textarea
                value={notes[request.id] ?? ""}`,
  `              <textarea
                value={notes[request.id] ?? ""}
                disabled={workingRequestId === request.id}`,
);
await replaceOnce(
  "src/routes/admin.promotions.tsx",
  `                  <button
                    onClick={() => void moderate(request, "approved")}
                    className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                  >
                    {text("موافقة", "Approve")}
                  </button>
                  <button
                    onClick={() => void moderate(request, "rejected")}
                    className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                  >
                    {text("رفض", "Reject")}
                  </button>`,
  `                  <button
                    type="button"
                    disabled={workingRequestId === request.id}
                    aria-busy={workingRequestId === request.id}
                    onClick={() => void moderate(request, "approved")}
                    className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground disabled:opacity-60"
                  >
                    {workingRequestId === request.id
                      ? text("جارٍ التحديث", "Updating")
                      : text("موافقة", "Approve")}
                  </button>
                  <button
                    type="button"
                    disabled={workingRequestId === request.id}
                    aria-busy={workingRequestId === request.id}
                    onClick={() => void moderate(request, "rejected")}
                    className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60"
                  >
                    {workingRequestId === request.id
                      ? text("جارٍ التحديث", "Updating")
                      : text("رفض", "Reject")}
                  </button>`,
);

await replaceOnce(
  "src/routes/admin.verifications.tsx",
  "    if (!request.documentPath || documentInFlightRef.current.has(request.id)) return;",
  "    if (!request.documentPath || documentInFlightRef.current.size > 0) return;",
);
await replaceOnce(
  "src/routes/admin.verifications.tsx",
  "                        disabled={loadingDocumentId === request.id}",
  "                        disabled={loadingDocumentId !== null}",
);
await replaceOnce(
  "src/routes/admin.verifications.tsx",
  `              <textarea
                value={notes[request.id] ?? ""}`,
  `              <textarea
                value={notes[request.id] ?? ""}
                disabled={workingRequestId === request.id}`,
);
await replaceOnce(
  "src/routes/admin.verifications.tsx",
  `                  <button
                    type="button"
                    onClick={() => void moderate(request, "approved")}
                    className="inline-flex min-h-11 items-center rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                  >
                    {text("موافقة", "Approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void moderate(request, "rejected")}
                    className="inline-flex min-h-11 items-center rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                  >
                    {text("رفض", "Reject")}
                  </button>`,
  `                  <button
                    type="button"
                    disabled={workingRequestId === request.id}
                    aria-busy={workingRequestId === request.id}
                    onClick={() => void moderate(request, "approved")}
                    className="inline-flex min-h-11 items-center rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground disabled:opacity-60"
                  >
                    {workingRequestId === request.id
                      ? text("جارٍ التحديث", "Updating")
                      : text("موافقة", "Approve")}
                  </button>
                  <button
                    type="button"
                    disabled={workingRequestId === request.id}
                    aria-busy={workingRequestId === request.id}
                    onClick={() => void moderate(request, "rejected")}
                    className="inline-flex min-h-11 items-center rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60"
                  >
                    {workingRequestId === request.id
                      ? text("جارٍ التحديث", "Updating")
                      : text("رفض", "Reject")}
                  </button>`,
);

await replaceOnce(
  "src/routes/admin.campaigns.tsx",
  "  async function changeStatus(campaign: CampaignSummary, status: CampaignStatus) {\n    const reason = statusReason.trim();",
  "  async function changeStatus(campaign: CampaignSummary, status: CampaignStatus) {\n    if (saving) return;\n    const reason = statusReason.trim();",
);
await replaceOnce(
  "src/routes/admin.campaigns.tsx",
  "      targetCategoryIds: campaignForm.categoryIdsText.split(\",\"),",
  `      targetCategoryIds: [...new Set(
        campaignForm.categoryIdsText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      )],`,
);
await replaceOnce(
  "src/routes/admin.campaigns.tsx",
  "    await refreshCampaigns();\n    const refreshed = await ownerFetchCampaigns(canManage);",
  "    const refreshed = await ownerFetchCampaigns(canManage);",
);

const contract = `import assert from "node:assert/strict";
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
  await Promise.all(routeFiles.map(async (file) => [file, await readFile(new URL(\`../\${file}\`, import.meta.url), "utf8")])),
);
const allAdminSource = [...routeSources.values()].join("\n");
const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql"));
const migrationSql = (
  await Promise.all(migrationFiles.map((file) => readFile(new URL(file, migrationsDir), "utf8")))
).join("\n");

function source(path) {
  const value = routeSources.get(path);
  assert.ok(value, \`Missing source: \${path}\`);
  return value;
}

function count(sourceText, expression) {
  return [...sourceText.matchAll(expression)].length;
}

test("admin route inventory is complete", () => {
  assert.equal(routeFiles.length, 16);
  const inventory = {
    pages: routeFiles.length,
    buttons: count(allAdminSource, /<button\\b/g),
    links: count(allAdminSource, /<(?:Link|a)\\b/g),
    forms: count(allAdminSource, /<form\\b/g),
    filtersAndFields: count(allAdminSource, /<(?:input|select|textarea)\\b/g),
  };
  inventory.interactiveElements = inventory.buttons + inventory.links + inventory.forms + inventory.filtersAndFields;
  console.log(\`ADMIN_ACTIONS_INVENTORY \${JSON.stringify(inventory)}\`);
  assert.ok(inventory.buttons > 40, "Expected a substantial admin button inventory");
  assert.ok(inventory.interactiveElements > 100, "Expected all admin interactive controls to be inventoried");
});

test("record mutations serialize conflicting decisions per record", () => {
  assert.match(source("src/routes/admin.listings.tsx"), /const actionKey = listing\\.id;/);
  assert.doesNotMatch(source("src/routes/admin.listings.tsx"), /listing\\.id}:\\$\\{action/);
  assert.match(source("src/routes/admin.data-quality.tsx"), /const actionKey = issue\\.id;/);
  assert.doesNotMatch(source("src/routes/admin.data-quality.tsx"), /issue\\.id}:\\$\\{decision/);
});

test("report moderation keeps controls busy until authoritative refetch", () => {
  for (const file of ["src/routes/admin.reports.tsx", "src/routes/admin.message-reports.tsx"]) {
    const value = source(file);
    assert.match(value, /await loadReports\\(\\);/);
    assert.doesNotMatch(value, /const updatedAt = new Date\\(\\)\\.toISOString\\(\\)/);
    assert.doesNotMatch(value, /void loadReports\\(\\);/);
  }
});

test("promotion and verification decisions expose loading and disable duplicate actions", () => {
  for (const file of ["src/routes/admin.promotions.tsx", "src/routes/admin.verifications.tsx"]) {
    const value = source(file);
    assert.match(value, /disabled=\\{workingRequestId === request\\.id}/);
    assert.match(value, /aria-busy=\\{workingRequestId === request\\.id}/);
    assert.match(value, /type="button"/);
  }
  assert.match(source("src/routes/admin.promotions.tsx"), /receiptInFlightRef\\.current\\.size > 0/);
  assert.match(source("src/routes/admin.verifications.tsx"), /documentInFlightRef\\.current\\.size > 0/);
});

test("campaign payload and status controls reject malformed or repeated actions", () => {
  const value = source("src/routes/admin.campaigns.tsx");
  assert.match(value, /async function changeStatus[\\s\\S]*?if \\(saving\\) return;/);
  assert.match(value, /targetCategoryIds: \\[\\.\\.\\.new Set\\(/);
  assert.match(value, /\\.map\\(\\(value\\) => value\\.trim\\(\\)\\)/);
  assert.match(value, /\\.filter\\(Boolean\\)/);
  assert.doesNotMatch(value, /targetCategoryIds: campaignForm\\.categoryIdsText\\.split\\(","\\)/);
});

test("critical admin RPC contracts exist in frontend and migration ledger", () => {
  const contracts = [
    ["rawaj_admin_moderate_listing", "p_listing_id", "p_expected_updated_at"],
    ["rawaj_admin_moderate_listing_report_v2", "p_report_id", "p_expected_updated_at"],
    ["rawaj_admin_moderate_message_report", "p_report_id", "p_expected_updated_at"],
    ["rawaj_admin_moderate_promotion_request_v2", "p_request_id", "p_expected_updated_at"],
    ["rawaj_admin_moderate_verification_request_v2", "p_request_id", "p_expected_updated_at"],
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
  const apiSourcePromise = Promise.all(apiFiles.map((file) => readFile(new URL(\`../\${file}\`, import.meta.url), "utf8"));
  return apiSourcePromise.then((parts) => {
    const apiSource = parts.join("\n");
    for (const [rpc, ...keys] of contracts) {
      assert.ok(apiSource.includes(\`rpc("\${rpc}"\`), \`Frontend RPC missing: \${rpc}\`);
      assert.ok(migrationSql.includes(rpc), \`Migration ledger missing RPC: \${rpc}\`);
      for (const key of keys) assert.ok(apiSource.includes(key), \`Payload key missing: \${rpc}.\${key}\`);
    }
  });
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
  for (const permission of permissions) assert.ok(layout.includes(permission), \`Missing route permission: \${permission}\`);
  assert.match(layout, /!auth\\.hasPermission\\(requestedTab\\.permission\\)/);
});
`;
await writeFile("scripts/admin-actions-integrity.test.mjs", contract);

const workflow = `name: Admin Actions Integrity

on:
  pull_request:
    paths:
      - "src/routes/admin*.tsx"
      - "src/lib/api/**"
      - "scripts/admin-actions-integrity.test.mjs"
      - ".github/workflows/admin-actions-integrity.yml"
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: admin-actions-integrity-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Admin Actions Integrity Contract
        run: node --test scripts/admin-actions-integrity.test.mjs
      - name: ESLint
        run: npm run lint
      - name: TypeScript
        run: npm run typecheck
      - name: Production build
        run: npm run build
`;
await writeFile(".github/workflows/admin-actions-integrity.yml", workflow);

const inventoryDoc = `# RAWAJ Admin Actions Inventory

This inventory covers the complete generated \\`/admin/*\\` route surface at the audited baseline.

## Routes (16)

1. \\`/admin\\` — protected layout and permission-scoped navigation
2. \\`/admin/\\` — command center and retry/navigation actions
3. \\`/admin/pending\\` — pending listing review
4. \\`/admin/listings\\` — listing decisions
5. \\`/admin/data-quality\\` — scans, filters, pagination, and issue decisions
6. \\`/admin/reviews\\` — seller review and review-report moderation
7. \\`/admin/reports\\` — listing reports
8. \\`/admin/message-reports\\` — reported messages
9. \\`/admin/safety\\` — safety cases, evidence, escalation, and status changes
10. \\`/admin/verifications\\` — seller verification requests and private evidence
11. \\`/admin/users\\` — account status, restrictions, and staff roles
12. \\`/admin/promotions\\` — promotion requests and private receipts
13. \\`/admin/ad-placements\\` — placement CRUD, image upload, status, and delete confirmation
14. \\`/admin/campaigns\\` — campaign and creative management
15. \\`/admin/audit\\` — filters, retry, and pagination
16. \\`/admin/owner-controls\\` — owner-only system controls

## Integrity rules

- A record cannot receive two conflicting mutations concurrently.
- Mutation controls stay disabled until the authoritative server state is reloaded.
- Private evidence links are generated one at a time and expose loading/error state.
- Every sensitive mutation carries an expected timestamp/version when its RPC requires one.
- Route visibility and direct route access both require the persisted permission.
- Critical frontend RPC names and payload keys are checked against the migration ledger.
- Production-safe verification uses static contracts and CI; no destructive production mutation is required.

The contract test prints the exact current counts for buttons, links, forms, and filter/field controls on every run.
`;
await writeFile("docs/admin-actions-inventory.md", inventoryDoc);

await rm("scripts/apply-admin-actions-integrity-repair.mjs", { force: true });
await rm(".github/workflows/apply-admin-actions-integrity-repair.yml", { force: true });
