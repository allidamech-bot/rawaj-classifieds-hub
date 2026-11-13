import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const release = await readFile(new URL("../.github/workflows/release-candidate.yml", import.meta.url), "utf8");
const acceptance = await readFile(new URL("../e2e/production-acceptance.spec.ts", import.meta.url), "utf8");

test("manual release candidate requires a user-supplied exact commit SHA", () => {
  assert.match(release, /on:\s*\n  workflow_dispatch:\s*\n    inputs:/);
  assert.match(
    release,
    /expected_commit_sha:\n\s+description:.*\n\s+required: true\n\s+type: string/,
  );
  assert.match(release, /if \[\[ ! "\$EXPECTED_COMMIT_SHA" =~ \^\[0-9a-f\]\{40\}\$ \]\]; then/);
  assert.match(release, /test "\$actual" = "\$EXPECTED_COMMIT_SHA"/);
  assert.match(release, /ref: \$\{\{ inputs\.expected_commit_sha \}\}/);
  assert.doesNotMatch(release, /inputs\.expected_commit_sha \|\| github\.sha/);
});

test("production acceptance is opt-in and verifies the deployed commit", () => {
  assert.match(
    release,
    /run_production_acceptance:\n\s+description:.*\n\s+required: false\n\s+type: boolean\n\s+default: false/,
  );
  assert.match(release, /if: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.run_production_acceptance \}\}/);
  assert.match(acceptance, /deployedCommit\)\.toBe\(expectedCommitSha\)/);
  assert.match(release, /PRODUCTION_ACCEPTANCE: "1"/);
});

test("candidate certification never performs application production deployment", () => {
  assert.doesNotMatch(release, /^\s{2}(push|pull_request|schedule):/m);
  assert.doesNotMatch(release, /\bwrangler deploy\b|\bvercel deploy\b|\bgradlew publish\b/i);
  assert.match(release, /npm run performance:budget/);
  assert.match(release, /npm run test:release:browsers/);
  assert.match(release, /assembleDebug/);
  assert.match(release, /release-candidate-manifest\.json/);
});
