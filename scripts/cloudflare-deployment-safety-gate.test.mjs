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
const entrySource = await readFile(new URL("cloudflare/worker/src/entry.ts", root), "utf8");
const renderConfig = await readFile(
  new URL("cloudflare/worker/scripts/render-config.mjs", root),
  "utf8",
);
const smokeSource = await readFile(
  new URL("cloudflare/worker/scripts/remote-smoke.mjs", root),
  "utf8",
);
const productionFreeze = await readFile(
  new URL("docs/cloudflare-production-freeze.md", root),
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

test("the only Worker deployment workflow is manual, SHA-gated, and permanently credentialed", () => {
  assert.ok(productionWorkflow, "The manual Production Worker workflow must exist");
  const source = productionWorkflow.source;
  assert.match(source, /^\s{2}workflow_dispatch:/m);
  assert.doesNotMatch(source, /^\s{2}(?:pull_request|push):/m);
  const triggerBlock = source.match(/^on:\s*\n(?<body>[\s\S]*?)^\S/m)?.groups?.body;
  assert.ok(triggerBlock, "The workflow trigger block must be readable");
  const declaredTriggers = [...triggerBlock.matchAll(/^\s{2}([a-zA-Z_][\w-]*):(?:\s|$)/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(declaredTriggers, ["workflow_dispatch"]);
  assert.match(source, /environment: production/);
  assert.match(
    source,
    /CLOUDFLARE_API_TOKEN:\s*\$\{\{ secrets\.CLOUDFLARE_PRODUCTION_API_TOKEN \}\}/,
  );
  assert.doesNotMatch(
    source,
    /CLOUDFLARE_API_TOKEN:\s*\$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/,
  );
  assert.match(source, /Verify dedicated Production credential/);
  assert.match(source, /workers\/services\/rawaj-classifieds-hub/);
  assert.match(source, /CLOUDFLARE_PRODUCTION_API_TOKEN is missing/);
  assert.match(source, /d0e6496c-9f63-48d3-beeb-d2e219500f6a/);
  assert.match(source, /CLOUDFLARE_D1_DATABASE_NAME: rawaj-staging/);
  assert.match(source, /CLOUDFLARE_R2_BUCKET_NAME: rawaj-listing-images-production/);
  assert.match(source, /CLOUDFLARE_WORKER_CUSTOM_DOMAIN: api\.rawa-j\.com/);
  assert.match(source, /DEPLOY_RAWAJ_WORKER_PRODUCTION/);
  assert.match(source, /expected_commit_sha/);
  assert.match(source, /DISPATCH_REF: \$\{\{ github\.ref \}\}/);
  assert.match(source, /\[\[ "\$DISPATCH_REF" != "refs\/heads\/main" \]\]/);
  assert.match(source, /tags and other branches are rejected/);
  assert.match(source, /ref: \$\{\{ inputs\.expected_commit_sha \}\}/);
  assert.match(source, /git rev-parse HEAD/);
  assert.match(source, /git fetch --no-tags origin refs\/heads\/main:refs\/remotes\/origin\/main/);
  assert.match(source, /MAIN_HEAD_SHA="\$\(git rev-parse refs\/remotes\/origin\/main\)"/);
  assert.match(source, /\[\[ "\$EXPECTED_COMMIT_SHA" != "\$MAIN_HEAD_SHA" \]\]/);
  assert.match(source, /stale or non-main commits cannot be deployed/);
  assert.match(source, /docs\/cloudflare-production-freeze\.md/);
  assert.doesNotMatch(source, /DISPATCH_SHA:\s*\$\{\{\s*github\.sha\s*\}\}/);
  assert.doesNotMatch(source, /\$EXPECTED_COMMIT_SHA"\s*!=\s*"\$(?:DISPATCH_SHA|GITHUB_SHA)/);
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

test("the Cloudflare Production freeze is documented as one path", () => {
  assert.match(productionFreeze, /one path only/i);
  assert.match(productionFreeze, /CLOUDFLARE_PRODUCTION_API_TOKEN/);
  assert.match(productionFreeze, /https:\/\/api\.rawa-j\.com/);
  assert.match(productionFreeze, /No automatic Worker deployment/);
  assert.match(productionFreeze, /No fallback to the legacy generic/);
  assert.match(productionFreeze, /No temporary one-shot deployment workflows/);
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
  assert.match(entrySource, /const requestId = crypto\.randomUUID\(\)/);
  assert.match(entrySource, /request\.method === "OPTIONS"[\s\S]*responseHeaders\(cors, requestId\)/);
  assert.match(entrySource, /headers\.set\("X-Content-Type-Options", "nosniff"\)/);
  assert.match(entrySource, /headers\.set\("Referrer-Policy", "no-referrer"\)/);
  assert.match(smokeSource, /requestIdPattern/);
  assert.match(smokeSource, /requestIdValid/);
  assert.match(smokeSource, /securityHeadersValid/);
  assert.match(smokeSource, /contentTypeOptions === "nosniff"/);
  assert.match(smokeSource, /referrerPolicy === "no-referrer"/);
  assert.doesNotMatch(smokeSource, /\bwrangler\b/i);
});
