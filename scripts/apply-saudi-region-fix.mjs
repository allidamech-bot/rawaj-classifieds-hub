import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  const slash = path.lastIndexOf("/");
  if (slash > 0) fs.mkdirSync(path.slice(0, slash), { recursive: true });
  fs.writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`);
}

function replaceString(path, search, replacement, expected = 1) {
  const original = read(path);
  const count = original.split(search).length - 1;
  if (count !== expected) {
    throw new Error(`${path}: expected ${expected} occurrences, found ${count}`);
  }
  write(path, original.split(search).join(replacement));
}

function replaceRegex(path, regex, replacement, expected = 1) {
  const original = read(path);
  const matches = [...original.matchAll(regex)];
  if (matches.length !== expected) {
    throw new Error(`${path}: expected ${expected} regex matches, found ${matches.length}`);
  }
  write(path, original.replace(regex, replacement));
}

write(
  "src/features/locations/SaudiRegionCitySelector.tsx",
  `import type { ClassifiedGovernorate } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

export function SaudiRegionCitySelector({
  governorates,
  governorateId,
  districtAr,
  onChange,
  disabled = false,
}: {
  governorates: ClassifiedGovernorate[];
  governorateId: string;
  districtAr: string;
  onChange: (governorateId: string, districtAr: string) => void;
  disabled?: boolean;
}) {
  const { text } = useUiPreferences();
  const selectedGovernorate =
    governorates.find((governorate) => governorate.id === governorateId) ?? null;
  const cities = selectedGovernorate?.districtsAr ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-saudi-region-city-selector="true">
      <select
        value={governorateId}
        onChange={(event) => onChange(event.target.value, "")}
        disabled={disabled}
        aria-label={text("المنطقة", "Region")}
        data-saudi-region-select="true"
        className="input"
      >
        <option value="">{text("اختر المنطقة", "Choose region")}</option>
        {governorates.map((governorate) => (
          <option key={governorate.id} value={governorate.id}>
            {governorate.nameAr}
          </option>
        ))}
      </select>

      <select
        value={districtAr}
        onChange={(event) => onChange(governorateId, event.target.value)}
        disabled={disabled || !selectedGovernorate || cities.length === 0}
        aria-label={text("المدينة", "City")}
        data-saudi-city-select="true"
        className="input"
      >
        <option value="">
          {selectedGovernorate
            ? text("اختر المدينة", "Choose city")
            : text("اختر المنطقة أولاً", "Choose a region first")}
        </option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
    </div>
  );
}
`,
);

const addListingPath = "src/routes/add-listing.tsx";
replaceString(
  addListingPath,
  'import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";',
  'import { SaudiRegionCitySelector } from "@/features/locations/SaudiRegionCitySelector";',
);
replaceRegex(
  addListingPath,
  /<CanonicalLocationSelector\n\s+value=\{locationNodeId\}\n\s+onChange=\{\(id, node\) => \{[\s\S]*?\n\s+\}\}\n\s+\/>/g,
  `<SaudiRegionCitySelector
                        governorates={governorates}
                        governorateId={governorateId}
                        districtAr={district}
                        onChange={(nextGovernorateId, nextDistrictAr) => {
                          setGovernorateId(nextGovernorateId);
                          setDistrict(nextDistrictAr);
                          setLocationNodeId("");
                          setLocationNodeType("");
                          setLocationLabel(
                            nextDistrictAr ||
                              governorates.find((item) => item.id === nextGovernorateId)?.nameAr ||
                              "",
                          );
                        }}
                      />`,
);

const listingsPath = "src/routes/listings.index.tsx";
replaceString(
  listingsPath,
  'import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";',
  'import { SaudiRegionCitySelector } from "@/features/locations/SaudiRegionCitySelector";',
);
replaceString(
  listingsPath,
  'import { fetchLocationPath, type CanonicalLocationNode } from "@/lib/api/location-taxonomy";',
  'import { fetchLocationPath } from "@/lib/api/location-taxonomy";',
);
replaceRegex(
  listingsPath,
  /\n  function handleCanonicalLocationChange\(id: string \| null, node: CanonicalLocationNode \| null\) \{[\s\S]*?\n  \}\n\n  function restoreFilterDraftFromSearch/g,
  "\n\n  function restoreFilterDraftFromSearch",
);
replaceRegex(
  listingsPath,
  /<CanonicalLocationSelector\n\s+value=\{canonicalLocationNodeId \|\| null\}\n\s+onChange=\{handleCanonicalLocationChange\}\n\s+\/>/g,
  `<SaudiRegionCitySelector
                    governorates={governorates}
                    governorateId={govId}
                    districtAr={canonicalLocationNodeId ? "" : districtAr}
                    onChange={(nextGovernorateId, nextDistrictAr) => {
                      setGovId(nextGovernorateId);
                      setDistrictAr(nextDistrictAr);
                      setLocationLabel(
                        nextDistrictAr ||
                          governorates.find((item) => item.id === nextGovernorateId)?.nameAr ||
                          "",
                      );
                    }}
                  />`,
  2,
);
replaceRegex(
  listingsPath,
  /\n\s+\{districtAr && !canonicalLocationNodeId \? \([\s\S]*?\n\s+\) : null\}/g,
  "",
  2,
);

const editPath = "src/routes/profile/listings.$id.tsx";
replaceString(
  editPath,
  'import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";',
  'import { SaudiRegionCitySelector } from "@/features/locations/SaudiRegionCitySelector";',
);
replaceRegex(
  editPath,
  /<CanonicalLocationSelector\n\s+value=\{locationNodeId \|\| null\}\n\s+disabled=\{!isEditable\}\n\s+onChange=\{\(id, node\) => \{[\s\S]*?\n\s+\}\}\n\s+\/>/g,
  `<SaudiRegionCitySelector
                    governorates={governorates}
                    governorateId={governorateId}
                    districtAr={district}
                    disabled={!isEditable}
                    onChange={(nextGovernorateId, nextDistrictAr) => {
                      setGovernorateId(nextGovernorateId);
                      setDistrict(nextDistrictAr);
                      setLocationNodeId("");
                      setLocationNodeType("");
                    }}
                  />`,
);
replaceRegex(
  editPath,
  /\n\s+\{!locationNodeId && district \? \([\s\S]*?\n\s+\) : null\}/g,
  "",
);

replaceString(
  "src/features/locations/use-location-levels.ts",
  'const LOCATION_ROOT_SOURCE_PRIORITY = ["ocha-hdx-cod-ab-syr", "iso3166"];',
  'const LOCATION_ROOT_SOURCE_PRIORITY = ["iso3166"];',
);
replaceString(
  "src/features/locations/use-location-levels.ts",
  'const roots = await fetchLocationRoots("SY");',
  'const roots = await fetchLocationRoots("SA");',
);
replaceString(
  "src/lib/api/location-taxonomy.ts",
  'countryCode = "SY",',
  'countryCode = "SA",',
);
replaceString(
  "src/lib/public-data/cloudflare-client.ts",
  'country = "SY",',
  'country = "SA",',
);

write(
  "scripts/saudi-region-city-contract.test.mjs",
  `import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(path, "utf8");

