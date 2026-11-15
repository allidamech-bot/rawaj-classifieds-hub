import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  inspectRepositoryEdgeCutover,
  LEGACY_API_ORIGIN,
  PROTECTED_API_ORIGIN,
  validateCloudflareEdgeCutover,
} from "./cloudflare-edge-cutover-contract.mjs";

async function currentSources() {
  const root = new URL("../", import.meta.url);
  const [environmentSource, vercelConfig, workerConfig, renderConfigSource, productionWorkflowSource] =
    await Promise.all([
      readFile(new URL(".env.production", root), "utf8"),
      readFile(new URL("vercel.json", root), "utf8").then(JSON.parse),
      readFile(new URL("cloudflare/worker/wrangler.base.jsonc", root), "utf8").then(JSON.parse),
      readFile(new URL("cloudflare/worker/scripts/render-config.mjs", root), "utf8"),
      readFile(new URL(".github/workflows/cloudflare-production-worker-deploy.yml", root), "utf8"),
    ]);
  return { environmentSource, vercelConfig, workerConfig, renderConfigSource, productionWorkflowSource };
}

function protectSources(inputs) {
  const copy = structuredClone(inputs);
  copy.environmentSource = copy.environmentSource.replace(LEGACY_API_ORIGIN, PROTECTED_API_ORIGIN);
  copy.vercelConfig.rewrites = copy.vercelConfig.rewrites.map((route) => ({
    ...route,
    destination: route.destination.replace(LEGACY_API_ORIGIN, PROTECTED_API_ORIGIN),
  }));
  copy.workerConfig.workers_dev = false;
  copy.workerConfig.routes = [{ pattern: "api.rawa-j.com", custom_domain: true }];
  copy.renderConfigSource = copy.renderConfigSource.replace(
    "Refusing production render: the Syria Worker must remain",
    "Operator-reviewed protected-domain render configuration",
  );
  copy.productionWorkflowSource = copy.productionWorkflowSource.replace(
    "RAWAJ_WORKER_BASE_URL: " + LEGACY_API_ORIGIN,
    "RAWAJ_WORKER_BASE_URL: " + PROTECTED_API_ORIGIN,
  );
  return copy;
}

test("current production stays in explicitly frozen legacy configuration", async () => {
  const result = await inspectRepositoryEdgeCutover();
  assert.equal(result.mode, "legacy");
  assert.equal(result.valid, true, result.errors.join("; "));
});

test("an atomic protected-domain configuration can pass only after every cutover setting changes", async () => {
  const sources = protectSources(await currentSources());
  const result = validateCloudflareEdgeCutover(sources);
  assert.equal(result.mode, "protected");
  assert.deepEqual(result.errors, []);
});

test("changing only the frontend URL fails before deployment", async () => {
  const sources = await currentSources();
  sources.environmentSource = sources.environmentSource.replace(LEGACY_API_ORIGIN, PROTECTED_API_ORIGIN);
  const result = validateCloudflareEdgeCutover(sources);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("rewrite")));
  assert.ok(result.errors.some((error) => error.includes("custom domain")));
});

test("protected endpoint without its explicit Cloudflare Worker route is rejected", async () => {
  const sources = protectSources(await currentSources());
  sources.workerConfig.routes = [];
  const result = validateCloudflareEdgeCutover(sources);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("custom domain")));
});

test("staged new domain can coexist with the old live endpoint during verification", async () => {
  const sources = protectSources(await currentSources());
  sources.environmentSource = sources.environmentSource.replace(PROTECTED_API_ORIGIN, LEGACY_API_ORIGIN);
  sources.vercelConfig.rewrites = sources.vercelConfig.rewrites.map((route) => ({
    ...route,
    destination: route.destination.replace(PROTECTED_API_ORIGIN, LEGACY_API_ORIGIN),
  }));
  sources.workerConfig.workers_dev = true;
  sources.productionWorkflowSource = sources.productionWorkflowSource.replace(
    "RAWAJ_WORKER_BASE_URL: " + PROTECTED_API_ORIGIN,
    "RAWAJ_WORKER_BASE_URL: " + LEGACY_API_ORIGIN,
  );
  const result = validateCloudflareEdgeCutover(sources);
  assert.equal(result.mode, "staging");
  assert.equal(result.valid, true, result.errors.join("; "));
});

test("temporary dual-route handoff is supported before the final workers.dev shutdown", async () => {
  const sources = protectSources(await currentSources());
  sources.workerConfig.workers_dev = true;
  const result = validateCloudflareEdgeCutover(sources);
  assert.equal(result.mode, "cutover");
  assert.equal(result.valid, true, result.errors.join("; "));
});

test("staging rejects an old render freeze that would undo custom domain support", async () => {
  const sources = protectSources(await currentSources());
  sources.workerConfig.workers_dev = true;
  sources.environmentSource = sources.environmentSource.replace(PROTECTED_API_ORIGIN, LEGACY_API_ORIGIN);
  sources.vercelConfig.rewrites = sources.vercelConfig.rewrites.map((route) => ({
    ...route,
    destination: route.destination.replace(PROTECTED_API_ORIGIN, LEGACY_API_ORIGIN),
  }));
  sources.productionWorkflowSource = sources.productionWorkflowSource.replace(
    "RAWAJ_WORKER_BASE_URL: " + PROTECTED_API_ORIGIN,
    "RAWAJ_WORKER_BASE_URL: " + LEGACY_API_ORIGIN,
  );
  sources.renderConfigSource += "\nRefusing production render: the Syria Worker must remain\n";
  const result = validateCloudflareEdgeCutover(sources);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("render")));
});

test("protected endpoint with old smoke URL or freeze is rejected", async () => {
  const sources = protectSources(await currentSources());
  sources.productionWorkflowSource = sources.productionWorkflowSource.replace(
    PROTECTED_API_ORIGIN, LEGACY_API_ORIGIN,
  );
  sources.renderConfigSource += "\nRefusing production render: the Syria Worker must remain\n";
  const result = validateCloudflareEdgeCutover(sources);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("smoke")));
  assert.ok(result.errors.some((error) => error.includes("render")));
});

test("automatic deploy or unexpected origin cannot pass the cutover contract", async () => {
  const sources = await currentSources();
  sources.vercelConfig.git.deploymentEnabled = true;
  sources.environmentSource = "VITE_PUBLIC_DATA_API_BASE_URL=https://unknown.example";
  const result = validateCloudflareEdgeCutover(sources);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Unexpected")));
  assert.ok(result.errors.some((error) => error.includes("Automatic")));
});
