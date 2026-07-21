import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, routeStyles, route, studio, css, packageJson] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listing-studio/listing-studio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-studio-v4.css", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("phase 4 listing studio layer is route-scoped and loaded last", () => {
  assert.match(routeStyles, /listingStudioV4Css from "\.\.\/listing-studio-v4\.css\?url"/);
  assert.match(routeStyles, /listingStudioV4: listingStudioV4Css/);
  assert.ok(root.indexOf("listingStudioV4") > root.indexOf("listingStudioV3"));
  assert.match(route, /rawaj-listing-studio-v4/);
});

test("phase 4 keeps publishing behavior untouched while improving form semantics", () => {
  assert.match(route, /submitOwnerListingForReview\(/);
  assert.match(route, /progressLabel=\{text\(/);
  assert.match(route, /role="status" aria-live="polite"/);
  assert.match(studio, /aria-label=\{progressLabel\}/);
  assert.doesNotMatch(css, /display:\s*none[^}]*\.input|pointer-events:\s*none[^}]*\.rawaj-studio-action-bar/);
});

test("phase 4 establishes readable controls, compact sections, and responsive layouts", () => {
  assert.match(css, /min-height:\s*3rem/);
  assert.match(css, /font-size:\s*max\(0\.88rem, 14px\)/);
  assert.match(css, /border-radius:\s*var\(--radius-card/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("phase 4 contract runs in the standard precheck flow", () => {
  const parsed = JSON.parse(packageJson);
  assert.equal(parsed.scripts["test:listing-studio-v4"], "node --test scripts/listing-studio-v4.test.mjs");
  assert.match(parsed.scripts.precheck, /test:listing-studio-v4/);
  assert.match(parsed.scripts.precheck, /^npm run test:conversations-messaging-realtime/);
});
