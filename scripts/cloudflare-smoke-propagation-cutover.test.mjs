import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const smokeSource = await readFile(
  new URL("../cloudflare/worker/scripts/remote-smoke.mjs", import.meta.url),
  "utf8",
);

test("post-deploy health verification bypasses stale cache with bounded retries", () => {
  assert.match(smokeSource, /const RELEASE_VERIFY_ATTEMPTS = 18/);
  assert.match(smokeSource, /const RELEASE_VERIFY_DELAY_MS = 5_000/);
  assert.match(smokeSource, /attempt <= attempts/);
  assert.match(smokeSource, /release_probe/);
  assert.match(smokeSource, /crypto\.randomUUID\(\)/);
  assert.match(smokeSource, /"Cache-Control": "no-cache"/);
  assert.match(smokeSource, /await sleep\(RELEASE_VERIFY_DELAY_MS\)/);
  assert.match(smokeSource, /check\.verifyRelease \? RELEASE_VERIFY_ATTEMPTS : 1/);
  assert.match(smokeSource, /actualReleaseSha/);
  assert.match(smokeSource, /expectedReleaseSha/);
});

test("retrying the read-only smoke never triggers another deployment or rollback", () => {
  assert.match(smokeSource, /No second deployment will be attempted/);
  assert.match(smokeSource, /this script never performs rollback/);
  assert.doesNotMatch(smokeSource, /\bwrangler\b/i);
  assert.doesNotMatch(smokeSource, /deploy:production|migrate:production|versions\s+deploy/i);
  assert.doesNotMatch(smokeSource, /fetch\([^\n]*(?:workers\/scripts|deployments|versions)/i);
});
