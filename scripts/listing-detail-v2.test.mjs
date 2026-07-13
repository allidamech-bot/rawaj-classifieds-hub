import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, route, media, viewer, seller, dock, safety, similar, css, navigation] =
  await Promise.all([
    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/features/listing-detail/ListingMediaExperience.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/features/listing-detail/ListingMediaViewer.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/features/listing-detail/ListingSellerProfileCard.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/features/listing-detail/ListingContactDock.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/features/listing-detail/ListingSafetyAndAlert.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/features/listing-detail/SimilarListingsRail.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/listing-detail-v2.css", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/primary-navigation.ts", import.meta.url), "utf8"),
  ]);

test("listing detail V2 styles load after marketplace presentation styles", () => {
  assert.match(root, /import listingDetailV2Css from "\.\.\/listing-detail-v2\.css\?url";/);
  const searchIndex = root.indexOf("href: searchFiltersV1Css");
  const detailIndex = root.indexOf("href: listingDetailV2Css");
  assert.ok(searchIndex >= 0);
  assert.ok(detailIndex > searchIndex);
});

test("listing detail starts with immersive media instead of a page header", () => {
  assert.match(route, /<main className="rawaj-detail-v2">[\s\S]*?<ListingMediaExperience/);
  const loadedReturn = route.indexOf('<main className="rawaj-detail-v2">');
  const mediaIndex = route.indexOf("<ListingMediaExperience", loadedReturn);
  const pageHeaderIndex = route.indexOf("<PageHeader", loadedReturn);
  assert.ok(loadedReturn >= 0 && mediaIndex > loadedReturn);
  assert.equal(pageHeaderIndex, -1);
  assert.match(media, /rawaj-detail-media__top-actions/);
  assert.match(media, /onBack/);
  assert.match(media, /onShare/);
  assert.match(media, /onToggleFavorite/);
});

test("media experience supports swipe, thumbnails, keyboard navigation, zoom, and full screen", () => {
  assert.match(media, /onTouchStart/);
  assert.match(media, /onTouchEnd/);
  assert.match(media, /fetchPriority="high"/);
  assert.match(media, /loading="lazy"/);
  assert.match(media, /lazy\(\(\) => import\("\.\/ListingMediaViewer"\)\)/);
  assert.match(viewer, /ArrowLeft/);
  assert.match(viewer, /ArrowRight/);
  assert.match(viewer, /setZoom/);
  assert.match(viewer, /DialogPrimitive\.Content/);
  assert.match(viewer, /rawaj-media-viewer__rail/);
});

test("seller profile uses real public profile data and no invented trust claims", () => {
  assert.match(route, /fetchPublicSellerProfile\(initialListing\.ownerId\)/);
  assert.match(route, /<ListingSellerProfileCard/);
  assert.match(seller, /seller\?\.verified/);
  assert.match(seller, /seller\?\.ratingSummary\.average/);
  assert.match(seller, /seller\.approvedListingCount/);
  assert.match(seller, /seller\?\.joinedAt/);
  assert.match(seller, /failedAvatarUrl/);
  assert.match(seller, /failedAvatarUrl !== avatarUrl/);
  assert.match(seller, /setFailedAvatarUrl\(avatarUrl\)/);
  assert.match(seller, /loading="lazy"/);
  assert.match(seller, /decoding="async"/);
  assert.match(seller, /width=\{64\}/);
  assert.match(seller, /height=\{64\}/);
  assert.match(seller, /<User aria-hidden="true" \/>/);
  assert.doesNotMatch(seller, /response time|sales completed|top seller/i);
});

test("contact dock preserves owner controls and real communication channels", () => {
  assert.match(route, /const isOwner = auth\.profile\?\.id === listing\.ownerId/);
  assert.match(route, /<ListingContactDock/);
  assert.match(dock, /to="\/profile\/listings\/\$id"/);
  assert.match(dock, /onMessage/);
  assert.match(dock, /onOffer/);
  assert.match(dock, /callHref/);
  assert.match(dock, /whatsappUrl/);
  assert.doesNotMatch(dock, /createOffer|submitOffer|offer_amount/);
});

test("price alert is implemented through the existing saved-search contract", () => {
  assert.match(route, /createSavedSearch/);
  assert.match(route, /priceMax: listing\.price/);
  assert.match(route, /alertFrequency: "daily"/);
  assert.match(route, /similar listings at this price or lower/);
  assert.match(safety, /onCreateAlert/);
  assert.doesNotMatch(route, /createPriceAlertSubscription|price_alerts/);
});

test("similar listings use public listing filters and adaptive cards", () => {
  assert.match(route, /fetchPublicListings\([\s\S]*categoryId: initialListing\.categoryId/);
  assert.match(route, /filter\(\(item\) => item\.id !== initialListing\.id\)/);
  assert.match(similar, /RealListingCard/);
  assert.match(similar, /ListingCardSkeleton/);
  assert.match(similar, /search=\{\{ category: categoryId \}\}/);
});

test("reservation and messaging eligibility remain independent", () => {
  assert.match(route, /listing\.reservedAt \?/);
  assert.match(route, /هذا الإعلان محجوز حالياً/);
  assert.match(route, /This listing is currently reserved/);
  assert.match(route, /if \(!listing \|\| listing\.status !== "approved"\)/);
  const messageStart = route.indexOf("async function messageSeller");
  const shareStart = route.indexOf("async function shareListing", messageStart);
  const messageFunction = route.slice(messageStart, shareStart);
  assert.doesNotMatch(messageFunction, /reservedAt/);
});

test("listing detail keeps the sticky-action shell mode and safe-area contact dock", () => {
  assert.match(navigation, /if \(isListingDetailPath\(pathname\)\)[\s\S]*mode: "stickyAction"/);
  assert.match(css, /\.rawaj-contact-dock/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(min-width: 960px\)/);
});
