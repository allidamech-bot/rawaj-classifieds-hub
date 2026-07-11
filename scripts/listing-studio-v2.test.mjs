import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, shared, createRoute, manageRoute, css, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listing-studio/listing-studio.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile/listings.$id.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-studio-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("Listing Studio V2 stylesheet is loaded after the legacy studio layer", () => {
  assert.match(root, /import listingStudioV2Css from "\.\.\/listing-studio-v2\.css\?url"/);
  const legacy = root.indexOf("href: listingStudioSignatureCss");
  const v2 = root.indexOf("href: listingStudioV2Css");
  assert.notEqual(legacy, -1);
  assert.notEqual(v2, -1);
  assert.ok(v2 > legacy);
});

test("shared studio exposes one shell, hero, preview, quality, autosave and action system", () => {
  for (const component of [
    "ListingStudioShell",
    "ListingStudioHero",
    "ListingStudioSteps",
    "ListingStudioSection",
    "ListingStudioAutosaveStatus",
    "ListingStudioPreview",
    "ListingStudioQualityPanel",
    "ListingStudioActionBar",
  ]) {
    assert.match(shared, new RegExp(`export function ${component}`));
  }
  assert.match(shared, /className="rawaj-studio-shell"/);
  assert.match(shared, /className="rawaj-studio-preview"/);
});

test("create flow uses the shared studio while preserving draft and review behavior", () => {
  assert.match(createRoute, /rawaj-listing-studio-v2/);
  assert.match(createRoute, /<ListingStudioHero/);
  assert.match(createRoute, /<ListingStudioAutosaveStatus/);
  assert.match(createRoute, /<ListingStudioPreview/);
  assert.match(createRoute, /<ListingStudioQualityPanel/);
  assert.match(createRoute, /rawaj-studio-action-bar/);
  assert.match(createRoute, /createOwnerDraftListing/);
  assert.match(createRoute, /updateOwnerListing/);
  assert.match(createRoute, /submitOwnerListingForReview/);
  assert.match(createRoute, /const MAX_IMAGES = 6/);
  assert.match(createRoute, /waitForAllImageUploadsInFlight/);
  assert.match(createRoute, /registerStaleUploadCleanup/);
});

test("manage flow uses the same studio without weakening status permissions", () => {
  assert.match(manageRoute, /rawaj-listing-studio-v2/);
  assert.match(manageRoute, /<ListingStudioHero/);
  assert.match(manageRoute, /<ListingStudioPreview/);
  assert.match(manageRoute, /<ListingStudioQualityPanel/);
  assert.match(manageRoute, /listing\?\.status === "draft" \|\| listing\?\.status === "rejected"/);
  assert.match(manageRoute, /submitOwnerListingForReview/);
  assert.match(manageRoute, /deleteOwnerListing/);
  assert.match(manageRoute, /deleteListingImage/);
  assert.match(manageRoute, /uploadListingImage/);
});

test("studio remains mobile-first, safe-area aware, RTL neutral and reduced-motion safe", () => {
  assert.match(css, /\.rawaj-studio-shell/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 19rem/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /inset-inline/);
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("quality gate permanently runs Listing Studio V2 with read-only contents permission", () => {
  assert.match(qualityGate, /contents: read/);
  assert.match(qualityGate, /Listing Studio V2 contract/);
  assert.match(qualityGate, /node --test scripts\/listing-studio-v2\.test\.mjs/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
