import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
const playwrightConfig = await readFile(
  new URL("../playwright.config.ts", import.meta.url),
  "utf8",
);
const authFixture = await readFile(
  new URL("../e2e/firebase-auth-fixture.ts", import.meta.url),
  "utf8",
);
const privateFixture = await readFile(
  new URL("../e2e/rawaj-e2e-private-fixtures.ts", import.meta.url),
  "utf8",
);
const journey = await readFile(
  new URL("../e2e/authenticated-critical-journey.spec.ts", import.meta.url),
  "utf8",
);

test("Firebase Auth replacement is gated by the explicit E2E fixture flag", () => {
  assert.match(viteConfig, /RAWAJ_E2E_USE_FIXTURES === "1"/);
  assert.match(viteConfig, /rawajE2eUseFixtures\s*\?\s*\[/);
  assert.match(viteConfig, /find: \/\^firebase\\\/auth\$\//);
  assert.match(viteConfig, /firebase-auth-fixture\.ts/);
  assert.doesNotMatch(authFixture, /firebaseapp\.com|googleapis\.com|workers\.dev|rawa-j\.com/);
});

test("fixture-backed browser runs point Cloudflare requests to the local Playwright server", () => {
  assert.match(playwrightConfig, /RAWAJ_E2E_USE_FIXTURES === "1"/);
  assert.match(playwrightConfig, /VITE_PUBLIC_DATA_API_BASE_URL: baseURL/);
  assert.match(playwrightConfig, /usesLocalFixtures\s*\?/);
  assert.doesNotMatch(playwrightConfig, /workers\.dev/);
});

test("authenticated and write fixture routes fail locally instead of reaching the proxy", () => {
  assert.match(privateFixture, /fixture_route_missing/);
  assert.match(privateFixture, /path\.startsWith\("\/api\/"\) \|\| privateRequest/);
  assert.match(privateFixture, /hasFixtureAuthorization/);
  assert.match(privateFixture, /Bearer \$\{FIXTURE_TOKEN\}/);
  const missingRouteBranch = privateFixture.slice(privateFixture.indexOf("fixture_route_missing"));
  assert.match(missingRouteBranch, /\n\s*501,?\s*\n/);
  assert.match(missingRouteBranch, /return;/);
});

test("the browser journey proves authorization and prohibits remote writes", () => {
  assert.match(journey, /remoteWrites/);
  assert.match(journey, /expect\(remoteWrites\)\.toEqual\(\[\]\)/);
  assert.match(journey, /request\.headers\(\)\.authorization/);
  assert.match(journey, /POST \/v1\/listings/);
  assert.match(journey, /Submit for review|إرسال للمراجعة/);
});
