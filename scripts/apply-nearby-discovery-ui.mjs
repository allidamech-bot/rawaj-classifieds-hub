import { readFile, writeFile, unlink } from "node:fs/promises";

const path = "src/routes/listings.index.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(before, after) {
  if (!source.includes(before)) throw new Error(`Missing patch anchor: ${before.slice(0, 80)}`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { RealListingCard } from "@/features/listings/RealListingCard";\n',
  'import { RealListingCard } from "@/features/listings/RealListingCard";\nimport { NearbyDiscoveryControl } from "@/features/listings/NearbyDiscoveryControl";\nimport { useNearbyDiscovery } from "@/features/listings/use-nearby-discovery";\n',
);

replaceOnce(
  '  const error = referencesError ?? resultsError;\n  const loading = referencesLoading || (!referencesError && resultsLoading);\n',
  `  const nearbyFilters = useMemo(\n    () => ({\n      categoryId: selectedCategory?.id,\n      subcategoryId: effectiveSubcategoryId || undefined,\n      governorateId: govId || undefined,\n      priceMin: parsedPriceMin,\n      priceMax: parsedPriceMax,\n      priceType: priceType || undefined,\n      condition: usesGlobalCondition ? globalCondition || undefined : undefined,\n    }),\n    [\n      effectiveSubcategoryId,\n      globalCondition,\n      govId,\n      parsedPriceMax,\n      parsedPriceMin,\n      priceType,\n      selectedCategory?.id,\n      usesGlobalCondition,\n    ],\n  );\n  const nearby = useNearbyDiscovery(nearbyFilters);\n  const visibleItems = nearby.active ? nearby.items.map((entry) => entry.listing) : items;\n  const nearbyDistanceById = useMemo(\n    () => new Map(nearby.items.map((entry) => [entry.listing.id, entry.distanceKm])),\n    [nearby.items],\n  );\n\n  const error = nearby.error === \"request_failed\" ? resultsError : referencesError ?? resultsError;\n  const loading = nearby.loading || referencesLoading || (!referencesError && resultsLoading);\n`,
);

replaceOnce('          resultCount={items.length}\n', '          resultCount={visibleItems.length}\n');
replaceOnce(
  '        <QuickFilterRail\n',
  `        <NearbyDiscoveryControl\n          active={nearby.active}\n          loading={nearby.loading}\n          error={nearby.error}\n          radiusKm={nearby.radiusKm}\n          resultCount={nearby.items.length}\n          onActivate={() => void nearby.activate()}\n          onRadiusChange={nearby.setRadiusKm}\n          onClear={nearby.clear}\n          text={text}\n        />\n\n        <QuickFilterRail\n`,
);
replaceOnce('`${items.length} نتيجة محملة حاليًا`', '`${visibleItems.length} نتيجة محملة حاليًا`');
replaceOnce('`${items.length} currently loaded results`', '`${visibleItems.length} currently loaded results`');
replaceOnce('        ) : items.length === 0 ? (\n', '        ) : visibleItems.length === 0 ? (\n');
replaceOnce(
  '              {items.map((listing) => (\n                <RealListingCard key={listing.id} listing={listing} />\n              ))}\n',
  `              {visibleItems.map((listing) => {\n                const distanceKm = nearbyDistanceById.get(listing.id);\n                return (\n                  <RealListingCard\n                    key={listing.id}\n                    listing={listing}\n                    action={\n                      distanceKm !== undefined ? (\n                        <span className=\"rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-primary\">\n                          {distanceKm} {text(\"كم تقريبًا\", \"km away\")}\n                        </span>\n                      ) : undefined\n                    }\n                  />\n                );\n              })}\n`,
);
replaceOnce('            {nextCursor && (\n', '            {!nearby.active && nextCursor && (\n');

await writeFile(path, source);
await unlink(new URL(import.meta.url));
