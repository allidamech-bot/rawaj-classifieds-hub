import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/202607150001_retention_discovery_v1.sql";
const apiPath = "src/lib/api/retention-discovery.ts";
const followButtonPath = "src/features/retention/SellerFollowButton.tsx";
const mediaPath = "src/features/listing-detail/ListingMediaExperience.tsx";
const sellerCardPath = "src/features/listing-detail/ListingSellerProfileCard.tsx";
const storefrontPath = "src/features/storefront/StorefrontIdentityHero.tsx";
const discoveryRailPath = "src/features/listing-detail/SimilarListingsRail.tsx";

const read = (path) => readFile(path, "utf8");

test("recent listing history is private and public visibility guarded", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /create table if not exists public\.recent_listing_views/i);
  assert.match(migration, /alter table public\.recent_listing_views enable row level security/i);
  assert.match(migration, /auth\.uid\(\) = user_id/i);
  assert.match(migration, /rawaj_record_recent_listing_view_v1/i);
  assert.match(migration, /l\.status = 'approved'/i);
  assert.match(migration, /l\.archived_at is null/i);
  assert.match(migration, /l\.expires_at is null or l\.expires_at > now\(\)/i);
  assert.match(migration, /revoke all on table public\.recent_listing_views from anon/i);
});

test("seller follow edges stay private while counts remain public", async () => {
  const migration = await read(migrationPath);
  const summaryReturnColumns =
    migration.match(
      /create or replace function public\.rawaj_get_seller_follow_summary_v1[\s\S]*?returns table\s*\(([\s\S]*?)\)\s*language/i,
    )?.[1] ?? "";

  assert.match(migration, /create table if not exists public\.seller_follows/i);
  assert.match(migration, /constraint seller_follows_not_self/i);
  assert.match(migration, /using \(auth\.uid\(\) = follower_user_id\)/i);
  assert.match(migration, /rawaj_set_seller_follow_v1/i);
  assert.match(migration, /rawaj_get_seller_follow_summary_v1/i);
  assert.match(summaryReturnColumns, /follower_count bigint/i);
  assert.match(summaryReturnColumns, /is_following boolean/i);
  assert.doesNotMatch(summaryReturnColumns, /follower_user_id/i);
  assert.match(migration, /revoke all on table public\.seller_follows from anon/i);
});

test("recent views work for guests and synchronize after sign in", async () => {
  const [api, media, rail] = await Promise.all([read(apiPath), read(mediaPath), read(discoveryRailPath)]);

  assert.match(api, /rawaj_recent_listing_views_v1/);
  assert.match(api, /recordLocalRecentView/);
  assert.match(api, /syncAnonymousRecentListingViews/);
  assert.match(api, /rawaj_record_recent_listing_view_v1/);
  assert.match(api, /fetchRecentListingViews/);
  assert.match(api, /clearRecentListingViews/);
  assert.match(media, /syncAnonymousRecentListingViews\(userId\)/);
  assert.match(media, /recordRecentListingView\(userId, listingId\)/);
  assert.match(rail, /شوهد مؤخرًا/);
  assert.match(rail, /مسح السجل/);
});

test("seller follow control is available on listing and storefront surfaces", async () => {
  const [api, button, sellerCard, storefront] = await Promise.all([
    read(apiPath),
    read(followButtonPath),
    read(sellerCardPath),
    read(storefrontPath),
  ]);

  assert.match(api, /fetchSellerFollowSummary/);
  assert.match(api, /setSellerFollow/);
  assert.match(button, /writeInFlightRef/);
  assert.match(button, /aria-pressed=\{summary\.isFollowing\}/);
  assert.match(button, /to="\/login"/);
  assert.match(sellerCard, /<SellerFollowButton sellerId=\{listing\.ownerId\}/);
  assert.match(storefront, /<SellerFollowButton sellerId=\{sellerId\}/);
});
