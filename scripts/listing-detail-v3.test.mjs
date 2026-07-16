import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  rootRoute,
  routeStyles,
  detailRoute,
  detailPageData,
  mediaExperience,
  mediaViewer,
  mediaState,
  v2Css,
  v3Css,
] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listing-detail/public-listing-detail-page-data.ts", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/listing-detail/ListingMediaExperience.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/listing-detail/ListingMediaViewer.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/listing-detail/useListingMediaState.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/listing-detail-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-detail-v3.css", import.meta.url), "utf8"),
]);

const layeredCss = `${v2Css}\n${v3Css}`;

test("Listing Detail V3 stylesheet is loaded after V2", () => {
  assert.match(routeStyles, /listingDetailV3Css from "\.\.\/listing-detail-v3\.css\?url"/);
  assert.ok(
    rootRoute.indexOf("routeStyleHrefs.listingDetailV3") >
      rootRoute.indexOf("routeStyleHrefs.listingDetailV2"),
    "V3 must load after V2 so it remains an additive override layer",
  );
});

test("Listing Detail V3 preserves the complete listing experience", () => {
  for (const component of [
    "ListingMediaExperience",
    "ListingContactDock",
    "ListingSellerProfileCard",
    "ListingSafetyAndAlert",
    "SimilarListingsRail",
  ]) {
    assert.match(detailRoute, new RegExp(`<${component}`));
  }

  assert.match(detailRoute, /listing\.reservedAt/);
  assert.match(detailRoute, /rawaj-detail-specs/);
  assert.match(detailRoute, /rawaj-detail-description/);
  assert.match(detailRoute, /rawaj-detail-location/);
});

test("public listing detail dependencies are rendered before hydration", () => {
  assert.match(detailRoute, /loader: async \(\{ params \}\) =>/);
  assert.match(detailRoute, /loadPublicListingDetailPageData\(params\.id\)/);
  assert.match(detailRoute, /const initialData = Route\.useLoaderData\(\)/);
  assert.match(detailRoute, /useState<ListingImage\[]>\(initialData\.images\)/);
  assert.match(detailRoute, /useState<PublicSellerProfile \| null>\(initialData\.seller\)/);
  assert.match(detailRoute, /initialData\.similarListings/);
  assert.match(detailRoute, /const \[loading, setLoading\] = useState\(false\)/);
  assert.match(detailRoute, /const \[sellerLoading, setSellerLoading\] = useState\(false\)/);
  assert.match(detailRoute, /const \[similarLoading, setSimilarLoading\] = useState\(false\)/);
  assert.doesNotMatch(
    detailRoute,
    /fetchListingImages|fetchPublicSellerProfile|fetchPublicListings/,
  );
});

