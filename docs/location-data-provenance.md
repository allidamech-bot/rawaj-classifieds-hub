# RAWAJ Syria location data provenance

## Purpose

RAWAJ needs a deeper hierarchy than the legacy `governorates.districts_ar` arrays. The canonical model is `location_nodes`, an arbitrary-depth tree. Legacy governorate and district fields remain supported during rollout.

## Source priority

RAWAJ does not treat one global gazetteer as authoritative for all Syrian location levels.

1. **Formal administrative hierarchy:** OCHA/HDX COD-AB Syria is the preferred primary source for governorate, district, and subdistrict relationships and P-codes where available.
2. **Locality breadth:** Syria Humanitarian Atlas is the preferred locality/P-code candidate where an exact export, source date, and reuse terms have been captured and reviewed.
3. **Secondary verification:** ReliefWeb / Whole of Syria datasets and maps may be used for cross-checking source vintages and hierarchy.
4. **Supplemental aliases and coordinates:** GeoNames may supplement transliterations, alternate names, and coordinates. It must not silently override a reviewed P-code hierarchy.
5. **Supplemental local detail:** OpenStreetMap or curated marketplace areas may be considered only with separate provenance and license review.

The existing repository audit at `docs/locations/syria-source-audit.md` remains the governing source-selection policy.

## Primary P-code preparation flow

Use a reviewed CSV export with at least:

```text
pcode,parent_pcode,name_ar,name_en,type,country_code,latitude,longitude,aliases_ar,aliases_en,source_date
```

Then run:

```bash
node scripts/prepare-syria-pcode-locations.mjs \
  --input data/locations/syria-pcodes-source.csv \
  --source ocha-cod-ab-syria \
  --source-date YYYY-MM-DD
```

The script emits deterministic JSON/CSV plus a validation report. It blocks a clean result when it finds duplicate P-codes, orphan parent P-codes, invalid node types, or duplicate parent+slug keys.

## Supplemental GeoNames flow

GeoNames is supplemental, not the primary formal hierarchy.

- Source: GeoNames Syria country dump (`SY.zip`)
- Download: `https://download.geonames.org/export/dump/SY.zip`
- Documentation: `https://download.geonames.org/export/dump/readme.txt`
- License: Creative Commons Attribution 4.0

Prepare review artifacts with:

```bash
node scripts/prepare-syria-geonames-locations.mjs --input data/geonames/SY.txt
```

GeoNames-derived data should be reconciled against primary P-code records by source IDs, hierarchy context, aliases, and coordinates. Do not merge solely by matching a name.

## Hierarchy policy

- The application does not hardcode a fixed number of levels.
- Parent/child relationships define hierarchy.
- Formal admin records preserve verified P-codes where the source provides them.
- Populated places and marketplace areas must not be mislabeled as formal districts or subdistricts.
- Missing P-codes are not fabricated.
- Ambiguous same-name locations remain separate until resolved by hierarchy/source evidence.

## Import safety

1. Download and archive the exact source file.
2. Record source URL, source date/version, and license/reuse terms.
3. Run the preparation script in `--dry-run` mode first.
4. Review duplicate/orphan reports.
5. Spot-check Arabic names and parent chains.
6. Reconcile imported governorates to existing RAWAJ governorate IDs.
7. Import using upsert semantics keyed by `(external_source, external_id)`.
8. Do not delete unmatched production nodes automatically.
9. Do not overwrite legacy listing locations.

## Mandatory review examples

Before a production cutover, verify that reviewed source data can represent expected Syrian paths, including:

- حمص → الحولة → تلذهب
- at least one structurally different path in دمشق or ريف دمشق
- at least one path in حلب
- at least one path in الحسكة or دير الزور

These are validation targets, not hardcoded records. A path must emerge from reviewed source data or approved curation with provenance.

## Legacy compatibility

- `governorates` remains in place.
- `governorates.districts_ar` remains in place.
- `listings.governorate_id` remains required under the current schema.
- `listings.district_ar` remains a fallback.
- `listings.location_node_id` is nullable and canonical only when present.
- Deep location path labels can be exposed through the compatibility RPC while old values remain selectable.

## No fake completeness

Do not label RAWAJ location data as “all villages of Syria” until an actual imported dataset has passed automated validation, source reconciliation, manual spot checks, and gap review. The schema and importers support Syria-wide depth; completeness is a property of the reviewed imported dataset, not of the code alone.
