import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("browser smoke and rendered visual QA use only local E2E data fixtures", () => {
  for (const path of [
    ".github/workflows/browser-smoke.yml",
    ".github/workflows/rendered-visual-qa.yml",
  ]) {
    const workflow = read(path);
    assert.match(workflow, /RAWAJ_E2E_USE_FIXTURES: "1"/, path);
    assert.match(workflow, /VITE_PUBLIC_DATA_API_BASE_URL: "http:\/\/127\.0\.0\.1:4173"/, path);
    assert.match(workflow, /VITE_RAWAJ_E2E_DISABLE_REMOTE_MEDIA: "1"/, path);
    assert.doesNotMatch(workflow, /RAWAJ_E2E_API_PROXY_TARGET|rawaj-classifieds-hub\.allidamech\.workers\.dev/, path);
  }
});

test("Vite cannot silently forward E2E fixture misses to production", () => {
  const vite = read("vite.config.ts");
  assert.match(vite, /RAWAJ_E2E_USE_FIXTURES/);
  assert.match(vite, /createRawajE2eApiFixturePlugin\(\)/);
  assert.match(vite, /rawajE2eLocalApiBaseUrl/);
  assert.doesNotMatch(vite, /RAWAJ_E2E_API_PROXY_TARGET|rawajE2eApiProxyTarget/);
  assert.doesNotMatch(vite, /\bproxy\s*:/);
});
