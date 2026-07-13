import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [pendingRoute, resilientImage, packageSource, acceptanceWorkflow] = await Promise.all([
  readFile(new URL("../src/routes/admin.pending.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/media/ResilientImage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/production-acceptance.yml", import.meta.url), "utf8"),
]);

test("phase 51 keeps production acceptance tied to an explicit deployed commit", () => {
  assert.match(acceptanceWorkflow, /EXPECTED_COMMIT_SHA/);
  assert.match(acceptanceWorkflow, /E2E_BASE_URL:\s*https:\/\/rawa-j\.com/);
  assert.match(acceptanceWorkflow, /workflow_dispatch/);
});

test("phase 52 remains an explicit real-device external gate", () => {
  assert.match(packageSource, /"@capacitor\/android"/);
  assert.match(packageSource, /"@capacitor\/core"/);
});

test("phase 53 protects pending moderation media with the shared resilient renderer", () => {
  assert.match(pendingRoute, /ResilientImage/);
  assert.doesNotMatch(pendingRoute, /<img\b/);
  assert.match(resilientImage, /loading = "lazy"/);
  assert.match(resilientImage, /decoding = "async"/);
  assert.match(resilientImage, /draggable = false/);
  assert.match(resilientImage, /onError=/);
});