test("Saudi posting and search surfaces use the isolated region-city selector", () => {
  const component = read("src/features/locations/SaudiRegionCitySelector.tsx");
  assert.match(component, /data-saudi-region-select/);
  assert.match(component, /data-saudi-city-select/);
  assert.match(component, /governorate\.districtsAr/);

  for (const path of [
    "src/routes/add-listing.tsx",
    "src/routes/listings.index.tsx",
    "src/routes/profile/listings.$id.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /SaudiRegionCitySelector/);
    assert.doesNotMatch(source, /CanonicalLocationSelector/);
  }
});

test("Saudi canonical location defaults never request Syria", () => {
  const levels = read("src/features/locations/use-location-levels.ts");
  const api = read("src/lib/api/location-taxonomy.ts");
  const client = read("src/lib/public-data/cloudflare-client.ts");
  assert.match(levels, /fetchLocationRoots\("SA"\)/);
  assert.doesNotMatch(levels, /ocha-hdx-cod-ab-syr|fetchLocationRoots\("SY"\)/);
  assert.match(api, /countryCode = "SA"/);
  assert.match(client, /country = "SA"/);
});

test("Saudi references remain the authoritative region contract", () => {
  const references = read("src/lib/api/references.ts");
  const worker = read("cloudflare/worker/src/index.ts");
  assert.match(references, /result\.data\.governorates/);
  assert.match(worker, /governorates: \(results\[2\]\.results/);
});
`,
);

replaceString(
  "package.json",
  '    "test:location-classification": "node --test scripts/syria-location-type-classification.test.mjs",\n',
  '    "test:location-classification": "node --test scripts/syria-location-type-classification.test.mjs",\n    "test:saudi-location-regions": "node --test scripts/saudi-region-city-contract.test.mjs",\n',
);
