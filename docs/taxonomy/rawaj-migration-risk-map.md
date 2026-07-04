# RAWAJ Migration Risk Map

Date: 2026-07-04

Status: review artifact only. Not implemented.

## Why This Exists

The current app uses broad category IDs, broad field kinds, `details` JSON, and URL search params. The proposed taxonomy is deeper. A direct replacement would risk breaking listings, saved searches, edit forms, moderation, SEO, and existing URLs.

## Contract Risks

| Contract | Current shape | Risk | Required action |
| --- | --- | --- | --- |
| Category IDs | `cars`, `realestate`, `mobiles`, etc. | Existing listings and URLs reference IDs. | Keep old IDs or map aliases. |
| Category slugs | Stored in category rows. | Public links/search may depend on slugs. | Preserve redirects/aliases. |
| Subcategory IDs | Flat IDs like `cars-sale`. | Proposed taxonomy has deeper leaf paths. | Add mapping table before migration. |
| `CategoryFieldKind` | `real_estate`, `vehicles`, `jobs`, `services`, `electronics`, `general`. | Too broad for leaf schemas. | Add config layer; do not remove broad kinds initially. |
| `details` JSON | Legacy keys such as `car_make`, `area_sqm`, `electronics_brand`. | Old listings may lose display/edit compatibility. | Support legacy read/write until migration. |
| Search params | `category`, `subcategory`, `gov`, `district`, `car_make`, etc. | Deep filters need new params. | Version or alias params; keep old URLs working. |
| Saved searches | Stores `ListingFilters`. | Deep keys can break old saved searches. | Add migration/adapter with fallback. |
| Add listing | Broad forms by category kind. | Leaf forms require new selection step. | Feature-gate new forms. |
| Edit listing | Reads existing details. | Changing schema can hide existing values. | Legacy detail rendering required. |
| Listing detail | Displays current detail rows by broad kind. | New fields may not display; old may disappear. | Field dictionary display config with legacy fallback. |
| Admin moderation | Reviews current listing shape. | New fields increase review surface. | Moderate display config before rollout. |
| SEO/routes | Current route structure unchanged. | New category slugs may require canonical strategy. | Avoid route changes in first phase. |
| Analytics | Unknown/inferred. | Category metrics may split. | Keep old category dimensions and add new leaf dimensions later. |

## Mapping Table

| old_key | proposed_new_key | target classification | action |
| --- | --- | --- | --- |
| `cars` | `vehicles` | exact existing category target | Keep as alias or migrate top-level label. |
| `cars-sale` | `vehicles.cars.sale` | exact existing category target | Map automatically for listings with matching subcategory. |
| `cars-rent` | `vehicles.cars.rent` | exact existing category target | Map automatically. |
| `cars-parts` | `vehicles.parts_accessories` | exact existing category target | Map automatically, but details schema changes. |
| `cars-motorcycles` | `vehicles.motorcycles` | exact existing category target | Map automatically. |
| `cars-trucks` | `vehicles.trucks_buses` | ambiguous target | Manual/heuristic split for trucks, buses, vans. |
| `cars-heavy-equipment` | `business_industry_agriculture.heavy_machinery` | exact existing category target | Move out of vehicle top-level only after review. |
| `cars-agriculture` | `business_industry_agriculture.agriculture_equipment` | exact existing category target | Move after review. |
| `cars-services` | `services.vehicle_services` | exact existing category target with ownership ambiguity | Decide whether service or vehicle branch owns it. |
| `realestate` | `real_estate` | exact existing category target | Preserve alias. |
| `realestate-apartments-sale` | `real_estate.apartments.sale` | exact existing category target | Safe transform. |
| `realestate-apartments-rent` | `real_estate.apartments.rent` | exact existing category target | Safe transform. |
| `realestate-land` | `real_estate.land` | exact existing category target with subtype ambiguity | Requires user/listing review for residential/agricultural/commercial details. |
| `realestate-commercial` | `real_estate.shops_offices` or `real_estate.warehouses_workshops` | ambiguous target | Manual review; no generic `real_estate.commercial.*` target exists. |
| `mobiles` | `phones_smart_devices` | exact existing category target | Preserve alias. |
| `mobiles-iphone` | `phones_smart_devices.phones` | existing generic category target with brand-precision loss | Maps to generic phones leaf; iPhone/Apple specificity must be preserved through brand/model fields or legacy metadata. |
| `mobiles-tablets` | `phones_smart_devices.tablets` | exact existing category target | Safe transform. |
| `electronics` | `computers_electronics` | ambiguous target | Split by subcategory. |
| `electronics-laptops` | `computers_electronics.laptops` | exact existing category target | Safe transform. |
| `electronics-home-appliances` | `computers_electronics.appliances` | exact existing category target | Safe transform. |
| `furniture` | `home_furniture` | exact existing category target | Preserve alias. |
| `jobs` | `jobs` | exact existing category target | Split job offer/seeker by subcategory. |
| `jobs-seekers` | `jobs.seekers` | exact existing category target | Safe transform. |
| `services` | `services` | exact existing category target | Need offered/requested intent default. |
| `food` | `food_local_products` | deferred virtual target | Do not expand until policy review. Existing category remains legacy if present. |
| `animals` | `animals_supplies` | exact existing category target | Preserve alias. |
| `education` | `education_hobbies_travel.education_training` | exact existing category target | Top-level grouping changed. |
| `business` | `business_industry_agriculture` | exact existing category target | Preserve alias. |
| `misc` | `more` | exact existing category target | Controlled fallback. |

## Migration Sequence

1. Freeze current category, subcategory, details, and URL contracts as legacy.
2. Add review-only mapping config.
3. Add leaf schema config without production routing.
4. Render legacy and new details side by side in admin review only.
5. Backfill mapping confidence for old listings.
6. Migrate only exact/safe transform rows automatically.
7. Send ambiguous rows to manual review.
8. Keep old URL params and saved-search adapters until usage drops.
