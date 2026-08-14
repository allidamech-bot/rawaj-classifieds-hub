import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Syria public listing ranking uses one active-feature key for default order and cursors", () => {
  const worker = read("cloudflare/worker/src/public-listings.ts");
  assert.match(worker, /l\.is_featured = 1/);
  assert.match(worker, /l\.featured_until IS NULL OR l\.featured_until > strftime/);
  assert.match(worker, /active_feature_rank DESC, l\.created_at DESC, l\.id DESC/);
  assert.match(worker, /sort === "latest" \|\| sort === "featured"/);
  assert.match(worker, /isFeatured: booleanValue\(row\.active_feature_rank\)/);
});

test("Syria Search Boost UI uses the governed packages, preselection, and private proof flow", () => {
  const route = read("src/routes/promotion.tsx");
  assert.match(route, /SEARCH_BOOST_PACKAGES/);
  assert.match(route, /createSearchBoostRequest/);
  assert.match(route, /consumeSearchBoostIntent/);
  assert.match(route, /uploadPromotionReceipt/);
  assert.match(route, /الإيصال خاص/);
  assert.doesNotMatch(route, /featured_home|top_category|sa\.rawa-j\.com|SAR/);
});

test("all six Syria share-card templates render at exact square or story dimensions", () => {
  const renderer = read("src/lib/listing-share-card-renderer.ts");
  const templates = read("src/lib/listing-share-growth.ts");
  for (const id of ["classic", "quick-sale", "minimal", "emerald", "premium", "story"]) {
    assert.match(templates, new RegExp(`id: "${id}"`));
  }
  assert.equal((templates.match(/format: "square",/g) ?? []).length, 5);
  assert.equal((templates.match(/format: "story",/g) ?? []).length, 1);
  assert.match(renderer, /const CARD_WIDTH = 1080/);
  assert.match(renderer, /const SQUARE_HEIGHT = 1080/);
  assert.match(renderer, /const STORY_HEIGHT = 1920/);
  assert.match(renderer, /loadListingImage\(listing\.primaryImageUrl\)/);
  assert.match(renderer, /ctx\.direction = language === "ar" \? "rtl" : "ltr"/);
  assert.match(renderer, /"Cairo"/);
  assert.match(renderer, /rawa-j\.com/);
  assert.doesNotMatch(renderer, /sa\.rawa-j\.com|SAR/);
  for (const rendererName of [
    "drawClassic",
    "drawQuickSale",
    "drawMinimal",
    "drawEmerald",
    "drawPremium",
    "drawStory",
  ]) {
    assert.match(renderer, new RegExp(`function ${rendererName}\\(`));
  }
  assert.equal((renderer.match(/drawHighlights\(ctx, copy\.highlights/g) ?? []).length, 6);

  const premium = renderer.slice(
    renderer.indexOf("function drawPremium"),
    renderer.indexOf("function drawStory"),
  );
  const premiumHighlights = premium.match(
    /drawHighlights\(ctx, copy\.highlights, \d+, (\d+), \d+, (\d+),/,
  );
  const premiumCta = premium.match(/fillRound\(ctx, "#202126", \d+, (\d+),/);
  assert.ok(premiumHighlights, "Premium highlight coordinates must remain explicit");
  assert.ok(premiumCta, "Premium CTA coordinates must remain explicit");
  const thirdHighlightBaseline = Number(premiumHighlights[1]) + Number(premiumHighlights[2]) * 2;
  assert.ok(
    Number(premiumCta[1]) - thirdHighlightBaseline >= 20,
    "Premium CTA must leave clear space after the third highlight",
  );
});

test("listing detail routes owner Share into the existing card flow and preserves public sharing", () => {
  const route = read("src/routes/listings.$id.tsx");
  assert.match(route, /import \{ queueListingSharePrompt \} from "@\/lib\/listing-share-growth"/);
  assert.match(
    route,
    /auth\.status === "signedIn" && auth\.profile\?\.id === listing\.ownerId[\s\S]*?queueListingSharePrompt\(listing\.id\);[\s\S]*?return;/,
  );
  assert.match(
    route,
    /const url = publicListingShareUrl\(window\.location\.origin, listing\.id\);[\s\S]*?navigator\.share[\s\S]*?copyPublicListingUrl\(url\)/,
  );
});

test("owner listing cards expose Share Card only for approved and pending review", () => {
  const ownerListings = read("src/routes/profile/listings.tsx");
  assert.match(
    ownerListings,
    /const canShareCard = listing\.status === "approved" \|\| listing\.status === "pending_review";/,
  );
  assert.match(ownerListings, /\{canShareCard \? \([\s\S]*?queueListingSharePrompt\(listing\.id\)/);
  assert.match(ownerListings, /مشاركة بطاقة الإعلان/);
  assert.match(ownerListings, /Share listing card/);
  assert.match(ownerListings, /<Share2/);
  for (const excluded of ["draft", "rejected", "sold", "rented", "unavailable", "expired", "archived"]) {
    assert.doesNotMatch(
      ownerListings.match(/const canShareCard =[^;]+;/)?.[0] ?? "",
      new RegExp(`"${excluded}"`),
    );
  }
});

test("share-card highlights stay centralized and Syria-only", () => {
  const renderer = read("src/lib/listing-share-card-renderer.ts");
  const helper = read("src/lib/listing-share-highlights.ts");
  assert.match(renderer, /listingShareHighlights\(/);
  assert.match(renderer, /resolveCategoryFieldKind\(null, null, listing\)/);
  assert.match(helper, /\.slice\(0, 3\)/);
  assert.match(helper, /like_new: \["كالجديد", "Like new"\]/);
  assert.doesNotMatch(`${renderer}\n${helper}`, /sa\.rawa-j\.com|SAR|rawaj-saudi/i);
});

test("approved owner notifications and owner listing cards expose Share and eligible Boost actions", () => {
  const notification = read("src/features/notifications/NotificationTimelineCard.tsx");
  const ownerListings = read("src/routes/profile/listings.tsx");
  assert.match(notification, /notification\.type === "listing\.approved"/);
  assert.match(notification, /queueListingSharePrompt/);
  assert.match(notification, /queueSearchBoostIntent/);
  assert.match(ownerListings, /isListingEligibleForSearchBoost/);
  assert.match(ownerListings, /queueSearchBoostIntent\(listing\.id\)/);
});

test("the applied Syria growth-contract repair remains free of listings.is_demo", () => {
  const repair = read("cloudflare/d1/migrations/0024_fix_syria_growth_listing_contract.sql");
  assert.doesNotMatch(repair, /\b(?:l|source)\.is_demo\b/i);
});

test("Syria Share Card Growth UI Arabic literals are valid UTF-8 and free of encoding mojibake", () => {
  const growth = read("src/features/growth/RawajGrowthLayer.tsx");
  const requiredArabic = [
    "إعلانك قيد المراجعة",
    "شارك إعلانك",
    "اختر شكل البطاقة",
    "شارك البطاقة",
    "تنزيل",
    "نسخ الرابط",
    "تعذر تحميل الإعلان الآن",
    "تم فتح نافذة المشاركة",
    "تم نسخ رابط الإعلان",
    "تعذر نسخ الرابط",
    "تم تنزيل بطاقة الإعلان",
    "تعذر إنشاء الصورة الآن",
    "نجهز بطاقات إعلانك",
    "تصاميم",
    "إغلاق",
  ];
  for (const phrase of requiredArabic) {
    assert.match(growth, new RegExp(phrase), `Growth component must contain correct Arabic: ${phrase}`);
  }
  const forbiddenMojibake = [
    "ط§",
    "ط¥",
    "ظ„",
    "طھظ…",
    "ط¥ط±",
    "ط´ط§ظ‡ط¯",
    "طھط¹ط°ط±",
    "طھظ†ط²ظٹظ„",
  ];
  for (const marker of forbiddenMojibake) {
    assert.doesNotMatch(
      growth,
      new RegExp(marker),
      `Growth component must not contain mojibake marker: ${marker}`,
    );
  }
});