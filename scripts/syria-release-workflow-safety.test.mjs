import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const workerDeploy = read(".github/workflows/cloudflare-production-worker-deploy.yml");
const reconciliation = read(".github/workflows/syria-cloudflare-reconcile-production.yml");
const encryptedBackup = read(".github/workflows/syria-cloudflare-backup-production.yml");
const vercelPreview = read(".github/workflows/syria-vercel-preview.yml");
const reconciliationSql = read("cloudflare/d1/reconciliation/syria-production-audit.sql");
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
  assert.doesNotMatch(
    workerDeploy,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  );
  assert.doesNotMatch(workerDeploy, /rawaj-staging/);
  assert.doesNotMatch(workerDeploy, /rawaj-saudi/);
});

test("Syria reconciliation is manual and aggregate read-only", () => {
  assertManualMainOnly(reconciliation);
  assert.match(reconciliation, /environment: syria-production/);
  assert.match(reconciliation, /AUDIT_RAWAJ_SYRIA_PRODUCTION/);
  assert.match(reconciliation, /syria-production-audit\.sql/);
  assert.match(reconciliation, /syria-provider-preflight\.mjs/);
  assert.doesNotMatch(reconciliation, /wrangler deploy|d1 migrations apply/);
  assert.doesNotMatch(reconciliationSql, /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE)\b/i);
  assert.doesNotMatch(
    reconciliationSql,
    /\b(?:email|phone|whatsapp|display_name|first_name|last_name)\b\s*(?:,|AS)/i,
  );
  assert.match(reconciliationSql, /PRAGMA foreign_key_check/);
});

test("Syria D1 backup is manual, encrypted, and removes plaintext", () => {
  assertManualMainOnly(encryptedBackup);
  assert.match(encryptedBackup, /environment: syria-production/);
  assert.match(encryptedBackup, /BACKUP_RAWAJ_SYRIA_PRODUCTION/);
  assert.match(encryptedBackup, /wrangler d1 export/);
  assert.match(encryptedBackup, /openssl enc -aes-256-cbc -pbkdf2 -salt/);
  assert.match(encryptedBackup, /BACKUP_ENCRYPTION_PASSPHRASE/);
  assert.match(
    encryptedBackup,
    /plain="\$output_directory\/rawaj-syria-production-\$\{GITHUB_SHA\}\.sql"/,
  );
  assert.match(encryptedBackup, /encrypted="\$\{plain\}\.enc"/);
  assert.match(encryptedBackup, /rm -f "\$plain"/);
  assert.match(encryptedBackup, /test ! -e "\$plain"/);
  assert.doesNotMatch(encryptedBackup, /wrangler deploy|d1 migrations apply/);
});

test("Syria Vercel workflow creates preview only", () => {
  assertManualMainOnly(vercelPreview);
  assert.match(vercelPreview, /environment: syria-preview/);
  assert.match(vercelPreview, /DEPLOY_RAWAJ_SYRIA_PREVIEW/);
  assert.match(vercelPreview, /vercel@54\.18\.1 deploy --prebuilt/);
  assert.match(vercelPreview, /syria-provider-preflight\.mjs/);
  assert.doesNotMatch(vercelPreview, /--prod\b|--target=production|environment=production/);
  assert.match(vercelPreview, /Production domain was not attached/);
});

test("Syria Vercel Git auto-deployment remains disabled", () => {
  assert.equal(vercelConfig.git?.deploymentEnabled, false);
});
