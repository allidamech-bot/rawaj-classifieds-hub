import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const workerDeploy = read(".github/workflows/cloudflare-production-worker-deploy.yml");
const vercelConfig = JSON.parse(read("vercel.json"));

function assertManualMainOnly(workflow) {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:/);
  assert.doesNotMatch(workflow, /\n\s+pull_request:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /expected_commit_sha/);
}

test("Syria Worker production deploy is manual and protected", () => {
  assertManualMainOnly(workerDeploy);
  assert.match(workerDeploy, /environment: syria-production/);
  assert.match(workerDeploy, /DEPLOY_RAWAJ_SYRIA_PRODUCTION/);
  assert.match(workerDeploy, /CLOUDFLARE_PRODUCTION_API_TOKEN/);
  assert.match(workerDeploy, /SYRIA_FIREBASE_PROJECT_ID/);
  assert.match(workerDeploy, /rawaj-classifieds-hub\.allidamech\.workers\.dev/);
});

test("Syria Worker deploy uses protected resource variables rather than committed IDs", () => {
  for (const variable of [
    "CLOUDFLARE_D1_DATABASE_ID",
    "CLOUDFLARE_D1_DATABASE_NAME",
    "CLOUDFLARE_R2_BUCKET_NAME",
    "SYRIA_FIREBASE_PROJECT_ID",
  ]) {
    assert.match(workerDeploy, new RegExp(`\\$\\{\\{ vars\\.${variable} \\}\\}`));
  }
  assert.doesNotMatch(workerDeploy, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  assert.doesNotMatch(workerDeploy, /rawaj-staging/);
  assert.doesNotMatch(workerDeploy, /rawaj-saudi/);
});

test("Syria Vercel Git auto-deployment remains disabled", () => {
  assert.equal(vercelConfig.git?.deploymentEnabled, false);
});
