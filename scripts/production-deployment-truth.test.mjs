import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  viteConfig,
  buildInfo,
  panel,
  adminRoute,
  rootRoute,
  productionWorkflow,
  productionSpec,
  browserSpec,
  productionSchemaProof,
  productionChecklist,
  phaseZeroProofSql,
] = await Promise.all([
  readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/build-info.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/DeploymentTruthPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/production-smoke.yml", import.meta.url), "utf8"),
  readFile(new URL("../e2e/production-smoke.spec.ts", import.meta.url), "utf8"),
  readFile(new URL("../e2e/marketplace-smoke.spec.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../docs/production-schema/production-schema-proof.md", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../docs/final-audit/production-verification-checklist.md", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../supabase/verification/20260716_phase_0_production_proof.sql", import.meta.url),
    "utf8",
  ),
]);

test("build metadata is embedded from Vercel or CI truth", () => {
  assert.match(viteConfig, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(viteConfig, /VERCEL_GIT_COMMIT_REF/);
  assert.match(viteConfig, /VERCEL_ENV/);
  assert.match(viteConfig, /__RAWAJ_BUILD_INFO__/);
  assert.match(buildInfo, /rawajBuildInfo/);
  assert.match(rootRoute, /name: "rawaj-build-commit"/);
  assert.match(rootRoute, /content: rawajBuildInfo\.commitSha/);
});

test("owner controls expose the build identity panel", () => {
  assert.match(adminRoute, /DeploymentTruthPanel/);
  assert.match(adminRoute, /\/admin\/owner-controls/);
  assert.match(panel, /Current build identity/);
  assert.match(panel, /Environment \/ target/);
  assert.match(panel, /Deployment host/);
});

test("main deployments trigger a real RAWAJ production smoke workflow", () => {
  assert.match(productionWorkflow, /E2E_BASE_URL:\s*https:\/\/rawa-j\.com/);
  assert.match(productionWorkflow, /PRODUCTION_SMOKE:\s*"1"/);
  assert.match(productionWorkflow, /EXPECTED_COMMIT_SHA:\s*\$\{\{ github\.sha \}\}/);
  assert.match(productionWorkflow, /branches:\s*\n\s*- main/);
  assert.match(productionWorkflow, /workflow_dispatch:/);
  assert.match(productionWorkflow, /Wait for matching production deployment/);
  assert.match(productionWorkflow, /rawaj-build-commit/);
  assert.match(productionWorkflow, /production-smoke\.spec\.ts/);
});

test("production health covers identity, discovery, policy, console, and network failures", () => {
  for (const path of [
    "/categories",
    "/listings",
    "/support",
    "/safety",
    "/privacy",
    "/terms",
    "/prohibited",
    "/promotion",
    "/sitemap.xml",
    "/robots.txt",
  ]) {
    assert.ok(productionSpec.includes(path), `Missing production route contract for ${path}`);
  }
  assert.match(productionSpec, /EXPECTED_COMMIT_SHA/);
  assert.match(productionSpec, /rawaj-build-commit/);
  assert.match(productionSpec, /page\.on\("pageerror"/);
  assert.match(productionSpec, /page\.on\("console"/);
  assert.match(productionSpec, /page\.on\("requestfailed"/);
  assert.ok(productionSpec.includes("/category/"), "Missing category landing discovery check");
  assert.ok(productionSpec.includes("syria"), "Missing governorate landing discovery check");
});

test("local browser smoke retains legal and controlled not-found coverage", () => {
  for (const path of ["/privacy", "/terms", "/prohibited", "/promotion"]) {
    assert.ok(browserSpec.includes(`"${path}"`), `Missing browser smoke route ${path}`);
  }
  assert.match(browserSpec, /unknown routes render a controlled not-found surface/);
  assert.match(browserSpec, /requestfailed/);
});

test("Production proof distinguishes historical evidence from every current release delta", () => {
  assert.match(productionSchemaProof, /Historical Production extraction retained/);
  for (const migration of [
    "202607160002_require_listing_moderation_audit.sql",
    "202607160003_enable_chat_realtime.sql",
    "202607160004_harden_push_delivery_device_lifecycle.sql",
    "202607160005_preserve_multi_device_push_preference.sql",
  ]) {
    assert.ok(
      productionSchemaProof.includes(migration),
      `Missing Production release-delta evidence for ${migration}`,
    );
  }
  assert.match(productionSchemaProof, /Unknown until applied and verified/);
  assert.match(
    productionSchemaProof,
    /Realtime conclusion from the historical document is superseded/,
  );
  assert.match(productionSchemaProof, /Push delivery queue lifecycle correction requires/);
  assert.match(productionSchemaProof, /Multi-device Push preference correction requires/);
  assert.doesNotMatch(
    productionSchemaProof,
    /no current repository evidence that RAWAJ depends on database-change Realtime subscriptions/i,
  );
  assert.doesNotMatch(productionSchemaProof, /No repository evidence requires Realtime/i);
});

test("Production proof bundle is read-only and covers review, Realtime, and Push corrections", () => {
  assert.match(phaseZeroProofSql, /BEGIN TRANSACTION READ ONLY/);
  assert.match(phaseZeroProofSql, /ROLLBACK;/);
  assert.doesNotMatch(
    phaseZeroProofSql,
    /^\s*(?:insert|update|delete|alter|create|drop|grant|revoke|truncate)\b/im,
  );
  assert.match(phaseZeroProofSql, /rawaj_review_listing_decision/);
  assert.match(phaseZeroProofSql, /listing_moderation_actions/);
  assert.match(phaseZeroProofSql, /rawaj_insert_audit_log/);
  assert.match(phaseZeroProofSql, /pg_publication_tables/);
  assert.match(phaseZeroProofSql, /conversations/);
  assert.match(phaseZeroProofSql, /conversation_messages/);
  assert.match(phaseZeroProofSql, /relrowsecurity/);
  assert.match(phaseZeroProofSql, /has_table_privilege/);
  assert.match(phaseZeroProofSql, /rawaj_disable_push_device_v1/);
  assert.match(phaseZeroProofSql, /rawaj_mark_push_delivery_v1/);
  assert.match(phaseZeroProofSql, /rawaj_upsert_push_device_v1/);
  assert.match(phaseZeroProofSql, /has_function_privilege/);
  assert.match(phaseZeroProofSql, /inactive_device_nonterminal_deliveries/);
  assert.match(phaseZeroProofSql, /active_granted_devices/);
});

test("Production checklist requires application and behavioral evidence", () => {
  for (const migration of [
    "202607160002_require_listing_moderation_audit.sql",
    "202607160003_enable_chat_realtime.sql",
    "202607160004_harden_push_delivery_device_lifecycle.sql",
    "202607160005_preserve_multi_device_push_preference.sql",
  ]) {
    assert.ok(productionChecklist.includes(migration), `Missing checklist entry for ${migration}`);
  }
  assert.match(productionChecklist, /participant A sends a message to participant B/);
  assert.match(productionChecklist, /non-participant C receives no conversation event/);
  assert.match(productionChecklist, /device A and device B are registered/);
  assert.match(productionChecklist, /seller-review notification opens the intended seller storefront/);
  assert.match(productionChecklist, /inactive devices have zero/);
  assert.match(productionChecklist, /full Production catalog extraction refreshed/);
  assert.match(
    productionChecklist,
    /Repository presence, a merged PR, and a passing build do not prove/,
  );
});
