# Syria Location Source Audit

Date: 2026-07-04

Status: corrected research audit only. No location data was written to production.

## Source Stack and Reconciliation Roles

| Source | Coverage | Admin level / feature type | P-code availability | Strengths | Weaknesses / concerns | Reconciliation role |
| --- | --- | --- | --- | --- | --- | --- |
| HDX / OCHA COD-AB Syria | Syria administrative boundaries | Admin 0-3 | Yes, for admin units where provided | Best base for formal governorate/district/subdistrict hierarchy; humanitarian standard | Dataset version/update date must be captured from downloaded resource; not a populated-place gazetteer | Primary formal admin source |
| Syria Humanitarian Atlas | Syria admin/locality atlas | Admin 1-4, including localities | Yes, per atlas claims | Publicly states 14 governorates, 61 districts, 272 subdistricts, 5596 localities; useful for localities | Needs exact dataset export/source date; may reflect humanitarian operational model | Primary locality/P-code candidate source |
| ReliefWeb / Whole of Syria data portal | Humanitarian datasets and maps | Varies | Varies | Cross-checks OCHA/partner datasets and maps | Not a single canonical database; source dates vary | Secondary verification |
| OpenStreetMap | Crowdsourced geographic features | Neighborhoods, roads, POIs, local areas, industrial zones, markets | No humanitarian P-codes | Rich local coverage and aliases | Crowdsourced, uneven, ODbL attribution/share-alike considerations | Supplemental aliases/locality geometry only |
| GeoNames | Global gazetteer | Populated places, alternate names, coordinates | No humanitarian P-codes | Downloadable, broad aliases/transliterations, CC BY attribution | Arabic names and hierarchy may be incomplete or inconsistent; not Syria-specific authority | Supplemental transliterations/coordinates |
| NGA GNS | Foreign geographic names | Geographic names | No humanitarian P-codes | Public foreign-name gazetteer | Not marketplace-specific; Arabic display validation still needed | Supplemental English/transliteration check |
| Local/manual review | Product owner/domain review | Marketplace local names | No | Captures colloquial names and market relevance | Must not override sourced admin hierarchy without notes | Final review for display/aliases |

Sources:

- HDX COD-AB Syria: https://data.humdata.org/dataset/cod-ab-syr
- Syria Humanitarian Atlas: https://humanitarianatlas.org/syria/
- OCHA P-codes overview: https://knowledge.base.unocha.org/wiki/spaces/imtoolbox/pages/222265609/P-codes
- ReliefWeb Whole of Syria data: https://response.reliefweb.int/whole-syria/data
- OpenStreetMap copyright/license: https://www.openstreetmap.org/copyright
- GeoNames: https://www.geonames.org/
- NGA GNS: https://geonames.nga.mil/geonames/GNSData/

## Administrative and Marketplace Levels

Do not collapse levels:

- `admin0`: country.
- `admin1`: governorate.
- `admin2`: district.
- `admin3`: subdistrict.
- `admin4_or_locality`: populated place/locality where source supports it.
- `marketplace_area`: user-facing neighborhood/suburb/industrial zone/market/camp/colloquial area.

`marketplace_area` is not automatically a formal admin unit.

## Corrected Source Findings

- HDX COD-AB is the preferred base for formal admin hierarchy, but not absolute truth for every marketplace locality.
- Humanitarian Atlas appears more appropriate for locality/P-code breadth, but exact export and source date must be captured before production.
- Public counts differ across source vintages. The current docs should not claim 65/281 as production truth. Humanitarian Atlas currently advertises 14 governorates, 61 districts, 272 subdistricts, and 5596 localities; this must still be reconciled against downloaded data.
- RAWAJ's current app includes all 14 governorates, but its `districtsAr` arrays mix formal districts, towns, neighborhoods, and colloquial market areas.

## Required Provenance Fields

Every future location record should preserve:

- `source_primary`
- `source_secondary`
- `source_date`
- `source_url`
- `pcode` where verified
- `source_name_ar`
- `source_name_en`
- `display_name_ar`
- `display_name_en`
- `type`
- `parent_id`
- `governorate_id`
- `district_id`
- `subdistrict_id`
- `aliases_ar`
- `aliases_en`
- `lat`
- `lng`
- `confidence`
- `review_status`
- `notes`

## P-code Reconciliation Sequence

```text
source ingestion
  -> provenance capture
  -> P-code matching where applicable
  -> hierarchy validation
  -> deduplication
  -> conflict detection
  -> alias reconciliation
  -> confidence scoring
  -> manual review
  -> production candidate export
```

Do not fabricate P-codes. A missing P-code is a blocking issue for production-ready formal admin records, not a cosmetic cleanup.

## Current RAWAJ Location Seed Issues

- Damascus values are mostly neighborhoods/localities, not districts.
- Rif Dimashq values mix cities/towns/district names.
- Aleppo values are mostly city neighborhoods/areas, while the later manual-only migration adds district names.
- Some names can exist at multiple levels, e.g. district/city/locality sharing a name.

## Do Not Do Yet

- Do not execute SQL.
- Do not replace current production location arrays.
- Do not remove legacy location strings before mapping old listings.
- Do not claim a camp, neighborhood, or district is official unless source level confirms it.
- Do not merge records solely by matching Arabic or English names.
