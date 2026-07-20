import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [favorites, favoriteCard, savedSearches] = await Promise.all([
  readFile(new URL("../src/routes/favorites.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/favorites/FavoriteListingCard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/saved-searches.tsx", import.meta.url), "utf8"),
]);

test("favorites loading and removal always recover UI state", () => {
  assert.match(favorites, /operation: "favorite_journey_load"/);
  assert.match(favorites, /finally \{[\s\S]*?setLoading\(false\);/);
  assert.match(favorites, /const \[removingIds, setRemovingIds\]/);
  assert.match(favorites, /if \(removeInFlightRef\.current\.has\(scopeKey\)\) return;/);
  assert.match(favorites, /catch \(caught\)[\s\S]*?تعذر إزالة الإعلان من المفضلة/);
  assert.match(
    favorites,
    /finally \{[\s\S]*?removeInFlightRef\.current\.delete\(scopeKey\);[\s\S]*?next\.delete\(listingId\)/,
  );
  assert.match(favorites, /removing=\{removingIds\.has\(item\.listingId\)\}/);
  assert.match(favoriteCard, /disabled=\{removing\}/);
  assert.match(favoriteCard, /aria-busy=\{removing\}/);
});

test("saved searches load, create, update, and delete are failure-safe", () => {
  assert.match(savedSearches, /operation: "saved_searches_load"/);
  assert.match(savedSearches, /const \[creating, setCreating\] = useState\(false\);/);
  assert.match(savedSearches, /const \[deletingIds, setDeletingIds\]/);
  assert.match(savedSearches, /creatingSearchProfilesRef\.current\.has\(currentProfileId\)/);
  assert.match(savedSearches, /catch \{[\s\S]*?saveLocally\(\)/);
  assert.match(savedSearches, /catch \(caught\)[\s\S]*?setItems\(previous\)/);
  assert.match(savedSearches, /deletingSearchScopesRef\.current\.has\(scopeKey\)/);
  assert.match(
    savedSearches,
    /finally \{[\s\S]*?deletingSearchScopesRef\.current\.delete\(scopeKey\);[\s\S]*?next\.delete\(id\)/,
  );
  assert.match(savedSearches, /aria-busy=\{creating\}/);
  assert.match(savedSearches, /removeDisabled=\{deletingIds\.has\(item\.id\)\}/);
  assert.match(savedSearches, /disabled=\{removeDisabled\}/);
});
