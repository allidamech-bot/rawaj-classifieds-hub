import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  login,
  reset,
  terms,
  privacy,
  prohibited,
  offers,
  routeStyles,
  authCss,
  trustCss,
  correctionCss,
  offerCss,
  pkg,
] = await Promise.all([
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/reset-password.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/terms.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/privacy.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/prohibited.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/offers.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/auth-account-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/trust-support-hub-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/auth-support-correction-v1.css", import.meta.url), "utf8"),
  readFile(new URL("../src/offers-signature.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("phase 7 scopes authentication, recovery, legal, prohibited, and offers surfaces", () => {
  assert.match(login, /rawaj-auth-premium-v3/);
  assert.match(reset, /rawaj-auth-recovery-v4/);
  assert.match(terms, /rawaj-legal-v3/);
  assert.match(privacy, /rawaj-legal-v3/);
  assert.match(prohibited, /rawaj-prohibited-v3/);
  assert.match(offers, /rawaj-offers-premium-v3/);
});

test("authentication keeps accessible focus and reduced-motion contracts", () => {
  assert.match(authCss, /--auth-v3-coral/);
  assert.match(authCss, /:focus-visible/);
  assert.match(authCss, /prefers-reduced-motion: reduce/);
  assert.match(routeStyles, /auth-support-correction-v1\.css/);
  assert.match(correctionCss, /\.rawaj-auth-card \.input:focus-visible/);
  assert.match(correctionCss, /font-size:\s*max\(0\.86rem, 13\.5px\)/);
});

test("secondary pages use readable structural surfaces and restrained brand actions", () => {
  assert.match(trustCss, /--legal-v3-green/);
  assert.match(correctionCss, /--secondary-v1-border/);
  assert.match(correctionCss, /max-width:\s*72ch/);
  assert.match(correctionCss, /\.rawaj-support-panel/);
  assert.match(correctionCss, /background:\s*var\(--rawaj-primary/);
  assert.match(correctionCss, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.doesNotMatch(correctionCss, /translateY\(-2px\)/);
  assert.match(offerCss, /#174b41/);
});

test("phase 7 contract is permanent", () => {
  const parsed = JSON.parse(pkg);
  assert.equal(
    parsed.scripts["test:auth-support-secondary-v3"],
    "node --test scripts/auth-support-secondary-v3.test.mjs",
  );
  assert.match(parsed.scripts.precheck, /test:auth-support-secondary-v3/);
});
