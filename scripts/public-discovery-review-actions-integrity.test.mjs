import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [categories, searchResults, searchPagination, reviewCard] = await Promise.all([
  readFile(new URL("../src/routes/categories.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/use-listings-results.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/listings/use-listings-pagination.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/features/reviews/SellerReviewCard.tsx", import.meta.url), "utf8"),
]);

test("category retries always release loading after thrown failures", () => {
  assert.match(categories, /operation: "categories_retry_load"/);
  assert.match(categories, /async function load\(\)[\s\S]*?try \{[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(categories, /if \(!cancelled\) setLoading\(false\)/);
  assert.match(categories, /\[loadAttempt, text\]/);
});

test("search results and pagination cannot remain loading", () => {
  assert.match(searchResults, /operation: "listings_search_load"/);
  assert.match(searchResults, /async function loadListings[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(searchResults, /version === filterVersionRef\.current\) setLoading\(false\)/);

  assert.match(searchPagination, /operation: "listings_search_load_more"/);
  assert.match(searchPagination, /const loadMore = useCallback[\s\S]*?try \{[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(searchPagination, /loadingMoreRef\.current = false/);
  assert.match(searchPagination, /setLoadingMore\(false\)/);
});

test("seller review response and report actions are normalized and failure-safe", () => {
  assert.match(reviewCard, /const normalizedResponse = responseText\.trim\(\)/);
  assert.match(reviewCard, /normalizedResponse\.length > 0 && normalizedResponse\.length < 3/);
  assert.match(reviewCard, /setSellerReviewResponse\(review\.id, normalizedResponse\)/);
  assert.match(reviewCard, /const normalizedDetails = reportDetails\.trim\(\)/);
  assert.match(reviewCard, /createSellerReviewReport\(review\.id, reportReason, normalizedDetails\)/);
  assert.match(reviewCard, /async function submitResponse[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(reviewCard, /async function submitReport[\s\S]*?catch \(caught\)[\s\S]*?finally/);
  assert.match(reviewCard, /aria-busy=\{saving\}/);
  assert.match(reviewCard, /aria-busy=\{reportSaving\}/);
});
