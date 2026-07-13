import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  truth,
  server,
  root,
  manifest,
  capacitor,
  packageJson,
  qualityGate,
  publicSecurity,
  seoDiscovery,
  semanticSeo,
] = await Promise.all([
  readFile(
    new URL("../docs/phases-41-50-release-readiness.md", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/quality-gate.yml", import.meta.url),
    "utf8",
  ),
  readFile(new URL("./public-data-security.test.mjs", import.meta.url), "utf8"),
  readFile(new URL("./seo-discovery.test.mjs", import.meta.url), "utf8"),
  readFile(new URL("./semantic-seo.test.mjs", import.meta.url), "utf8"),
]);

const packageConfig = JSON.parse(packageJson);
const manifestConfig = JSON.parse(manifest);

test("phase 41 keeps server and public-data security controls permanent", () => {
  for (const header of [
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "x-frame-options",
  ]) {
    assert.match(server, new RegExp(header));
  }
  assert.match(server, /isSensitiveAuthPath/);
  assert.match(server, /no-store, max-age=0/);
  assert.match(
    publicSecurity,
    /public listing allowlist excludes moderation-only fields/,
  );
  assert.match(
    publicSecurity,
    /JSON-LD serialization neutralizes script-breaking characters/,
  );
});

test("phase 42 retains canonical indexing and honest semantic SEO contracts", () => {
  assert.match(seoDiscovery, /canonical/i);
  assert.match(seoDiscovery, /robots/i);
  assert.match(semanticSeo, /WebSite/);
  assert.match(semanticSeo, /Organization/);
  assert.match(truth, /category-aware schema/);
});

test("phases 43 to 46 remain represented by production, responsive and accessibility gates", () => {
  assert.match(root, /<Analytics \/>/);
  assert.match(root, /viewport-fit=cover/);
  assert.match(root, /errorComponent: ErrorComponent/);
  assert.match(qualityGate, /Adaptive Listing Cards contract/);
  assert.match(qualityGate, /Desktop Experience V1 contract/);
  assert.match(qualityGate, /Spatial App Shell contract/);
  assert.match(
    qualityGate,
    /Header Navigation contract|Header navigation contract|Header.*contract/,
  );
  assert.match(qualityGate, /Bottom Dock.*contract/);
});

test("phase 47 keeps installable PWA and narrow Capacitor production identity", () => {
  assert.equal(manifestConfig.display, "standalone");
  assert.equal(manifestConfig.dir, "rtl");
  assert.equal(manifestConfig.lang, "ar");
  assert.deepEqual(
    manifestConfig.icons.map((icon) => icon.sizes),
    ["192x192", "512x512"],
  );
  assert.match(capacitor, /appId: "com\.rawaj\.marketplace"/);
  assert.match(capacitor, /url: "https:\/\/rawa-j\.com"/);
  assert.match(capacitor, /cleartext: false/);
  assert.match(
    capacitor,
    /allowNavigation: \["rawa-j\.com", "\*\.rawa-j\.com"\]/,
  );
});

test("phase 48 keeps analytics, error capture and deployment diagnosis attached", () => {
  assert.equal((root.match(/<Analytics \/>/g) ?? []).length, 1);
  assert.match(root, /reportLovableError/);
  assert.match(root, /rawaj-build-commit/);
  assert.match(server, /consumeLastCapturedError/);
  assert.match(server, /renderErrorPage/);
});

test("phases 49 and 50 define one executable matrix and honest rollback boundary", () => {
  assert.match(packageConfig.scripts.check, /test:phases-41-50/);
  assert.match(packageConfig.scripts.check, /npm run lint/);
  assert.match(packageConfig.scripts.check, /npm run typecheck/);
  assert.match(packageConfig.scripts.check, /npm run build/);
  assert.match(qualityGate, /Production build/);
  assert.match(
    truth,
    /Production acceptance remains manual-only, read-only and commit-identity checked/,
  );
  assert.match(truth, /redeploying the last verified production commit/);
  assert.match(truth, /Database rollback is never assumed/);
  assert.match(
    truth,
    /does not claim completion of the later production and real-phone release gate/,
  );
});
