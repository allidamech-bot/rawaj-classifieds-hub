import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [viteConfig, buildInfo, panel, adminRoute, productionWorkflow, productionSpec, browserSpec] =
  await Promise.all([
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/build-info.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/DeploymentTruthPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/production-smoke.yml", import.meta.url), "utf8"),
    readFile(new URL("../e2e/production-smoke.spec.ts", import.meta.url), "utf8"),
    readFile(new URL("../e2e/marketplace-smoke.spec.ts", import.meta.url), "utf8"),
  ]);

test("build metadata is embedded from Vercel or CI truth", () => {
  assert.match(viteConfig, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(viteConfig, /VERCEL_GIT_COMMIT_REF/);
  assert.match(viteConfig, /VERCEL_ENV/);
  assert.match(viteConfig, /__RAWAJ_BUILD_INFO__/);
  assert.match(buildInfo, /rawajBuildInfo/);
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
  assert.match(productionWorkflow, /branches:\s*\n\s*- main/);
  assert.match(productionWorkflow, /workflow_dispatch:/);
  assert.match(productionWorkflow, /Wait for production deployment/);
  assert.match(productionWorkflow, /production-smoke\.spec\.ts/);
});

test("production health covers discovery, policy, console, and network failures", () => {
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

test("local browser smoke retains legal and controlled not-found coverage", () => {
  for (const path of ["/privacy", "/terms", "/prohibited", "/promotion"]) {
    assert.ok(browserSpec.includes(`"${path}"`), `Missing browser smoke route ${path}`);
  }
  assert.match(browserSpec, /unknown routes render a controlled not-found surface/);
  assert.match(browserSpec, /requestfailed/);
});
