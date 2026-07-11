import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [viteConfig, buildInfo, panel, adminRoute] = await Promise.all([
  readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/build-info.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/DeploymentTruthPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8"),
]);

test("build metadata is embedded from Vercel or CI truth", () => {
  assert.match(viteConfig, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(viteConfig, /VERCEL_GIT_COMMIT_REF/);
  assert.match(viteConfig, /VERCEL_ENV/);
  assert.match(viteConfig, /__RAWAJ_BUILD_INFO__/);
  assert.match(buildInfo, /rawajBuildInfo/);
});

test("owner controls expose the build identity panel", () => {
  assert.match(adminRoute, /DeploymentTruthPanel/);
  assert.match(adminRoute, /\/admin\/owner-controls/);
  assert.match(panel, /Current build identity/);
  assert.match(panel, /Environment \/ target/);
  assert.match(panel, /Deployment host/);
});
