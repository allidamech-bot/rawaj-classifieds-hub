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

test("the only Worker deployment workflow is manual Syria-only and SHA-gated", () => {
  assert.ok(productionWorkflow, "The manual Syria Production Worker workflow must exist");
  const source = productionWorkflow.source;
  assert.match(source, /^\s{2}workflow_dispatch:/m);
  assert.doesNotMatch(source, /^\s{2}(?:pull_request|push):/m);
  assert.match(source, /environment: syria-production/);
  assert.match(
    source,
    /CLOUDFLARE_API_TOKEN:\s*\$\{\{ secrets\.SYRIA_CLOUDFLARE_API_TOKEN \}\}/,
  );
  assert.match(
    source,
    /CLOUDFLARE_ACCOUNT_ID:\s*\$\{\{ secrets\.SYRIA_CLOUDFLARE_ACCOUNT_ID \}\}/,
  );
  assert.match(
    source,
    /SYRIA_CLOUDFLARE_CREDENTIAL_SCOPE:\s*\$\{\{ vars\.SYRIA_CLOUDFLARE_CREDENTIAL_SCOPE \}\}/,
  );
  assert.match(source, /SYRIA_CLOUDFLARE_CREDENTIAL_SCOPE must equal rawaj-classifieds-hub/);
  assert.doesNotMatch(source, /secrets\.SAUDI_CLOUDFLARE_/);
  assert.doesNotMatch(source, /secrets\.CLOUDFLARE_PRODUCTION_API_TOKEN/);
  assert.doesNotMatch(source, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(source, /workers\/services\/rawaj-classifieds-hub/);
  assert.match(source, /d0e6496c-9f63-48d3-beeb-d2e219500f6a/);
  assert.match(source, /CLOUDFLARE_D1_DATABASE_NAME: rawaj-staging/);
  assert.match(source, /CLOUDFLARE_R2_BUCKET_NAME: rawaj-listing-images-production/);
  assert.match(
    source,
    /RAWAJ_WORKER_BASE_URL: https:\/\/rawaj-classifieds-hub\.allidamech\.workers\.dev/,
  );
  assert.doesNotMatch(source, /CLOUDFLARE_WORKER_CUSTOM_DOMAIN/);
  assert.match(source, /DEPLOY_RAWAJ_SYRIA_WORKER_PRODUCTION/);
  assert.match(source, /expected_commit_sha/);
  assert.match(source, /reviewed_release_sha/);
  assert.match(source, /DISPATCH_REF: \$\{\{ github\.ref \}\}/);
  assert.match(source, /refs\/heads\/main/);
  assert.match(source, /ref: \$\{\{ inputs\.expected_commit_sha \}\}/);
  assert.match(source, /git rev-parse HEAD/);
  assert.match(source, /refs\/remotes\/origin\/main/);
  assert.match(source, /npm --prefix cloudflare\/worker run deploy:production/);
  assert.equal(source.match(/npm --prefix cloudflare\/worker run deploy:production/g)?.length, 1);
  assert.doesNotMatch(source, /migrate:production|d1\s+migrations\s+apply/i);
  assert.doesNotMatch(source, /\bwrangler(?:\.cmd)?\s+(?:rollback|versions\s+deploy)/i);
  assert.match(source, /No automatic rollback was attempted/);

  const deploymentWorkflows = workflows.filter(({ source: workflowSource }) =>
    productionMutationPattern.test(workflowSource),
  );
  assert.deepEqual(
    deploymentWorkflows.map(({ name }) => name),
    [],
    "Workflows must deploy only through the guarded package script",
  );
});

test("Syria production rendering pins every provider identity", () => {
  assert.match(renderConfig, /EXPECTED_PRODUCTION_D1_NAME = "rawaj-staging"/);
  assert.match(
    renderConfig,
    /EXPECTED_PRODUCTION_D1_ID = "d0e6496c-9f63-48d3-beeb-d2e219500f6a"/,
  );
  assert.match(renderConfig, /EXPECTED_PRODUCTION_R2_NAME = "rawaj-listing-images-production"/);
  assert.match(
    renderConfig,
    /EXPECTED_FIREBASE_PROJECT_ID = "project-af18fcaf-c46e-4ec5-93a"/,
  );
  assert.match(renderConfig, /d1DatabaseId !== EXPECTED_PRODUCTION_D1_ID/);
  assert.match(renderConfig, /d1DatabaseName !== EXPECTED_PRODUCTION_D1_NAME/);
  assert.match(renderConfig, /r2BucketName !== EXPECTED_PRODUCTION_R2_NAME/);
  assert.match(renderConfig, /firebaseProjectId !== EXPECTED_FIREBASE_PROJECT_ID/);
  assert.match(renderConfig, /if \(!local && customDomain\)/);
  assert.match(renderConfig, /rawaj-syria-local/);
  assert.match(renderConfig, /rawaj-syria-media-local/);
});

test("the Syria Cloudflare Production freeze documents one isolated workers.dev path", () => {
  assert.match(productionFreeze, /one path only/i);
  assert.match(productionFreeze, /syria-production/);
  assert.match(productionFreeze, /SYRIA_CLOUDFLARE_API_TOKEN/);
  assert.match(productionFreeze, /SYRIA_CLOUDFLARE_ACCOUNT_ID/);
  assert.match(productionFreeze, /SYRIA_CLOUDFLARE_CREDENTIAL_SCOPE=rawaj-classifieds-hub/);
  assert.match(productionFreeze, /D1: `rawaj-staging`/);
  assert.match(productionFreeze, /R2: `rawaj-listing-images-production`/);
  assert.match(productionFreeze, /Firebase project: `project-af18fcaf-c46e-4ec5-93a`/);
  assert.match(
    productionFreeze,
    /https:\/\/rawaj-classifieds-hub\.allidamech\.workers\.dev/,
  );
  assert.match(productionFreeze, /No automatic Worker deployment/);
  assert.match(productionFreeze, /No fallback to generic or Saudi Cloudflare secrets/);
  assert.match(productionFreeze, /No custom-domain, Zone, route, or DNS mutation/);
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
  assert.match(workerPackage.scripts["migrate:production"], /rawaj-staging/);
  assert.match(approvalGuard, /GITHUB_ACTIONS/);
  assert.match(approvalGuard, /GITHUB_EVENT_NAME/);
  assert.match(approvalGuard, /workflow_dispatch/);
  assert.match(approvalGuard, /RAWAJ_EXPECTED_COMMIT_SHA/);
  assert.match(approvalGuard, /expectedCommitSha !== githubSha/);
  assert.match(approvalGuard, /action !== "deploy"/);
});

test("health and post-deploy smoke verify only the Syria release identity", () => {
  assert.match(healthSource, /RAWAJ_WORKER_RELEASE_SHA\?: string/);
  assert.match(healthSource, /RAWAJ_WORKER_ENVIRONMENT\?: string/);
  assert.match(healthSource, /releaseSha: env\.RAWAJ_WORKER_RELEASE_SHA/);
  assert.match(healthSource, /environment: env\.RAWAJ_WORKER_ENVIRONMENT/);
  assert.match(renderConfig, /RAWAJ_WORKER_RELEASE_SHA/);
  assert.match(renderConfig, /RAWAJ_WORKER_ENVIRONMENT/);

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
  assert.doesNotMatch(smokeSource, /rawaj-saudi|https:\/\/sa\.rawa-j\.com/);
  assert.match(entrySource, /const requestId = crypto\.randomUUID\(\)/);
  assert.match(entrySource, /request\.method === "OPTIONS"[\s\S]*responseHeaders\(cors, requestId, request\)/);
  assert.match(entrySource, /headers\.set\("X-Content-Type-Options", "nosniff"\)/);
  assert.match(entrySource, /headers\.set\("Referrer-Policy", "no-referrer"\)/);
  assert.doesNotMatch(smokeSource, /\bwrangler\b/i);
});
