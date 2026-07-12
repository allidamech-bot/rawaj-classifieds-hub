import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workflow, spec, packageSource, qualityGate] = await Promise.all([
  readFile(new URL("../.github/workflows/production-acceptance.yml", import.meta.url), "utf8"),
  readFile(new URL("../e2e/production-acceptance.spec.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("production acceptance is manual-only and uses dedicated secrets", () => {
  assert.match(workflow, /on:\s*\n\s*workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s{2}push:/);
  assert.doesNotMatch(workflow, /\n\s{2}pull_request:/);
  assert.match(workflow, /secrets\.RAWAJ_ACCEPTANCE_EMAIL/);
  assert.match(workflow, /secrets\.RAWAJ_ACCEPTANCE_PASSWORD/);
  assert.match(workflow, /Validate dedicated acceptance credentials/);
  assert.match(workflow, /E2E_BASE_URL:\s*https:\/\/rawa-j\.com/);
  assert.match(workflow, /EXPECTED_COMMIT_SHA/);
  assert.match(workflow, /production-acceptance\.spec\.ts/);
  assert.match(workflow, /--project=mobile-chromium --workers=1/);
});

test("authenticated production acceptance remains read-only", () => {
  for (const path of [
    "/profile",
    "/profile/listings",
    "/add-listing",
    "/favorites",
    "/saved-searches",
    "/chats",
    "/notifications",
    "/promotion",
  ]) {
    assert.ok(spec.includes(`"${path}"`), `Missing authenticated acceptance route ${path}`);
  }

  assert.match(spec, /input\[type=\\?"email\\?"\]/);
  assert.match(spec, /autocomplete=\\?"current-password\\?"/);
  assert.match(spec, /rawaj-build-commit/);
  assert.match(spec, /page\.on\("pageerror"/);
  assert.match(spec, /page\.on\("console"/);
  assert.match(spec, /page\.on\("requestfailed"/);

  for (const mutationMarker of [
    "request.post(",
    "request.put(",
    "request.patch(",
    "request.delete(",
    "input[type=\"file\"]",
    "createOwnerDraftListing",
    "submitOwnerListingForReview",
    "إرسال للمراجعة",
    "Submit for review",
  ]) {
    assert.ok(!spec.includes(mutationMarker), `Production acceptance must remain read-only: ${mutationMarker}`);
  }
});

test("quality gate permanently enforces the production acceptance contract", () => {
  assert.match(packageSource, /"test:production-acceptance-contract"/);
  assert.match(packageSource, /production-acceptance-contract\.test\.mjs/);
  assert.match(qualityGate, /Production acceptance safety contract/);
  assert.match(qualityGate, /npm run test:production-acceptance-contract/);
});