test("listing detail SSR uses anonymous public APIs and excludes the current related item", () => {
  assert.match(detailPageData, /fetchListingDetail\(listingId\)/);
  assert.match(detailPageData, /Promise\.all\(\[/);
  assert.match(detailPageData, /fetchListingImages\(listing\.id\)/);
  assert.match(detailPageData, /fetchPublicSellerProfile\(listing\.ownerId\)/);
  assert.match(detailPageData, /fetchPublicListings\(/);
  assert.match(detailPageData, /item\.id !== listing\.id/);
  assert.match(detailPageData, /\.slice\(0, 8\)/);
  assert.doesNotMatch(detailPageData, /service_role|SUPABASE_SERVICE_ROLE|auth\.admin/);
});

test("media experience keeps swipe, fullscreen, keyboard, zoom, and accessible controls", () => {
  assert.match(mediaExperience, /useListingMediaState\(images\)/);
  assert.match(mediaExperience, /onTouchStart=\{handleTouchStart\}/);
  assert.match(mediaExperience, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(mediaExperience, /setViewerOpen\(true\)/);
  assert.match(mediaState, /SWIPE_THRESHOLD_PX = 42/);
  assert.match(mediaState, /const goTo = useCallback/);
  assert.match(mediaState, /setSelectedIndex\(next\)/);
  assert.match(mediaViewer, /event\.key === "ArrowLeft"/);
  assert.match(mediaViewer, /Math\.min\(3, value \+ 0\.5\)/);
  assert.match(mediaExperience, /aria-pressed=\{favorite\}/);
  assert.match(mediaViewer, /DialogPrimitive\.Title/);
  assert.match(mediaViewer, /DialogPrimitive\.Description/);
});

test("listing media reserves layout space and prioritizes the LCP image", () => {
  assert.match(mediaExperience, /loading="eager"/);
  assert.match(mediaExperience, /fetchPriority="high"/);
  assert.match(mediaExperience, /width=\{1280\}/);
  assert.match(mediaExperience, /height=\{960\}/);
  assert.match(mediaExperience, /sizes="\(max-width: 1023px\) 100vw, 760px"/);
  assert.match(mediaExperience, /width=\{160\}/);
  assert.match(mediaExperience, /height=\{120\}/);
  assert.match(mediaExperience, /sizes="80px"/);
  assert.match(mediaViewer, /width=\{1600\}/);
  assert.match(mediaViewer, /height=\{1200\}/);
  assert.match(mediaViewer, /sizes="100vw"/);
});

test("listing detail media replaces broken signed URLs with category artwork", () => {
  assert.match(mediaState, /useState<Set<string>>\(\(\) => new Set\(\)\)/);
  assert.match(mediaState, /const markImageFailed = useCallback/);
  assert.match(mediaState, /next\.add\(url\)/);
  assert.match(mediaExperience, /failedUrls\.has\(selectedUrl\)/);
  assert.match(mediaExperience, /onError=\{\(\) => markImageFailed\(selectedUrl\)\}/);
  assert.match(mediaExperience, /<PlaceholderArt type=\{placeholder\} aspect="wide" \/>/);
  assert.match(mediaViewer, /failedUrls\.has\(currentUrl\)/);
  assert.match(mediaViewer, /onError=\{\(\) => onImageError\(currentUrl\)\}/);
  assert.match(mediaViewer, /<PlaceholderArt type=\{placeholder\} aspect="standard" \/>/);
});

test("full media viewer is excluded from the initial listing-detail bundle", () => {
  assert.match(mediaExperience, /lazy\(\(\) => import\("\.\/ListingMediaViewer"\)\)/);
  assert.match(mediaExperience, /viewerOpen \? \(/);
  assert.match(mediaExperience, /<Suspense fallback=\{null\}>/);
  assert.doesNotMatch(mediaExperience, /@radix-ui\/react-dialog/);
  assert.match(mediaViewer, /@radix-ui\/react-dialog/);
  assert.match(mediaViewer, /loading="lazy"/);
});

test("listing media orchestration stays separate from reusable interaction state", () => {
  assert.match(mediaExperience, /from "\.\/useListingMediaState"/);
  assert.doesNotMatch(mediaExperience, /useState\(/);
  assert.doesNotMatch(mediaExperience, /useRef\(/);
  assert.doesNotMatch(mediaExperience, /useEffect\(/);
  assert.match(mediaState, /useMemo\(\(\) => images\.filter/);
  assert.match(mediaState, /setLoadedUrl\(null\)/);
});

test("layered V2 and V3 CSS retains mobile-first, bidirectional, safe-area, and motion contracts", () => {
  for (const token of [
    "env(safe-area-inset-left)",
    "@media (max-width: 767px)",
    "@media (min-width: 1024px)",
    "@media (prefers-reduced-motion: reduce)",
    "inset-inline-start",
    "inset-inline-end",
    ":focus-visible",
  ]) {
    assert.ok(layeredCss.includes(token), `Missing layered detail contract token: ${token}`);
  }

  assert.doesNotMatch(v3Css, /@import\s+url/i);
  assert.match(v3Css, /\.rawaj-detail-v2__sidebar\s*\{[^}]*position:\s*sticky/s);
  assert.doesNotMatch(v3Css, /\.rawaj-detail-v2__sidebar\s*\{[^}]*position:\s*fixed/s);
});
