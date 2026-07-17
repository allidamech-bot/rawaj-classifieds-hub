import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/release-candidate.yml", import.meta.url),
  "utf8",
);

test("release candidate evidence reuses one canonical issue", () => {
  assert.match(workflow, /title="RAWAJ Release Candidate Status"/);
  assert.match(workflow, /gh issue list/);
  assert.match(workflow, /select\(\.title == \\"RAWAJ Release Candidate Status\\"\)/);
  assert.match(workflow, /gh issue edit/);
  assert.match(workflow, /if \[ -n "\$issue_number" \]/);
});

test("release evidence does not create commit-specific issue titles", () => {
  assert.doesNotMatch(workflow, /RAWAJ RC \$\{short_sha\}/);
  assert.doesNotMatch(workflow, /title="RAWAJ RC/);
  assert.match(workflow, /Historical evidence remains in GitHub Actions runs and artifacts/);
});

test("release workflow keeps read-only repository and issue-write boundaries", () => {
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /issues: write/);
  assert.doesNotMatch(workflow, /contents: write|git push|service[_-]?role/i);
});
