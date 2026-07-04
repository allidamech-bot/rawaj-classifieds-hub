# Syria Location Taxonomy Draft

Date: 2026-07-04

Status: corrected review artifact. Not implemented.

## Corrected Model

RAWAJ should distinguish formal administration from marketplace search/display areas.

```text
Syria
  Governorate (admin1)
    District (admin2)
      Subdistrict (admin3)
        Locality / populated place (admin4 where sourced)
          Marketplace area / neighborhood / alias (product layer)
```

Marketplace areas may include neighborhoods, suburbs, industrial zones, markets, camps, landmark areas, and colloquial local names. They are not automatically formal admin units.

## Governorate Coverage

Current RAWAJ governorate coverage: 14/14.

| RAWAJ ID | Arabic | English | Status |
| --- | --- | --- | --- |
| `damascus` | دمشق | Damascus | existing app ID; needs P-code mapping |
| `rif-dimashq` | ريف دمشق | Rif Dimashq | existing app ID; needs P-code mapping |
| `aleppo` | حلب | Aleppo | existing app ID; needs P-code mapping |
| `homs` | حمص | Homs | existing app ID; needs P-code mapping |
| `hama` | حماة | Hama | existing app ID; needs P-code mapping |
| `latakia` | اللاذقية | Latakia | existing app ID; needs P-code mapping |
| `tartus` | طرطوس | Tartus | existing app ID; needs P-code mapping |
| `idlib` | إدلب | Idlib | existing app ID; needs P-code mapping |
| `deir-ez-zor` | دير الزور | Deir ez-Zor | existing app ID; needs P-code mapping |
| `raqqa` | الرقة | Raqqa | existing app ID; needs P-code mapping |
| `hasakah` | الحسكة | Hasakah | existing app ID; needs P-code mapping |
| `daraa` | درعا | Daraa | existing app ID; needs P-code mapping |
| `suwayda` | السويداء | As-Suwayda | existing app ID; needs P-code mapping |
| `quneitra` | القنيطرة | Quneitra | existing app ID; needs P-code mapping |

## District Coverage Status

The current draft includes district candidate groups for 14/14 governorates, copied from existing manual-only review material. This is not verified production coverage.

Status:

- Governorate level: covered in app, P-codes not attached.
- District level: candidate names present for all governorates, P-codes not attached, source reconciliation incomplete.
- Subdistrict level: not covered.
- Locality/populated-place level: starter batches only.
- Neighborhood/marketplace-area level: starter batches only and not sourced enough for production.

## Formal District Candidate Batch

These remain candidates until COD-AB/Humanitarian Atlas P-codes and hierarchy are attached.

- Damascus: دمشق
- Rif Dimashq: دوما، التل، يبرود، النبك، القطيفة، الزبداني، قطنا، داريا، مركز ريف دمشق، قدسيا
- Aleppo: جبل سمعان، الباب، أعزاز، عفرين، جرابلس، السفيرة، منبج، عين العرب، الأتارب، دير حافر
- Homs: حمص، تلدو، الرستن، تلكلخ، القصير، تدمر، المخرم، القريتين
- Hama: حماة، محردة، السقيلبية، مصياف، سلمية
- Latakia: اللاذقية، جبلة، الحفة، القرداحة
- Tartus: طرطوس، بانياس، الشيخ بدر، الدريكيش، صافيتا
- Idlib: إدلب، أريحا، جسر الشغور، معرة النعمان، حارم
- Deir ez-Zor: دير الزور، الميادين، البوكمال
- Raqqa: الرقة، الثورة، تل أبيض
- Hasakah: الحسكة، القامشلي، المالكية، رأس العين
- Daraa: درعا، الصنمين، إزرع
- Suwayda: السويداء، شهبا، صلخد
- Quneitra: القنيطرة، فيق

## Starter Marketplace Locality Batches

These are not complete governorate gazetteers.

| Governorate | Starter locality status |
| --- | --- |
| Damascus | partial neighborhood/area batch; needs source and aliases |
| Rif Dimashq | partial city/town/area batch; parent hierarchy uncertain |
| Aleppo | partial neighborhood batch; parent hierarchy uncertain |
| Homs | partial neighborhood batch; parent hierarchy uncertain |
| Hama | partial neighborhood batch; parent hierarchy uncertain |
| Latakia | not covered beyond current legacy values |
| Tartus | not covered beyond current legacy values |
| Idlib | not covered beyond current legacy values |
| Deir ez-Zor | not covered beyond current legacy values |
| Raqqa | not covered beyond current legacy values |
| Hasakah | not covered beyond current legacy values |
| Daraa | not covered beyond current legacy values |
| Suwayda | not covered beyond current legacy values |
| Quneitra | not covered beyond current legacy values |

## User-Facing Recommendation

For the app, keep UX simple:

1. Governorate.
2. Searchable area/locality picker.
3. Optional neighborhood/detail note.

For data, store hierarchy/provenance separately:

1. Formal IDs and P-codes where verified.
2. Marketplace display area and aliases.
3. Legacy raw strings for old listings until migrated.

## Arabic Search Normalization

Search tokens may normalize:

- أ / إ / آ -> ا
- ى -> ي
- remove diacritics
- remove tatweel
- collapse repeated spaces
- normalize hyphen/space variants
- optionally index forms with/without `ال`
- include transliterations and common spellings

Use caution with ة / ه. Do not mutate canonical display names; generate aliases/search tokens instead.
