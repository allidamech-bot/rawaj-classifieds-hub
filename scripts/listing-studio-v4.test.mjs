import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  root,
  routeStyles,
  route,
  studio,
  taxonomySelector,
  imageValidation,
  css,
  recoveryCss,
  navigationFix,
  packageJson,
] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listing-studio/listing-studio.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listing-studio/ListingTaxonomySelector.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/listing-studio-image-validation.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-studio-v4.css", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-studio-mobile-recovery.css", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-studio-navigation-fix.ts", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("phase 4 listing studio layer is route-scoped and loaded last", () => {
  assert.match(routeStyles, /listingStudioV4Css from "\.\.\/listing-studio-v4\.css\?url"/);
  assert.match(routeStyles, /listingStudioV4: listingStudioV4Css/);
  assert.match(routeStyles, /import "\.\.\/listing-studio-navigation-fix"/);
  assert.match(routeStyles, /import "\.\.\/listing-studio-mobile-recovery\.css"/);
  assert.match(routeStyles, /import "\.\.\/listing-studio-image-validation"/);
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

test("taxonomy selector keeps every root section visible", () => {
  assert.match(taxonomySelector, /const rawOptions = parent/);
  assert.match(taxonomySelector, /const options = selectedPathIsDeadEnd/);
  assert.match(taxonomySelector, /getTaxonomyRootNodes\(index\)\.filter/);
  assert.doesNotMatch(taxonomySelector, /rawOptions\.filter\(\(node\) => hasAvailableLeaf\(node\)\)/);
  assert.match(taxonomySelector, /بانتظار إضافة التصنيفات الفرعية/);
});

test("listing photos reject unsupported formats and oversized files before upload", () => {
  assert.match(imageValidation, /MAX_LISTING_IMAGE_BYTES = 5 \* 1024 \* 1024/);
  assert.match(imageValidation, /image\/jpeg/);
  assert.match(imageValidation, /image\/png/);
  assert.match(imageValidation, /image\/webp/);
  assert.match(imageValidation, /validateListingImageSelection/);
  assert.match(routeStyles, /listing-studio-image-validation/);
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

test("mobile recovery keeps the add-listing surface readable and non-overlapping", () => {
  assert.match(recoveryCss, /background:\s*linear-gradient\(135deg, #fffaf1/);
  assert.match(recoveryCss, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(recoveryCss, /grid-template-columns:\s*minmax\(5\.25rem, 0\.34fr\) minmax\(0, 1fr\)/);
  assert.match(recoveryCss, /touch-action:\s*manipulation/);
  assert.doesNotMatch(recoveryCss, /pointer-events:\s*none/);
  assert.doesNotMatch(
    recoveryCss,
    /\.rawaj-studio-section\s*\{[^}]*overflow:\s*hidden/,
  );
});

test("listing studio back navigation is explicit and cannot submit the form", () => {
  assert.match(navigationFix, /button\.type = "button"/);
  assert.match(navigationFix, /event\.preventDefault\(\)/);
  assert.match(navigationFix, /event\.stopImmediatePropagation\(\)/);
  assert.match(navigationFix, /previousStep\.click\(\)/);
  assert.match(navigationFix, /scrollIntoView/);
});

test("phase 4 contract runs in the standard precheck flow", () => {
  const parsed = JSON.parse(packageJson);
  assert.equal(parsed.scripts["test:listing-studio-v4"], "node --test scripts/listing-studio-v4.test.mjs");
  assert.match(parsed.scripts.precheck, /test:listing-studio-v4/);
  assert.match(parsed.scripts.precheck, /^npm run test:conversations-messaging-realtime/);
});
