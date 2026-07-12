import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workflow, productionSpec, marketplaceSpec, packageJson, qualityGate] = await Promise.all([
  readFile(new URL("../.github/workflows/production-smoke.yml", import.meta.url), "utf8"),
  readFile(new URL("../e2e/production-smoke.spec.ts", import.meta.url), "utf8"),
  readFile(new URL("../e2e/marketplace-smoke.spec.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("production smoke targets the canonical RAWAJ domain after main deploys", () => {
  assert.match(workflow, /E2E_BASE_URL:\s*https:\/\/rawa-j\.com/);
  assert.match(workflow, /PRODUCTION_SMOKE:\s*"1"/);
  assert.match(workflow, /branches:\s*\n\s*- main/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /Wait for production deployment/);
  assert.match(workflow, /production-smoke\.spec\.ts/);
});

test("production smoke covers discovery, legal, support, console, and network health", () => {
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
  assert.match(productionSpec, /page\.on\("pageerror"/);
  assert.match(productionSpec, /page\.on\("console"/);
  assert.match(productionSpec, /page\.on\("requestfailed"/);
  assert.match(productionSpec, /href\^="\/category\/"/);
  assert.match(productionSpec, /\/syria\//);
});

test("local browser smoke includes launch-critical public and not-found routes", () => {
  for (const path of ["/privacy", "/terms", "/prohibited", "/promotion"]) {
    assert.ok(marketplaceSpec.includes(`"${path}"`), `Missing browser smoke route ${path}`);
  }
  assert.match(marketplaceSpec, /unknown routes render a controlled not-found surface/);
  assert.match(marketplaceSpec, /requestfailed/);
});

test("Batch 9 remains wired into package and Quality Gate", () => {
  assert.match(packageJson, /"test:launch-readiness-batch-9"/);
  assert.match(qualityGate, /Launch readiness Batch 9 contract/);
  assert.match(qualityGate, /npm run test:launch-readiness-batch-9/);
});
