#!/usr/bin/env node
// Read-only contract that rejects partial Cloudflare edge endpoint migrations.
// It does not perform DNS operations, deploy a Worker, or contact production.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const LEGACY_API_ORIGIN = "https://rawaj-classifieds-hub.allidamech.workers.dev";
export const PROTECTED_API_ORIGIN = "https://api.rawa-j.com";

function envValue(source, key) {
  const line = source.split(/\r?\n/).find((entry) => entry.startsWith(key + "="));
  return line ? line.slice(key.length + 1).trim() : null;
}

function normalizeOrigin(value) {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash
    )
      return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function validateCloudflareEdgeCutover({
  environmentSource,
  vercelConfig,
  workerConfig,
  renderConfigSource,
  productionWorkflowSource,
}) {
  const errors = [];
  const currentOrigin = normalizeOrigin(
    envValue(environmentSource, "VITE_PUBLIC_DATA_API_BASE_URL"),
  );
  const routes = Array.isArray(workerConfig.routes) ? workerConfig.routes : [];
  const hasProtectedRoute =
    routes.length === 1 &&
    routes[0]?.pattern === "api.rawa-j.com" &&
    routes[0]?.custom_domain === true;
  const isFrozen = renderConfigSource.includes(
    "Refusing production render: the Syria Worker must remain",
  );

  let mode = "invalid";
  if (currentOrigin === LEGACY_API_ORIGIN) {
    mode = hasProtectedRoute ? "staging" : "legacy";
  } else if (currentOrigin === PROTECTED_API_ORIGIN) {
    mode = workerConfig.workers_dev === false ? "protected" : "cutover";
  }

  const check = (pass, message) => {
    if (!pass) errors.push(message);
  };
  check(mode !== "invalid", "Unexpected production API origin");
  check(
    vercelConfig.git?.deploymentEnabled === false,
    "Automatic Vercel Git deployments must stay disabled",
  );
  check(workerConfig.preview_urls === false, "Worker preview URLs must stay disabled");
  check(workerConfig.name === "rawaj-classifieds-hub", "The Syria Worker identity changed");

  const rewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : [];
  check(rewrites.length === 2, "Vercel must expose exactly /v1 and /api rewrites");
  for (const source of ["/v1/:path*", "/api/:path*"]) {
    const matches = rewrites.filter((route) => route.source === source);
    check(matches.length === 1, "Missing or duplicated rewrite: " + source);
    if (matches.length === 1 && currentOrigin) {
      check(
        matches[0].destination === currentOrigin + source,
        "API base and Vercel rewrite disagree: " + source,
      );
    }
  }

  const legacyReleaseCheck = productionWorkflowSource.includes(
    "RAWAJ_WORKER_BASE_URL: " + LEGACY_API_ORIGIN,
  );
  const protectedReleaseCheck = productionWorkflowSource.includes(
    "RAWAJ_WORKER_BASE_URL: " + PROTECTED_API_ORIGIN,
  );

  if (mode === "legacy") {
    check(workerConfig.workers_dev === true, "Legacy routing requires workers_dev=true");
    check(routes.length === 0, "Legacy mode cannot unexpectedly enable a custom-domain route");
    check(isFrozen, "Legacy production render freeze was removed prematurely");
    check(legacyReleaseCheck, "Legacy production smoke endpoint must remain pinned");
  }

  if (mode === "staging" || mode === "cutover" || mode === "protected") {
    check(hasProtectedRoute, "Protected routing requires api.rawa-j.com custom domain");
    check(!isFrozen, "Custom-domain render configuration must be explicitly reviewed");

    if (mode === "staging") {
      check(workerConfig.workers_dev === true, "Staging must keep workers.dev operational");
      check(legacyReleaseCheck, "Staging release smoke must still verify the old live route");
    } else {
      check(
        protectedReleaseCheck && !legacyReleaseCheck,
        "Production release smoke must use protected domain",
      );
      if (mode === "cutover") {
        check(workerConfig.workers_dev === true, "Temporary handoff must preserve the old route");
      } else {
        check(workerConfig.workers_dev === false, "Final routing requires workers_dev=false");
      }
    }
  }

  check(
    productionWorkflowSource.includes("workflow_dispatch:") &&
      productionWorkflowSource.includes("environment: syria-production"),
    "Worker deploy must remain a manual, protected Syria workflow",
  );

  return { mode, currentOrigin, valid: errors.length === 0, errors };
}

export async function inspectRepositoryEdgeCutover() {
  const root = new URL("../", import.meta.url);
  const [
    environmentSource,
    vercelConfig,
    workerConfig,
    renderConfigSource,
    productionWorkflowSource,
  ] = await Promise.all([
    readFile(new URL(".env.production", root), "utf8"),
    readFile(new URL("vercel.json", root), "utf8").then(JSON.parse),
    readFile(new URL("cloudflare/worker/wrangler.base.jsonc", root), "utf8").then(JSON.parse),
    readFile(new URL("cloudflare/worker/scripts/render-config.mjs", root), "utf8"),
    readFile(new URL(".github/workflows/cloudflare-production-worker-deploy.yml", root), "utf8"),
  ]);
  return validateCloudflareEdgeCutover({
    environmentSource,
    vercelConfig,
    workerConfig,
    renderConfigSource,
    productionWorkflowSource,
  });
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === fileURLToPath(new URL("file://" + process.argv[1]))
) {
  const report = await inspectRepositoryEdgeCutover();
  console.log(JSON.stringify(report, null, 2));
  assert.ok(report.valid, "Cloudflare edge cutover is partially configured; stop release");
}
