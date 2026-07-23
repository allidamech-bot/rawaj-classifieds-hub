import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const bootstrap = read("cloudflare/migration/bootstrap-cloudflare-resources.mjs");
const verifier = read("cloudflare/migration/verify-remote-d1.mjs");
const workflow = read(".github/workflows/cloudflare-public-read-model-import.yml");

test("resource bootstrap is idempotent and contains no destructive Cloudflare calls", () => {
  assert.match(bootstrap, /\/user\/tokens\/verify/);
  assert.match(bootstrap, /\/d1\/database/);
  assert.match(bootstrap, /\/r2\/buckets/);
  assert.match(bootstrap, /matchingDatabases/);
  assert.match(bootstrap, /getR2Bucket/);
  assert.match(bootstrap, /destructiveOperations:\s*false/);
  assert.doesNotMatch(bootstrap, /method:\s*"DELETE"|method:\s*"PATCH"/);
  assert.doesNotMatch(bootstrap, /apiToken[\s\S]{0,100}manifest/);
});

test("remote verifier requires exact counts, referential integrity, and ready media", () => {
  assert.match(verifier, /--expect-empty/);
  assert.match(verifier, /PRAGMA foreign_key_check/);
  assert.match(verifier, /media_assets WHERE status <> 'ready'/);
  assert.match(verifier, /orphan listing images/);
  assert.match(verifier, /orphan ad placements/);
  assert.match(verifier, /status = 'verified'/);
  assert.doesNotMatch(verifier, /DELETE FROM|DROP TABLE|TRUNCATE/i);
});

test("import workflow is manual, gated, blue-green, and never deploys traffic", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+push:|\n\s+pull_request:/);
  assert.match(workflow, /CREATE_STAGING_RESOURCES/);
  assert.match(workflow, /IMPORT_STAGING_READ_MODEL/);
  assert.match(workflow, /database_name="\$\{database_name\}-\$\{GITHUB_RUN_ID\}"/);
  assert.match(workflow, /cancel-in-progress:\s*false/);
  assert.match(workflow, /d1 migrations apply DB --remote/);
  assert.match(workflow, /d1 execute DB/);
  assert.match(workflow, /--expect-empty/);
  assert.match(workflow, /--finalize/);
  assert.match(workflow, /for attempt in 1 2 3/);
  assert.doesNotMatch(workflow, /wrangler deploy|versions deploy|workers_dev:\s*true|rawa-j\.com/);
});

test("workflow evidence excludes snapshot SQL, media source manifest, and secrets", () => {
  const evidenceBlock = workflow.slice(workflow.indexOf("Upload non-sensitive verification evidence"));
  assert.doesNotMatch(evidenceBlock, /public-snapshot\.sql|media-manifest\.json|media-finalize\.sql/);
  assert.doesNotMatch(evidenceBlock, /SUPABASE_SERVICE_ROLE_KEY|R2_SECRET_ACCESS_KEY|CLOUDFLARE_API_TOKEN/);
  assert.match(evidenceBlock, /snapshot-manifest\.json/);
  assert.match(evidenceBlock, /remote-d1-verification\.json/);
});
