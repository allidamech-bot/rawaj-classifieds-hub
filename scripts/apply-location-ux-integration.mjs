import fs from "node:fs";

function replaceOnce(path, search, replacement) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(search)) throw new Error(`Expected block not found in ${path}`);
  fs.writeFileSync(path, source.replace(search, replacement));
}

const addListing = "src/routes/add-listing.tsx";
replaceOnce(
  addListing,
  `} from "@/features/listing-studio/listing-studio";\n`,
  `} from "@/features/listing-studio/listing-studio";\nimport { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";\n`,
);
replaceOnce(
  addListing,
  `  const [district, setDistrict] = useState("");\n`,
  `  const [district, setDistrict] = useState("");\n  const [locationNodeId, setLocationNodeId] = useState("");\n  const [locationLabel, setLocationLabel] = useState("");\n`,
);
replaceOnce(
  addListing,
  `        !!governorateId && !!district,\n      ].filter(Boolean).length * 20,\n    [categoryId, title, description, price, priceType, governorateId, district],\n`,
  `        !!governorateId && (!!locationNodeId || !!district),\n      ].filter(Boolean).length * 20,\n    [\n      categoryId,\n      title,\n      description,\n      price,\n      priceType,\n      governorateId,\n      district,\n      locationNodeId,\n    ],\n`,
);
replaceOnce(
  addListing,
  `      governorateId,\n      district,\n      categoryFieldKind,\n`,
  `      governorateId,\n      district: locationNodeId ? \`@\${locationNodeId}\` : district,\n      categoryFieldKind,\n`,
);
replaceOnce(
  addListing,
  `      districtAr: district,\n`,
  `      districtAr: locationNodeId ? \`@\${locationNodeId}\` : district,\n`,
);
replaceOnce(
  addListing,
  `                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">\n                      <Field\n                        label={text("المحافظة", "Governorate")}\n                        error={fieldErrors.governorateId}\n                      >\n                        <select\n                          value={governorateId}\n                          onChange={(event) => {\n                            setGovernorateId(event.target.value);\n                            setDistrict("");\n                          }}\n                          className="input"\n                          data-first-invalid={Boolean(fieldErrors.governorateId)}\n                        >\n                          <option value="">{text("اختر", "Choose")}</option>\n                          {governorates.map((item) => (\n                            <option key={item.id} value={item.id}>\n                              {governorateName(item.id, item.nameAr, language)}\n                            </option>\n                          ))}\n                        </select>\n                      </Field>\n                      <Field label={text("المنطقة", "District")} error={fieldErrors.district}>\n                        <select\n                          value={district}\n                          onChange={(event) => setDistrict(event.target.value)}\n                          disabled={!governorate}\n                          className="input disabled:opacity-50"\n                          data-first-invalid={Boolean(fieldErrors.district)}\n                        >\n                          <option value="">{text("اختر", "Choose")}</option>\n                          {governorate?.districtsAr.map((item) => (\n                            <option key={item} value={item}>\n                              {item}\n                            </option>\n                          ))}\n                        </select>\n                      </Field>\n                    </div>\n`,
  `                    <Field\n                      label={text("الموقع", "Location")}\n                      error={fieldErrors.governorateId ?? fieldErrors.district}\n                    >\n                      <CanonicalLocationSelector\n                        onChange={(id, node) => {\n                          setLocationNodeId(id ?? "");\n                          setLocationLabel(\n                            node\n                              ? language === "en"\n                                ? node.nameEn || node.nameAr\n                                : node.nameAr\n                              : "",\n                          );\n                          if (node?.legacyGovernorateId) {\n                            setGovernorateId(node.legacyGovernorateId);\n                          } else if (!id) {\n                            setGovernorateId("");\n                          }\n                          setDistrict(node?.legacyDistrictAr ?? "");\n                        }}\n                      />\n                    </Field>\n                    {locationLabel ? (\n                      <p className="text-xs text-muted-foreground">{locationLabel}</p>\n                    ) : null}\n`,
);
replaceOnce(
  addListing,
  `                      <ReviewRow\n                        label={text("المحافظة", "Governorate")}\n                        value={\n                          governorate\n                            ? governorateName(governorate.id, governorate.nameAr, language)\n                            : "-"\n                        }\n                      />\n                      <ReviewRow label={text("المنطقة", "District")} value={district || "-"} />\n`,
  `                      <ReviewRow\n                        label={text("الموقع", "Location")}\n                        value={\n                          locationLabel ||\n                          district ||\n                          (governorate\n                            ? governorateName(governorate.id, governorate.nameAr, language)\n                            : "-")\n                        }\n                      />\n`,
);

const selector = "src/features/locations/CanonicalLocationSelector.tsx";
replaceOnce(
  selector,
  `    setError(null);\n    setLevels(next);\n    onChange(selected?.id ?? null, selected);\n    if (!selected) return;\n\n    const children = await fetchLocationChildren(selected.id);\n`,
  `    setError(null);\n    setLevels(next);\n    if (!selected) {\n      const previous = next\n        .slice(0, index)\n        .map((level) => level.options.find((option) => option.id === level.selectedId))\n        .filter((node): node is CanonicalLocationNode => Boolean(node))\n        .at(-1);\n      onChange(previous?.id ?? null, previous ?? null);\n      return;\n    }\n\n    onChange(selected.id, selected);\n    const children = await fetchLocationChildren(selected.id);\n`,
);

