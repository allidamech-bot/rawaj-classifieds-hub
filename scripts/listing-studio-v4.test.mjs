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
  mobileOverflowFix,
  previewTrueSizeCss,
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
  readFile(new URL("../src/listing-studio-mobile-overflow-fix.css", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-preview-true-size.css", import.meta.url), "utf8"),
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
  assert.doesNotMatch(
    css,
    /display:\s*none[^}]*\.input|pointer-events:\s*none[^}]*\.rawaj-studio-action-bar/,
  );
});

test("taxonomy selector supports complete-tree browsing and final-category search", () => {
  assert.match(taxonomySelector, /getTaxonomyRootNodes\(index\)/);
  assert.match(taxonomySelector, /getTaxonomyChildren\(index, parent\.id\)/);
  assert.match(taxonomySelector, /getTaxonomyLeafDescendants\(index, node\)\.length > 0/);
  assert.match(taxonomySelector, /const MAX_SEARCH_RESULTS = 24/);
  assert.match(taxonomySelector, /searchTaxonomyNodes\(index, normalizedSearchTerm\)/);
  assert.match(taxonomySelector, /\.filter\(\(\{ node \}\) => node\.isLeaf\)/);
  assert.match(taxonomySelector, /data-taxonomy-search-results="true"/);
  assert.match(taxonomySelector, /taxonomyPathLabel\(resultPath, language\)/);
  assert.match(taxonomySelector, /if \(node\.isLeaf\) setSearchTerm\(""\)/);
  assert.match(taxonomySelector, /data-taxonomy-depth=\{currentDepth\}/);
  assert.match(taxonomySelector, /data-taxonomy-kind=\{node\.isLeaf \? "leaf" : "branch"\}/);
  assert.match(taxonomySelector, /className="rawaj-taxonomy-breadcrumb"/);
  assert.match(taxonomySelector, /aria-current=\{node\.id === selectedNodeId \? "step"/);
  assert.match(taxonomySelector, /className="rawaj-taxonomy-option__path"/);
  assert.match(route, /<ListingStudioHero[\s\S]*?compact/);
});

test("listing photos reject unsupported formats and files beyond the Worker upload limit", () => {
  assert.match(imageValidation, /MAX_LISTING_IMAGE_BYTES = 8 \* 1024 \* 1024/);
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
  assert.match(
    recoveryCss,
    /grid-template-columns:\s*minmax\(5\.25rem, 0\.34fr\) minmax\(0, 1fr\)/,
  );
  assert.match(recoveryCss, /touch-action:\s*manipulation/);
  assert.doesNotMatch(recoveryCss, /pointer-events:\s*none/);
  assert.doesNotMatch(recoveryCss, /\.rawaj-studio-section\s*\{[^}]*overflow:\s*hidden/);
});

test("mobile horizontal strips remain internal scroll containers", () => {
  assert.match(
    routeStyles,
    /listingStudioMobileOverflowFixCss from "\.\.\/listing-studio-mobile-overflow-fix\.css\?url"/,
  );
  assert.ok(
    routeStyles.indexOf("listingStudioMobileOverflowFixCss") >
      routeStyles.indexOf("homeNotificationOverlayFixCss"),
  );
  assert.match(mobileOverflowFix, /width:\s*100% !important/);
  assert.match(mobileOverflowFix, /max-width:\s*100% !important/);
  assert.match(mobileOverflowFix, /min-width:\s*0 !important/);
  assert.match(mobileOverflowFix, /overflow-x:\s*auto !important/);
  assert.match(mobileOverflowFix, /contain:\s*inline-size/);
  assert.match(mobileOverflowFix, /overscroll-behavior-inline:\s*contain/);
  assert.doesNotMatch(mobileOverflowFix, /:is\(\.rawaj-studio-trust-strip, \.rawaj-studio-steps\)/);
});

test("live listing preview never upscales the source image", () => {
  assert.match(
    routeStyles,
    /listingPreviewTrueSizeCss from "\.\.\/listing-preview-true-size\.css\?url"/,
  );
  assert.ok(
    routeStyles.lastIndexOf("listingPreviewTrueSizeCss") >
      routeStyles.lastIndexOf("listingStudioMobileOverflowFixCss"),
  );
  assert.match(
    previewTrueSizeCss,
    /\.rawaj-studio-preview\s*\{[\s\S]*width:\s*min\(100%, 18rem\) !important/,
  );
  assert.match(
    previewTrueSizeCss,
    /\.rawaj-studio-preview__media\s*\{[\s\S]*aspect-ratio:\s*4 \/ 3 !important/,
  );
  assert.match(
    previewTrueSizeCss,
    /\.rawaj-studio-preview__media img\s*\{[\s\S]*width:\s*auto !important/,
  );
  assert.match(previewTrueSizeCss, /max-width:\s*100% !important/);
  assert.match(previewTrueSizeCss, /max-height:\s*100% !important/);
  assert.match(previewTrueSizeCss, /object-fit:\s*contain !important/);
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
  assert.equal(
    parsed.scripts["test:listing-studio-v4"],
    "node --test scripts/listing-studio-v4.test.mjs",
  );
  assert.match(parsed.scripts.precheck, /test:listing-studio-v4/);
  assert.match(parsed.scripts.precheck, /^npm run test:conversations-messaging-realtime/);
});


test("B2.3 create and edit share one studio V4 UI without global inline inputs", async () => {
  const editor = await readFile(new URL("../src/routes/profile/listings_.$id.tsx", import.meta.url), "utf8");
  assert.match(route, /rawaj-listing-studio-v4[\s\S]*?data-studio-workflow="create"/);
  assert.match(editor, /rawaj-listing-studio-v4 rawaj-listing-studio-v2--manage/);
  assert.match(editor, /data-studio-workflow="edit"/);
  assert.doesNotMatch(editor, /<style>\{\x60\.input\{/);
  assert.match(css, /\.rawaj-listing-studio-v4 \.input:disabled/);
  for (const preserved of [
    "submitOwnerListingForReview",
    "deleteOwnerListing",
    "deleteListingImage",
    "ListingStudioPreview",
    "ListingStudioCompletionCard",
  ]) {
    assert.ok(editor.includes(preserved), `Editor contract removed: ${preserved}`);
  }
});


test("B2.3 uses one accessible route-owned gate for publishing and editor recovery", async () => {
  const editor = await readFile(new URL("../src/routes/profile/listings_.$id.tsx", import.meta.url), "utf8");
  assert.equal((route.match(/className="rawaj-studio-gate container-wide/g) || []).length, 2);
  assert.equal((editor.match(/className="rawaj-studio-gate container-wide/g) || []).length, 2);
  assert.match(route, /className="rawaj-studio-success rawaj-studio-gate__card/);
  assert.match(editor, /rawaj-studio-gate__description/);
  assert.match(css, /\.rawaj-studio-gate > \.rawaj-studio-gate__card/);
  assert.match(css, /\.rawaj-studio-gate :is\(a, button\):focus-visible/);
  assert.match(editor, /onClick=\{\(\) => void loadSetup\(\)\}/);
  assert.match(route, /actionSearch=\{\{ returnTo: "\/add-listing" \}\}/);
});


test("B2.3 studio palette opt-in is route-scoped at the shared shell", async () => {
  const appShell = await readFile(new URL("../src/components/shell/AppShell.tsx", import.meta.url), "utf8");
  assert.match(appShell, /resolveRouteStyleScope\(pathname\)\.listingStudio/);
  assert.match(appShell, /data-design-palette=\{useApprovedStudioIdentity \? "ivory" : undefined\}/);
  assert.match(css, /data-resolved-pathname="\/add-listing"/);
  assert.match(css, /data-resolved-pathname\^="\/profile\/listings\/"/);
  assert.match(css, /--rawaj-shell-canvas: var\(--rawaj-identity-ivory\)/);
});


test("B2.3 retires direct dark gradients in studio visual owners", async () => {
  const audit = await readFile(new URL("../src/listing-studio-audit-v9.css", import.meta.url), "utf8");
  for (const retired of ["#303138", "#303137", "#2a2b31", "#292a30", "#343039", "#2c2b31", "#2d333d"]) {
    assert.ok(!audit.includes(retired), `Retired dark surface survives: ${retired}`);
  }
  assert.ok(audit.includes("background: var(--rawaj-card-background) !important"));
  assert.ok(audit.includes("background: var(--rawaj-surface-selected) !important"));
  assert.ok(css.includes("background: linear-gradient(135deg, var(--rawaj-identity-petrol), var(--rawaj-identity-teal))"));
});


test("B2.3 petrol header retains readable ivory text and champagne accent", async () => {
  const audit = await readFile(new URL("../src/listing-studio-audit-v9.css", import.meta.url), "utf8");
  assert.match(audit, /\.rawaj-studio-hero h1 \{[\s\S]*?color: var\(--rawaj-identity-ivory\) !important/);
  assert.match(audit, /\.rawaj-studio-hero__eyebrow \{[\s\S]*?color: var\(--rawaj-identity-champagne\) !important/);
  assert.match(audit, /\.rawaj-studio-hero__description \{[\s\S]*?color: var\(--rawaj-identity-ivory\) !important/);
  assert.doesNotMatch(audit, /rgba\(220, 62, 182, 0\.11\)/);
});


test("B2.3 source V5 uses canonical light panels and semantic text colors", async () => {
  const system = await readFile(new URL("../src/rawaj-listing-studio-system-v5.css", import.meta.url), "utf8");
  assert.ok(system.includes("--studio-v5-panel: var(--rawaj-card-background)"));
  assert.ok(system.includes("--studio-v5-text: var(--rawaj-identity-ink)"));
  assert.ok(system.includes("linear-gradient(135deg, var(--rawaj-identity-petrol), var(--rawaj-identity-teal))"));
  for (const old of ["#ff7559", "#df49b5", "#68adff", "#ff7f87", "#292a30"]) {
    assert.ok(!system.includes(old), `V5 has retired color ${old}`);
  }
});


test("B2.3 excludes create/edit from V7 and V17 forced dark shells at source", async () => {
  const v7 = await readFile(new URL("../src/rawaj-page-by-page-recovery-v7.css", import.meta.url), "utf8");
  const v17 = await readFile(new URL("../src/rawaj-chromatic-premium-system-v17.css", import.meta.url), "utf8");
  for (const css of [v7, v17]) {
    assert.ok(css.includes(':not([data-resolved-pathname="/add-listing"])'));
    assert.ok(css.includes(':not([data-resolved-pathname^="/profile/listings/"])'));
    assert.ok(css.includes(':not([data-resolved-pathname^="/listings/"])'));
    assert.ok(!css.includes(':where(:not([data-resolved-pathname="/listings"]):not([data-resolved-pathname^="/listings/"]))'));
  }
  assert.ok(!v17.includes('.rawaj-app-shell[data-resolved-pathname="/add-listing"],\\n.rawaj-app-shell[data-resolved-pathname^="/profile/listings/"] {'));
  assert.ok(v7.includes('[data-resolved-pathname="/more"]'));
});

test("B2.3 has no dark V7B/V18 studio owner and has matching mobile chrome", async () => {
  const read = (p) => readFile(new URL("../src/"+p,import.meta.url),"utf8");
  const [v7b,v18,chrome]=await Promise.all([
    read("rawaj-page-by-page-recovery-v7b.css"),
    read("rawaj-chromatic-premium-system-v18-legacy-surfaces.css"),
    read("lib/browser-chrome.ts"),
  ]);
  assert.ok(!v7b.includes("/* 6. Add/edit listing studio */"));
  assert.ok(!v18.includes("Listing studio: add/edit/manage"));
  assert.ok(v7b.includes(':not([data-design-palette="ivory"])'));
  assert.ok(chrome.includes('pathname === "/add-listing"'));
  assert.ok(chrome.includes('themeColor: "#073836"'));
});

test("B2.3 V8 no longer forces charcoal cards over the studio's ivory panels", async () => {
  const css = await readFile(new URL("../src/rawaj-audit-corrections-v8.css", import.meta.url), "utf8");
  assert.ok(!css.includes("Listing studio: compact hierarchy"));
  assert.ok(!css.includes(".rawaj-studio-quality"));
  assert.ok(css.includes("Admin: readable semantic surfaces"));
});
