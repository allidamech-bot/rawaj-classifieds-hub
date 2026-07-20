import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const [
  route,
  pageData,
  publicRead,
  publicFields,
  taxonomyApi,
  locationApi,
  taxonomyContext,
  presentation,
  sellerCard,
  contactDock,
  media,
  structuredData,
  seo,
  detailCss,
  workflow,
  qualityGate,
  migrations,
] = await Promise.all([
  readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listing-detail/public-listing-detail-page-data.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/public-fields.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-taxonomy.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-location-read.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/listing-taxonomy-context.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/public-listing-presentation.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listing-detail/ListingSellerProfileCard.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/listing-detail/ListingContactDock.tsx", import.meta.url),
    "utf8",
  ),
  readFile(
    new URL("../src/features/listing-detail/ListingMediaExperience.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/lib/listing-structured-data.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/seo.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/listing-detail-v2.css", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/public-listing-detail-integrity.yml", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  readdir(new URL("../supabase/migrations/", import.meta.url)),
]);

test("the detail loader uses public-only reads and rejects non-public listings", () => {
  assert.match(pageData, /fetchListingDetail\(listingId\)/);
  assert.doesNotMatch(route + pageData, /fetchOwnerListingDetail|owner_listing_read/);
  assert.match(publicRead, /\.eq\("status", "approved"\)/);
  assert.match(publicRead, /\.is\("archived_at", null\)/);
  assert.match(publicRead, /publicListingExpiryFilter\(\)/);
  assert.match(route, /!isPublicListingVisible\(listing\)/);
  assert.match(pageData, /if \(!isPublicListingVisible\(listing\)\) return null/);
});

test("canonical taxonomy hydration falls back safely without public writes", () => {
  assert.match(pageData, /fetchPublicListingTaxonomyAssignment\(listing\.id\)/);
  assert.match(pageData, /listing\.details\._taxonomy_node_id/);
  assert.match(pageData, /resolveListingTaxonomyContext\(/);
  assert.match(taxonomyContext, /canonical_assignment/);
  assert.match(taxonomyContext, /details_fallback/);
  assert.match(taxonomyContext, /legacy_compatible/);
  assert.match(taxonomyContext, /node\.legacyCategoryId === categoryId/);
  assert.match(taxonomyContext, /node\.isLeaf/);
  assert.match(taxonomyApi, /fetchPublicListingTaxonomyAssignment/);
  assert.doesNotMatch(route + pageData, /assignOwnerListingTaxonomy|rawaj_assign_listing_taxonomy/);
});

test("taxonomy breadcrumb and category details use explicit presentation helpers", () => {
  assert.match(route, /resolveCategoryFieldKind\(/);
  assert.doesNotMatch(route, /detectCategoryFieldKind/);
  assert.match(route, /taxonomyPathLabel\(initialData\.taxonomyPath, language\)/);
  assert.match(route, /<ListingTaxonomyBreadcrumb/);
  assert.match(route, /taxonomyNodeName\(node, language\)/);
  assert.match(route, /buildPublicListingDetailRows\(categoryFieldKind, listing, text\)/);
  assert.match(presentation, /categoryDetailDisplayRows\(kind, listing\.details, text\)/);
  assert.match(presentation, /const publicDetailKeys = new Set\(categoryDetailKeys\)/);
  assert.doesNotMatch(route, /_taxonomy_node_id\}/);
});

test("condition and internal detail fields are filtered from public presentation", () => {
  assert.match(presentation, /categoryUsesGlobalCondition\(kind\)/);
  assert.match(presentation, /listing\.condition !== "not_applicable"/);
  assert.match(presentation, /hasSpecificCondition/);
  assert.match(presentation, /publicDetailKeys\.has\(key\)/);
  assert.match(presentation, /reviewedBy: null/);
  assert.match(presentation, /rejectionReason: null/);
  assert.doesNotMatch(route, /Object\.entries\(listing\.details\)/);
});

test("canonical location paths and legacy fallbacks never show raw node ids", () => {
  assert.match(pageData, /fetchPublicListingLocationPath\(listing\.id\)/);
  assert.match(locationApi, /\.eq\("status", "approved"\)/);
  assert.match(locationApi, /fetchLocationPath\(locationNodeId\)/);
  assert.match(route, /resolvePublicLocationLabel\(/);
  assert.match(presentation, /node\.nodeType !== "country"/);
  assert.match(presentation, /district\?\.startsWith\("@"\)/);
  assert.match(presentation, /listing\.districtAr\?\.trim\(\)\.startsWith\("@"\) \? null/);
});

test("price, gallery, seller, and contact presentation remain public-safe", () => {
  assert.match(route, /<SypPriceDisplay listing=\{listing\} \/>/);
  assert.match(structuredData, /listing\.priceNewSypNormalized/);
  assert.match(pageData, /normalizePublicListingImages\(/);
  assert.match(presentation, /\.sort\(\(left, right\) => left\.sortOrder - right\.sortOrder\)/);
  assert.match(presentation, /seen\.has\(url\)/);
  assert.match(media, /PlaceholderArt/);
  assert.match(sellerCard, /seller\?\.verified/);
  assert.match(sellerCard, /ratingCount > 0/);
  assert.doesNotMatch(sellerCard, /email|privatePhone|adminMetadata/);
  assert.match(route, /listing\.contactOptions\.phone \? phoneHref\(phone\) : null/);
  assert.match(route, /listing\.contactOptions\.whatsapp \? whatsappHref\(whatsapp\) : null/);
  assert.doesNotMatch(publicFields, /contact_options,details,/);
  assert.match(publicFields, /categoryDetailKeys\.map/);
  assert.match(publicRead, /if \(contactOptions\.phone === true\)/);
  assert.match(publicRead, /if \(contactOptions\.whatsapp === true\)/);
  assert.match(presentation, /normalizeContactPhone/);
});

test("owner, favorite, chat, and share actions have integrity guards", () => {
  assert.match(route, /listing\?\.ownerId === auth\.profile\?\.id/);
  assert.match(route, /You cannot message yourself/);
  assert.match(sellerCard, /canMessage \? \(/);
  assert.match(contactDock, /to="\/profile\/listings\/\$id"/);
  assert.match(contactDock, /Manage listing/);
  assert.match(route, /favoriteInFlightRef\.current/);
  assert.match(route, /const previousFavoriteState = fav/);
  assert.match(route, /setFav\(desiredFavoriteState\)/);
  assert.match(route, /setFav\(previousFavoriteState\)/);
  assert.match(route, /publicListingShareUrl\(window\.location\.origin, listing\.id\)/);
  assert.doesNotMatch(route, /window\.location\.href/);
});

test("description and SEO metadata avoid unsafe rendering and private contacts", () => {
  assert.doesNotMatch(route, /dangerouslySetInnerHTML/);
  assert.match(route, /rawaj-detail-description break-words/);
  assert.match(route, /publicSeoDescription\(/);
  assert.match(presentation, /replace\(\/<\[\^>\]\*>\/g/);
  assert.match(route, /createSeo\(\{/);
  assert.match(route, /path: listing \? `\/listings\/\$\{listing\.id\}`/);
  assert.match(seo, /property: "og:title"/);
  assert.match(seo, /property: "og:url"/);
  assert.match(seo, /rel: "canonical"/);
  assert.match(route, /noindex: !listing/);
  assert.match(structuredData, /explicitKind \?\? detectCategoryFieldKind/);
});

test("mobile actions retain overflow and safe-area protections", () => {
  assert.match(route, /max-w-full flex-wrap/);
  assert.match(media, /onTouchStart=\{handleTouchStart\}/);
  assert.match(media, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(detailCss, /overflow: clip/);
  assert.match(detailCss, /env\(safe-area-inset-bottom\)/);
  assert.match(detailCss, /rawaj-contact-dock/);
});

test("the permanent workflow is read-only and Phase 7 adds no migration", () => {
  assert.match(workflow, /name: Public Listing Detail Integrity Contract/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.match(workflow, /node --test scripts\/public-listing-detail-integrity\.test\.mjs/);
  assert.match(qualityGate, /name: Public Listing Detail Integrity contract/);
  assert.match(qualityGate, /run: node --test scripts\/public-listing-detail-integrity\.test\.mjs/);
  assert.equal(
    migrations.some((name) => /phase.?7|public.?listing.?detail.?integrity/i.test(name)),
    false,
  );
  assert.doesNotMatch(route + pageData, /updateOwnerListing|assignOwnerListingTaxonomy|\.rpc\(/);
});
