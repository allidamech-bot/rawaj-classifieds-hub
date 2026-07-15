import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workflow, worker, migration, packageJson, qualityGate] = await Promise.all([
  readFile(new URL("../.github/workflows/push-delivery-scheduler.yml", import.meta.url), "utf8"),
  readFile(
    new URL("../supabase/functions/send-push-notifications/index.ts", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../supabase/migrations/202607150002_saved_search_alerts_push_v1.sql", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("push delivery worker is scheduled and can be run manually", () => {
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /group: rawaj-push-delivery-scheduler/);
  assert.match(workflow, /timeout-minutes: 5/);
});

test("scheduler skips safely until its dedicated secret is configured", () => {
  assert.match(workflow, /PUSH_CRON_SECRET: \$\{\{ secrets\.PUSH_CRON_SECRET \}\}/);
  assert.match(workflow, /if \[ -z "\$PUSH_CRON_SECRET" \]/);
  assert.match(workflow, /enabled=false/);
  assert.match(workflow, /skipped safely/);
  assert.doesNotMatch(workflow, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(workflow, /FIREBASE_PRIVATE_KEY/);
});

test("scheduler calls only the protected deployed worker with bounded retries", () => {
  assert.match(
    workflow,
    /https:\/\/dpymopdckflnpmowhlyq\.supabase\.co\/functions\/v1\/send-push-notifications/,
  );
  assert.match(workflow, /--header "x-cron-secret: \$\{PUSH_CRON_SECRET\}"/);
  assert.match(workflow, /--header "x-rawaj-scheduler: github-actions-v1"/);
  assert.match(workflow, /--retry 2/);
  assert.match(workflow, /--retry-all-errors/);
  assert.match(workflow, /--connect-timeout 15/);
  assert.match(workflow, /--max-time 120/);
});

test("scheduler validates the worker response and emits a sanitized operational summary", () => {
  assert.match(workflow, /payload\?\.ok !== true/);
  assert.match(workflow, /status < 200 \|\| status >= 300/);
  assert.match(workflow, /checkedUsers/);
  assert.match(workflow, /createdNotifications/);
  assert.match(workflow, /disabledDevices/);
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.doesNotMatch(workflow, /console\.log\([^\n]*PUSH_CRON_SECRET/);
});

test("the protected worker flushes due saved searches before claiming push deliveries", () => {
  const flushIndex = worker.indexOf('client.rpc("rawaj_flush_due_saved_search_alerts_v2"');
  const claimIndex = worker.indexOf('client.rpc("rawaj_claim_push_deliveries_v1"');
  assert.ok(flushIndex >= 0);
  assert.ok(claimIndex > flushIndex);
  assert.match(worker, /x-cron-secret/);
  assert.match(worker, /timingSafeEqual/);
});

test("database worker RPCs remain restricted to the service role", () => {
  const flushStart = migration.indexOf(
    "create or replace function public.rawaj_flush_due_saved_search_alerts_v2",
  );
  const claimStart = migration.indexOf(
    "create or replace function public.rawaj_claim_push_deliveries_v1",
  );
  assert.ok(flushStart >= 0);
  assert.ok(claimStart > flushStart);
  assert.match(migration.slice(flushStart, claimStart), /auth\.role\(\).*service_role/s);
  assert.match(migration.slice(claimStart), /auth\.role\(\).*service_role/s);
});

test("push scheduler contract remains part of the Quality Gate", () => {
  assert.match(packageJson, /"test:push-scheduler"/);
  assert.match(packageJson, /npm run test:push-scheduler/);
  assert.match(qualityGate, /Push Delivery Scheduler V1 contract/);
  assert.match(qualityGate, /npm run test:push-scheduler/);
});
