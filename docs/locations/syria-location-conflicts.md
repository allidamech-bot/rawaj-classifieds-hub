# Syria Location Conflicts and Review Queue

Date: 2026-07-04

Status: corrected review artifact. Not implemented.

## Conflict Types

- `level_mismatch`: value stored as district but actually locality/neighborhood/town.
- `alias_or_spelling`: Arabic/English transliteration or spelling differs.
- `parent_conflict`: market familiarity differs from formal parent.
- `same_name_collision`: same name appears in multiple governorates/districts or at different levels.
- `legacy_value`: existing app value must remain supported.
- `needs_source`: needs COD-AB, Humanitarian Atlas, OSM, GeoNames, GNS, or manual verification.

## Current RAWAJ Conflicts

| Value | Current location | Issue | Recommendation |
| --- | --- | --- | --- |
| المزة / Mazzeh | Damascus `districtsAr` | Neighborhood/locality, not formal district | Move to locality/marketplace area; keep legacy alias. |
| كفرسوسة / Kafr Sousa | Damascus `districtsAr` | Neighborhood/locality | Move to locality; keep alias. |
| المالكي / Malki | Damascus `districtsAr` | Neighborhood/locality | Move to locality; keep alias. |
| أبو رمانة / Abu Rummaneh | Damascus `districtsAr` | Neighborhood/locality | Move to locality; keep alias. |
| باب توما / Bab Touma | Damascus `districtsAr` | Historic neighborhood/locality | Move to locality; keep alias. |
| مشروع دمر / Dummar Project | Damascus `districtsAr` | Area/neighborhood | Move to locality; keep alias. |
| جرمانا / Jaramana | Rif Dimashq `districtsAr` | City/locality and market area; not just district-level | Keep under Rif Dimashq after source validation. |
| صحنايا / Sahnaya | Rif Dimashq `districtsAr` | Locality/area | Verify parent; keep legacy. |
| جديدة عرطوز / Jdeidet Artouz | Rif Dimashq `districtsAr` | Locality/area | Verify parent; keep legacy. |
| الحمدانية / Hamadaniyah | Aleppo `districtsAr` | Neighborhood/locality | Move to locality under Aleppo city after source validation. |
| الفرقان / Furqan | Aleppo `districtsAr` | Neighborhood/locality | Move to locality. |
| حلب الجديدة / New Aleppo | Aleppo `districtsAr` | Neighborhood/locality | Move to locality. |
| الوعر / Waer | Homs `districtsAr` | Neighborhood/locality | Move to locality under Homs city after source validation. |
| القامشلي / Qamishli | Hasakah `districtsAr` | District/city name ambiguity | Store district and locality records separately if both source levels exist. |
| المالكية / Malikiyah | Hasakah `districtsAr` | District/city name ambiguity | Store district and locality records separately if both source levels exist. |
| درعا البلد / Daraa Al-Balad | Daraa `districtsAr` | City area/neighborhood | Move to locality; keep legacy. |
| درعا المحطة / Daraa Al-Mahatta | Daraa `districtsAr` | City area/neighborhood | Move to locality; keep legacy. |

## Deduplication Rules

Never merge solely because names match.

Use these checks:

1. Exact same P-code -> same formal record, unless source conflict says otherwise.
2. Same normalized Arabic name + same parent + close coordinates -> possible duplicate.
3. Same coordinates + spelling difference -> possible alias.
4. Same name in different governorates -> separate records.
5. Same name in different districts -> separate records unless P-code confirms merge.
6. District and city with same name -> separate records at different levels.
7. Historical/current/common names -> alias records, not automatic merges.
8. Arabic/transliterated names -> aliases tied to one reviewed record.
9. Neighborhood/village collision -> separate until parent/P-code confirms.
10. OSM/GeoNames duplicate representations -> supplemental evidence only.

## Arabic Search Normalization Rules

Normalize search tokens only, not canonical names:

- أ / إ / آ -> ا
- ى -> ي
- remove diacritics
- remove tatweel
- collapse repeated whitespace
- normalize hyphen/space punctuation
- index forms with and without `ال` when useful
- include Arabic, English, transliterated, colloquial, Kurdish/Arabic alternate names where relevant and sourced

Caution:

- ة / ه should not be blindly merged.
- Do not overwrite display names with normalized tokens.

## Review Queue

1. Download/source COD-AB and Humanitarian Atlas tabular data.
2. Attach governorate/district/subdistrict P-codes.
3. Reconcile advertised Humanitarian Atlas counts against downloaded rows.
4. Build legacy alias map for current `districtsAr`.
5. Mark every starter locality as `needs_source` until source-backed.
6. Resolve Damascus/Rif Dimashq market-boundary cases.
7. Decide whether camps, informal settlements, industrial zones, and markets are product-search areas, sensitive records, or excluded from initial rollout.
8. Produce a production candidate file only after manual review.

## Migration Safety

- Keep old listing `districtAr` display intact.
- Add structured location fields in parallel later.
- Only migrate old listings after mapping confidence is assigned.
- Never delete a legacy string without alias coverage.
