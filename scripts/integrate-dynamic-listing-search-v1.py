from pathlib import Path

path = Path("src/lib/api/listings.ts")
source = path.read_text(encoding="utf-8")

if "fetchDynamicFilteredPublicListings" in source:
    print("Dynamic listing search integration already present.")
    raise SystemExit(0)

import_marker = '''import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";
'''
import_replacement = '''import { fetchDynamicFilteredPublicListings } from "@/lib/api/dynamic-filtered-listings";
import { hasDynamicListingFilters } from "@/lib/api/dynamic-listing-search";
import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";
'''

if source.count(import_marker) != 1:
    raise SystemExit(f"dynamic search import marker count: {source.count(import_marker)}")
source = source.replace(import_marker, import_replacement, 1)

branch_marker = '''  filters = await hydrateSavedTaxonomyFilter(clientResult.data, filters);

  const canonicalListingIds = await resolveCanonicalTaxonomyListingIds(
'''
branch_replacement = '''  filters = await hydrateSavedTaxonomyFilter(clientResult.data, filters);

  if (hasDynamicListingFilters(filters)) {
    return fetchDynamicFilteredPublicListings(filters, cursor, pageSize, {
      mapListing,
      hydrateListingsWithPrimaryImages,
    });
  }

  const canonicalListingIds = await resolveCanonicalTaxonomyListingIds(
'''

if source.count(branch_marker) != 1:
    raise SystemExit(f"dynamic search branch marker count: {source.count(branch_marker)}")
source = source.replace(branch_marker, branch_replacement, 1)

path.write_text(source, encoding="utf-8")
print("Dynamic listing search integration completed.")
