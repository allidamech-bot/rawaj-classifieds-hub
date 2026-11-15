import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const repositoryRoot = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, repositoryRoot), "utf8");

test("local browser workflows cannot proxy traffic to a production Worker", async () => {
  const workflowDir = new URL(".github/workflows/", repositoryRoot);
  const names = (await readdir(workflowDir)).filter((name) => /\.ya?ml$/.test(name));
  assert.ok(names.length > 0);

  for (const name of names) {
    const workflow = await read(".github/workflows/" + name);
    assert.doesNotMatch(
      workflow,
      /^\s*RAWAJ_E2E_API_PROXY_TARGET\s*:/m,
      name + " must not configure a remote fixture proxy",
    );
    if (workflow.includes("RAWAJ_E2E_USE_FIXTURES")) {
      assert.doesNotMatch(
        workflow,
        /rawaj-classifieds-hub\.allidamech\.workers\.dev/i,
        name + " must not contain the production Worker in local test steps",
      );
    }
  }
});

test("Vite and Playwright refuse unsafe fixture and production combinations", async () => {
  const vite = await read("vite.config.ts");
  const playwright = await read("playwright.config.ts");
  assert.match(vite, /if \(rawajE2eUseFixtures && rawajE2eApiProxyTarget\)/);
  assert.doesNotMatch(vite, /proxy:/);
  assert.match(vite, /throw new Error\("RAWAJ E2E isolation:/);
  assert.match(playwright, /if \(usesLocalFixtures && usesExternalServer\)/);
  assert.match(playwright, /throw new Error\("RAWAJ E2E isolation:/);
});

test("production gateway verification is manual and has a strict retry budget", async () => {
  const workflow = await read(".github/workflows/syria-vercel-api-gateway.yml");
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow, /for attempt in \$\(seq 1 3\); do/);
  assert.doesNotMatch(workflow, /seq 1 40/);
});