const listingsApi = "src/lib/api/listings.ts";
replaceOnce(
  listingsApi,
  `import { buildListingImagePath, listingImagesBucket, validateImageFile } from "@/lib/api/storage";\n`,
  `import { resolveListingLocationWrite } from "@/lib/api/listing-location-write";\nimport { buildListingImagePath, listingImagesBucket, validateImageFile } from "@/lib/api/storage";\n`,
);
replaceOnce(
  listingsApi,
  `  if (payload.districtAr !== undefined) updateData.district_ar = payload.districtAr;\n`,
  `  if (payload.districtAr !== undefined) {\n    const locationWrite = await resolveListingLocationWrite(\n      clientResult.data,\n      payload.governorateId ?? rowString(existing as Record<string, unknown>, "governorate_id"),\n      payload.districtAr,\n    );\n    if (!locationWrite.ok) return locationWrite;\n    updateData.district_ar = locationWrite.data.districtAr;\n    if (locationWrite.data.locationNodeId !== undefined) {\n      updateData.location_node_id = locationWrite.data.locationNodeId;\n    }\n  }\n`,
);
replaceOnce(
  listingsApi,
  `  if (payload.districtAr !== undefined) updateData.district_ar = payload.districtAr;\n`,
  `  if (payload.districtAr !== undefined) {\n    const locationWrite = await resolveListingLocationWrite(\n      clientResult.data,\n      payload.governorateId ?? rowString(existing as Record<string, unknown>, "governorate_id"),\n      payload.districtAr,\n    );\n    if (!locationWrite.ok) return locationWrite;\n    updateData.district_ar = locationWrite.data.districtAr;\n    if (locationWrite.data.locationNodeId !== undefined) {\n      updateData.location_node_id = locationWrite.data.locationNodeId;\n    }\n  }\n`,
);
replaceOnce(
  listingsApi,
  `  const description = payload.description.trim();\n  const districtAr = payload.districtAr?.trim() || null;\n  const contactName = payload.contactName?.trim() || null;\n`,
  `  const description = payload.description.trim();\n  const contactName = payload.contactName?.trim() || null;\n`,
);
replaceOnce(
  listingsApi,
  `  const insertPayload = {\n`,
  `  const locationWrite = await resolveListingLocationWrite(\n    clientResult.data,\n    payload.governorateId,\n    payload.districtAr,\n  );\n  if (!locationWrite.ok) return locationWrite;\n\n  const insertPayload = {\n`,
);
replaceOnce(
  listingsApi,
  `    status,\n    district_ar: districtAr,\n`,
  `    status,\n    location_node_id: locationWrite.data.locationNodeId ?? null,\n    district_ar: locationWrite.data.districtAr,\n`,
);

const canonicalQuery = "src/lib/api/location-aware-listings-v2.ts";
replaceOnce(
  canonicalQuery,
  `import { escapePostgrestSearchTerm, getClient, mapError } from "@/lib/api/shared";\n`,
  `import {\n  escapePostgrestFilterValue,\n  escapePostgrestSearchTerm,\n  getClient,\n  mapError,\n} from "@/lib/api/shared";\n`,
);
replaceOnce(
  canonicalQuery,
  `  else query = query.order("created_at", { ascending: false }).order("id", { ascending: false });\n\n  const safePageSize = Math.max(1, Math.min(pageSize, 50));\n`,
  `  else query = query.order("created_at", { ascending: false }).order("id", { ascending: false });\n\n  query = applyCursor(query, cursor);\n\n  const safePageSize = Math.max(1, Math.min(pageSize, 50));\n`,
);
replaceOnce(
  canonicalQuery,
  `function buildCursor(sort: string, listing: ClassifiedListing): ListingCursor {\n`,
  `function applyCursor<T extends { or(filters: string): T }>(\n  query: T,\n  cursor: ListingCursor | null,\n): T {\n  if (!cursor) return query;\n  const id = escapePostgrestFilterValue(cursor.id);\n\n  if (cursor.type === "latest") {\n    const created = escapePostgrestFilterValue(cursor.created_at);\n    return query.or(\`created_at.lt.\${created},and(created_at.eq.\${created},id.lt.\${id})\`);\n  }\n\n  if (cursor.type === "featured") {\n    const created = escapePostgrestFilterValue(cursor.created_at);\n    return cursor.is_featured\n      ? query.or(\n          \`is_featured.eq.false,and(is_featured.eq.true,created_at.lt.\${created}),and(is_featured.eq.true,created_at.eq.\${created},id.lt.\${id})\`,\n        )\n      : query.or(\n          \`and(is_featured.eq.false,created_at.lt.\${created}),and(is_featured.eq.false,created_at.eq.\${created},id.lt.\${id})\`,\n        );\n  }\n\n  if (cursor.price === null) return query.or(\`and(price.is.null,id.gt.\${id})\`);\n  const price = escapePostgrestFilterValue(String(cursor.price));\n  const operator = cursor.type === "cheapest" ? "gt" : "lt";\n  return query.or(\`price.\${operator}.\${price},price.is.null,and(price.eq.\${price},id.gt.\${id})\`);\n}\n\nfunction buildCursor(sort: string, listing: ClassifiedListing): ListingCursor {\n`,
);

console.log("Location UX integration patch applied.");
