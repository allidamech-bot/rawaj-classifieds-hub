import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const guardUrl = new URL(
  "../cloudflare/worker/scripts/require-production-approval.mjs",
  import.meta.url,
);

const guardPath = fileURLToPath(guardUrl);
const guard = await readFile(guardUrl, "utf8");

test("local Syria production operations are explicit and git-gated", () => {
  assert.match(guard, /RAWAJ_LOCAL_PRODUCTION_DEPLOY/);
  assert.match(guard, /RAWAJ_LOCAL_PRODUCTION_MIGRATE/);
  assert.match(guard, /DEPLOY_RAWAJ_SYRIA_PRODUCTION/);
  assert.match(guard, /git\("rev-parse", "HEAD"\)/);
  assert.match(guard, /git\("rev-parse", "origin\/main"\)/);
  assert.match(guard, /git\("status", "--porcelain"\)/);
  assert.match(guard, /headSha !== expectedCommitSha/);
  assert.match(guard, /originMainSha !== expectedCommitSha/);
  assert.match(guard, /if \(status\)/);
});

test("existing workflow_dispatch approval remains supported", () => {
  assert.match(guard, /DEPLOY_RAWAJ_SYRIA_WORKER_PRODUCTION/);
  assert.match(guard, /GITHUB_EVENT_NAME === "workflow_dispatch"/);
});

test("guard fails closed without explicit local opt-in", () => {
  const env = { ...process.env };

  delete env.GITHUB_ACTIONS;
  delete env.GITHUB_EVENT_NAME;
  delete env.GITHUB_SHA;
  delete env.RAWAJ_LOCAL_PRODUCTION_DEPLOY;
  delete env.RAWAJ_LOCAL_PRODUCTION_MIGRATE;
  delete env.RAWAJ_PRODUCTION_APPROVAL;
  delete env.RAWAJ_EXPECTED_COMMIT_SHA;

  const result = spawnSync(process.execPath, [guardPath, "deploy"], {
    env,
    encoding: "utf8",
    windowsHide: true,
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Blocked deploy/);
});

test("local deploy cannot target an arbitrary SHA", () => {
  const env = {
    ...process.env,
    GITHUB_ACTIONS: "false",
    RAWAJ_LOCAL_PRODUCTION_DEPLOY: "true",
    RAWAJ_PRODUCTION_APPROVAL: "DEPLOY_RAWAJ_SYRIA_PRODUCTION",
    RAWAJ_EXPECTED_COMMIT_SHA: "0000000000000000000000000000000000000000",
  };

  delete env.GITHUB_EVENT_NAME;
  delete env.GITHUB_SHA;

  const result = spawnSync(process.execPath, [guardPath, "deploy"], {
    env,
    encoding: "utf8",
    windowsHide: true,
  });

  assert.notEqual(result.status, 0);

  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /HEAD does not match|expected commit must exactly match origin\/main|Git verification failed/,
  );
});
