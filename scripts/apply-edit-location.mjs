import fs from "node:fs";

const path = "src/routes/profile/listings.$id.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement) {
  if (!source.includes(search)) throw new Error("Expected edit location block not found");
  source = source.replace(search, replacement);
}

replaceOnce(
  `} from "@/features/listing-studio/listing-studio";\n`,
  `} from "@/features/listing-studio/listing-studio";\nimport { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";\n`,
);
replaceOnce(
  `import { categoryName, governorateName } from "@/lib/i18n";\n`,
  `import { categoryName, governorateName } from "@/lib/i18n";\nimport { fetchListingLocationNodeId } from "@/lib/api/listing-location-read";\n`,
);
replaceOnce(
  `  const [district, setDistrict] = useState("");\n`,
  `  const [district, setDistrict] = useState("");\n  const [locationNodeId, setLocationNodeId] = useState("");\n`,
);
replaceOnce(
  `      const [listingResult, refsResult] = await Promise.all([\n        fetchOwnerListingDetail(profileId, id),\n        Promise.all([\n`,
  `      const [listingResult, locationResult, refsResult] = await Promise.all([\n        fetchOwnerListingDetail(profileId, id),\n        fetchListingLocationNodeId(profileId, id),\n        Promise.all([\n`,
);
replaceOnce(
  `      setGovernorateId(listingResult.data.governorateId);\n      setDistrict(listingResult.data.districtAr ?? "");\n`,
  `      setGovernorateId(listingResult.data.governorateId);\n      setDistrict(listingResult.data.districtAr ?? "");\n      setLocationNodeId(locationResult.ok ? locationResult.data ?? "" : "");\n`,
);
replaceOnce(
  `      districtAr: district || undefined,\n`,
  `      districtAr: locationNodeId ? \`@\${locationNodeId}\` : district || undefined,\n`,
);
replaceOnce(
  `    district,\n    contactName,\n`,
  `    district,\n    locationNodeId,\n    contactName,\n`,
);
replaceOnce(
  `      districtAr: district || undefined,\n`,
  `      districtAr: locationNodeId ? \`@\${locationNodeId}\` : district || undefined,\n`,
);
replaceOnce(
  `    district,\n    contactName,\n`,
  `    district,\n    locationNodeId,\n    contactName,\n`,
);
replaceOnce(
  `              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">\n                <Field label={text("المحافظة", "Governorate")}>\n                  <select\n                    value={governorateId}\n                    onChange={(e) => {\n                      setGovernorateId(e.target.value);\n                      setDistrict("");\n                    }}\n                    className="input"\n                    disabled={!isEditable}\n                  >\n                    <option value="">{text("اختر", "Choose")}</option>\n                    {governorates.map((item) => (\n                      <option key={item.id} value={item.id}>\n                        {governorateName(item.id, item.nameAr, language)}\n                      </option>\n                    ))}\n                  </select>\n                </Field>\n                <Field label={text("المنطقة", "District")}>\n                  <select\n                    value={district}\n                    onChange={(e) => setDistrict(e.target.value)}\n                    disabled={!isEditable || !governorate}\n                    className="input disabled:opacity-50"\n                  >\n                    <option value="">{text("اختر", "Choose")}</option>\n                    {governorate?.districtsAr.map((item) => (\n                      <option key={item} value={item}>\n                        {item}\n                      </option>\n                    ))}\n                  </select>\n                </Field>\n              </div>\n`,
  `              <div className="mt-3">\n                <Field label={text("الموقع", "Location")}>\n                  <CanonicalLocationSelector\n                    value={locationNodeId || null}\n                    disabled={!isEditable}\n                    onChange={(id, node) => {\n                      setLocationNodeId(id ?? "");\n                      if (node?.legacyGovernorateId) {\n                        setGovernorateId(node.legacyGovernorateId);\n                      }\n                      setDistrict(node?.legacyDistrictAr ?? "");\n                    }}\n                  />\n                </Field>\n                {!locationNodeId && district ? (\n                  <p className="mt-2 text-xs text-muted-foreground">\n                    {text("الموقع القديم المحفوظ: ", "Saved legacy location: ")}\n                    {district}\n                  </p>\n                ) : null}\n              </div>\n`,
);

fs.writeFileSync(path, source);
console.log("Edit location integration patch applied.");
