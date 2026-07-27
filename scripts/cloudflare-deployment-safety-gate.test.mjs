import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const workflowsDirectory = new URL("../.github/workflows/", import.meta.url);
const workflowNames = (await readdir(workflowsDirectory)).filter((name) => /\.ya?ml$/i.test(name));
const workflows = await Promise.all(
  workflowNames.map(async (name) => ({
    name,
    source: await readFile(new URL(name, workflowsDirectory), "utf8"),
  })),
);
const productionWorkflow = workflows.find(
  ({ name }) => name === "cloudflare-production-worker-deploy.yml",
);
const workerPackage = JSON.parse(
  await readFile(new URL("cloudflare/worker/package.json", root), "utf8"),
);
const approvalGuard = await readFile(
  new URL("cloudflare/worker/scripts/require-production-approval.mjs", root),
  "utf8",
);
const healthSource = await readFile(new URL("cloudflare/worker/src/index.ts", root), "utf8");
const renderConfig = await readFile(
  new URL("cloudflare/worker/scripts/render-config.mjs", root),
  "utf8",
);
const smokeSource = await readFile(
  new URL("cloudflare/worker/scripts/remote-smoke.mjs", root),
  "utf8",
);

const productionMutationPattern =
  /\bwrangler(?:\.cmd)?\s+(?:deploy|versions\s+deploy|rollback|d1\s+migrations\s+apply\b[^\n]*--remote)/i;

test("push and pull-request workflows cannot mutate Cloudflare Production", () => {
  for (const workflow of workflows) {
    const automaticTrigger = /^\s{2}(?:pull_request|push):/m.test(workflow.source);
    if (!automaticTrigger) continue;
    assert.doesNotMatch(
      workflow.source,
      productionMutationPattern,
      `${workflow.name} must remain read-only`,
    );
    assert.doesNotMatch(
      workflow.source,
      /npm[^\n]*run\s+(?:deploy:production|migrate:production)/i,
      `${workflow.name} must not invoke Production package scripts`,
    );
  }
});

test("the only Worker deployment workflow is manual and SHA-gated", () => {
  assert.ok(productionWorkflow, "The manual Production Worker workflow must exist");
  const source = productionWorkflow.source;
  assert.match(source, /^\s{2}workflow_dispatch:/m);
  assert.doesNotMatch(source, /^\s{2}(?:pull_request|push):/m);
  assert.match(source, /DEPLOY_RAWAJ_WORKER_PRODUCTION/);
  assert.match(source, /expected_commit_sha/);
  assert.match(source, /EXPECTED_COMMIT_SHA.*DISPATCH_SHA/s);
  assert.match(source, /git rev-parse HEAD/);
  assert.match(source, /npm --prefix cloudflare\/worker run deploy:production/);
  assert.equal(source.match(/npm --prefix cloudflare\/worker run deploy:production/g)?.length, 1);
  assert.doesNotMatch(source, /migrate:production|d1\s+migrations\s+apply/i);
  assert.doesNotMatch(source, /\bwrangler(?:\.cmd)?\s+(?:rollback|versions\s+deploy)/i);
  assert.match(source, /No automatic rollback was attempted/);

  const deploymentWorkflows = workflows.filter(({ source }) =>
    productionMutationPattern.test(source),
  );
  assert.deepEqual(
    deploymentWorkflows.map(({ name }) => name),
    [],
    "Workflows must deploy only through the guarded package script",
  );
});

test("Production package scripts fail closed outside the approved dispatch", () => {
  assert.match(
    workerPackage.scripts["deploy:production"],
    /require-production-approval\.mjs deploy/,
  );
  assert.match(
    workerPackage.scripts["migrate:production"],
    /require-production-approval\.mjs migrate/,
  );
  assert.match(approvalGuard, /GITHUB_ACTIONS/);
  assert.match(approvalGuard, /GITHUB_EVENT_NAME/);
  assert.match(approvalGuard, /workflow_dispatch/);
  assert.match(approvalGuard, /RAWAJ_EXPECTED_COMMIT_SHA/);
  assert.match(approvalGuard, /expectedCommitSha !== githubSha/);
  assert.match(approvalGuard, /action !== "deploy"/);
});

test("health and post-deploy smoke expose and verify release identity safely", () => {
  assert.match(healthSource, /RAWAJ_WORKER_RELEASE_SHA\?: string/);
  assert.match(healthSource, /RAWAJ_WORKER_ENVIRONMENT\?: string/);
  assert.match(healthSource, /releaseSha: env\.RAWAJ_WORKER_RELEASE_SHA/);
  assert.match(healthSource, /environment: env\.RAWAJ_WORKER_ENVIRONMENT/);
  assert.match(renderConfig, /RAWAJ_WORKER_RELEASE_SHA/);
  assert.match(renderConfig, /RAWAJ_WORKER_ENVIRONMENT/);
  assert.match(renderConfig, /\^\[0-9a-f\]\{40\}\$/);

  for (const required of [
    "https://rawa-j.com",
    "https://www.rawa-j.com",
    "/v1/references",
    "/v1/listings",
    "/v1/ad-placements",
    "/api/profile",
    "RAWAJ_WORKER_EXPECTED_RELEASE_SHA",
  ]) {
    assert.match(smokeSource, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(smokeSource, /\bwrangler\b/i);
});
