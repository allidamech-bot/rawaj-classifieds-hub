import fs from "node:fs";

function patch(path, search, replacement) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(search)) throw new Error(`Expected block not found in ${path}`);
  fs.writeFileSync(path, source.replace(search, replacement));
}

patch(
  "src/lib/classifieds-types.ts",
  `  governorateId: string;\n  governorateNameAr?: string;\n  title: string;\n`,
  `  governorateId: string;\n  governorateNameAr?: string;\n  locationNodeId?: string | null;\n  locationNameAr?: string;\n  locationNameEn?: string | null;\n  title: string;\n`,
);

patch(
  "src/lib/api/listings.ts",
  `    governorateId,\n    governorateNameAr: governorate?.nameAr,\n    title: rowString(row, "title"),\n`,
  `    governorateId,\n    governorateNameAr: governorate?.nameAr,\n    locationNodeId: rowNullableString(row, "location_node_id"),\n    title: rowString(row, "title"),\n`,
);

patch(
  "src/lib/api/listings.ts",
  `export async function hydrateListingsWithPrimaryImages(\n  client: SupabaseClient,\n  listings: ClassifiedListing[],\n): Promise<ClassifiedListing[]> {\n  if (listings.length === 0) return listings;\n\n  const images = await readListingImagesByListingIds(\n    client,\n    listings.map((listing) => listing.id),\n  );\n  if (images.length === 0) return listings;\n\n  const firstImageByListing = new Map<string, ListingImage>();\n  for (const image of images) {\n    if (!firstImageByListing.has(image.listingId)) {\n      firstImageByListing.set(image.listingId, image);\n    }\n  }\n\n  return listings.map((listing) => ({\n    ...listing,\n    primaryImageUrl: firstImageByListing.get(listing.id)?.publicUrl ?? null,\n  }));\n}\n`,
  `async function readListingLocationNamesByIds(\n  client: SupabaseClient,\n  locationNodeIds: string[],\n): Promise<Map<string, { nameAr: string; nameEn: string | null }>> {\n  const ids = [...new Set(locationNodeIds.filter(Boolean))];\n  if (ids.length === 0) return new Map();\n\n  const { data, error } = await client\n    .from("location_nodes")\n    .select("id,name_ar,name_en")\n    .in("id", ids);\n  if (error) return new Map();\n\n  return new Map(\n    ((data ?? []) as Record<string, unknown>[]).map((row) => [\n      rowString(row, "id"),\n      {\n        nameAr: rowString(row, "name_ar"),\n        nameEn: rowNullableString(row, "name_en"),\n      },\n    ]),\n  );\n}\n\nexport async function hydrateListingsWithPrimaryImages(\n  client: SupabaseClient,\n  listings: ClassifiedListing[],\n): Promise<ClassifiedListing[]> {\n  if (listings.length === 0) return listings;\n\n  const [images, locationNamesById] = await Promise.all([\n    readListingImagesByListingIds(\n      client,\n      listings.map((listing) => listing.id),\n    ),\n    readListingLocationNamesByIds(\n      client,\n      listings\n        .map((listing) => listing.locationNodeId)\n        .filter((id): id is string => Boolean(id)),\n    ),\n  ]);\n\n  const firstImageByListing = new Map<string, ListingImage>();\n  for (const image of images) {\n    if (!firstImageByListing.has(image.listingId)) {\n      firstImageByListing.set(image.listingId, image);\n    }\n  }\n\n  return listings.map((listing) => {\n    const location = listing.locationNodeId\n      ? locationNamesById.get(listing.locationNodeId)\n      : undefined;\n    return {\n      ...listing,\n      primaryImageUrl: firstImageByListing.get(listing.id)?.publicUrl ?? null,\n      locationNameAr: location?.nameAr,\n      locationNameEn: location?.nameEn ?? null,\n    };\n  });\n}\n`,
);

console.log("Canonical listing location metadata applied.");
