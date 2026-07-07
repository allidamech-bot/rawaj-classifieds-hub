# RAWAJ Syria location data provenance

## Purpose

RAWAJ needs a deeper hierarchy than the legacy `governorates.districts_ar` arrays. The canonical model is `location_nodes`, an arbitrary-depth tree. Legacy governorate and district fields remain supported during rollout.

## Primary import source

- Source: GeoNames Syria country dump (`SY.zip`)
- Download: `https://download.geonames.org/export/dump/SY.zip`
- Format documentation: `https://download.geonames.org/export/dump/readme.txt`
- License: Creative Commons Attribution 4.0
- Attribution requirement: preserve GeoNames attribution anywhere the derived dataset is distributed as data.

The GeoNames documentation states that country files contain all features for the ISO country code, that the data is UTF-8 tab-delimited, and that administrative parentage for toponyms can be derived from admin codes. It also explicitly states that the data is provided without warranty of accuracy, timeliness, or completeness.

## Import method

1. Download `SY.zip` from GeoNames.
2. Extract `SY.txt` to `data/geonames/SY.txt`.
3. Run:

   ```bash
   node scripts/prepare-syria-geonames-locations.mjs --input data/geonames/SY.txt
   ```

4. Review the generated report:

   `data/locations/syria-geonames-location-report.json`

5. Reject the import if there are unresolved duplicate parent+slug keys or orphan parent references.
6. Review Arabic name coverage and spot-check paths before importing to Supabase.
7. Import the reviewed CSV with an upsert process keyed by `(external_source, external_id)`.

## Coverage policy

The import includes:

- administrative divisions represented by GeoNames `ADM1` through `ADM4` features;
- populated places in feature class `P`, excluding abandoned/historical populated-place feature codes explicitly filtered by the preparation script;
- Arabic-script aliases when present in the country dump alternates;
- coordinates and source IDs for traceability.

The import does **not** claim complete neighborhood coverage. Major urban neighborhoods should only be added from a separately documented, licensed source or through reviewed administrative curation.

## Hierarchy policy

- Administrative units are linked through their GeoNames admin code prefix.
- Populated places are attached to the deepest matching administrative feature available in the same source row.
- The application does not hardcode a fixed number of levels.
- A locality can therefore resolve through paths such as governorate → district → subdistrict → village when source data supports it.

## Mandatory review examples

Before a production cutover, verify that the imported data can represent and search expected Syrian paths, including:

- حمص → الحولة → تلذهب
- a structurally different path in دمشق or ريف دمشق
- a path in حلب
- a path in الحسكة or دير الزور

These examples are validation targets, not hardcoded records. A path must emerge from reviewed source data or approved curation. If a source cannot represent a known path, the gap must be recorded and corrected with documented provenance.

## Legacy compatibility

- `governorates` remains in place.
- `governorates.districts_ar` remains in place.
- `listings.governorate_id` remains required under the current schema.
- `listings.district_ar` remains a fallback.
- `listings.location_node_id` is nullable and canonical only when present.

This allows old listings and old URLs to continue working while new listings gain precise location selection.

## No fake completeness

Do not label RAWAJ location data as “all villages of Syria” until an actual imported dataset has passed automated validation, manual spot checks, and gap review. The schema and importer support Syria-wide depth; completeness is a property of the reviewed imported dataset, not of the code alone.
