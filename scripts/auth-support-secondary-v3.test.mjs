import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [login, reset, terms, privacy, prohibited, offers, authCss, trustCss, offerCss, pkg] =
  await Promise.all([
    readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/reset-password.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/terms.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/privacy.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/prohibited.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/offers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/auth-account-v2.css", import.meta.url), "utf8"),
    readFile(new URL("../src/trust-support-hub-v2.css", import.meta.url), "utf8"),
    readFile(new URL("../src/offers-signature.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

test("phase 7 scopes authentication, recovery, legal, prohibited, and offers surfaces", () => {
  assert.match(login, /rawaj-auth-premium-v3/);
  assert.match(reset, /rawaj-auth-recovery-v3/);
  assert.match(terms, /rawaj-legal-v3/);
  assert.match(privacy, /rawaj-legal-v3/);
  assert.match(prohibited, /rawaj-prohibited-v3/);
  assert.match(offers, /rawaj-offers-premium-v3/);
});

test("authentication keeps accessible focus and reduced-motion contracts", () => {
  assert.match(authCss, /--auth-v3-coral/);
  assert.match(authCss, /:focus-visible/);
  assert.match(authCss, /prefers-reduced-motion: reduce/);
  assert.match(authCss, /linear-gradient\(145deg, #ee7a4c, #d75c32\)/);
});

test("secondary pages use readable warm surfaces and RAWAJ brand actions", () => {
  assert.match(trustCss, /--legal-v3-green/);
  assert.match(trustCss, /max-width: 76ch/);
  assert.match(trustCss, /\.rawaj-support-v2/);
  assert.match(offerCss, /#174b41/);
  assert.match(offerCss, /translateY\(-2px\)/);
});

test("phase 7 contract is permanent", () => {
  const parsed = JSON.parse(pkg);
  assert.equal(
    parsed.scripts["test:auth-support-secondary-v3"],
    "node --test scripts/auth-support-secondary-v3.test.mjs",
  );
  assert.match(parsed.scripts.precheck, /test:auth-support-secondary-v3/);
});
