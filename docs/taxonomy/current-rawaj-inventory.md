# RAWAJ Current Taxonomy Inventory

Date: 2026-07-04

Scope: research and design inventory only. No production schema, the retired backend, route, auth, payment, storage, or business-logic changes are included.

## Current Data Shape

RAWAJ currently uses a compact classifieds model:

- Categories: `ClassifiedCategory` with `id`, `slug`, Arabic name, hint, placeholder, sort order, and active flag.
- Subcategories: one flat `ClassifiedSubcategory` level under each category.
- Locations: `ClassifiedGovernorate` with one array named `districtsAr`.
- Listings: one `categoryId`, optional `subcategoryId`, one `governorateId`, one `districtAr`, price fields, condition, contact options, and flexible `details`.
- Category-specific values: stored in listing `details` JSON.
- Search filters: explicit `ListingFilters` fields, mostly broad-kind filters.

Primary code references:

- `src/lib/classifieds-types.ts`
- `src/lib/category-fields.ts`
- `src/lib/classifieds-api.ts`
- `src/routes/add-listing.tsx`
- `src/routes/listings.index.tsx`
- `src/routes/profile/listings.$id.tsx`
- `retired-backend/migrations/202606300001_core_marketplace_schema_rls.sql`
- `retired-backend/migrations/202607020001_syrian_districts_completion.sql`

## Current Main Categories

Seeded marketplace categories:

| ID | Current meaning | Current issue |
| --- | --- | --- |
| `cars` | Cars and vehicles | Broad bucket mixes cars, rentals, parts, motorcycles, trucks, equipment, agriculture, services. |
| `realestate` | Real estate | Good main category, but listing intent and asset class need deeper leaf schemas. |
| `mobiles` | Mobiles and tablets | Separated from electronics, but shares generic electronics fields in code. |
| `electronics` | Electronics | Broad, generic brand/model/storage/RAM/warranty fields. |
| `furniture` | Home and furniture | No dedicated field schema beyond general details. |
| `jobs` | Jobs | Has broad job fields, but lacks job-family fields. |
| `services` | Services | Has broad service fields, but lacks provider/service-category specifics. |
| `fashion` | Fashion and accessories | No dedicated size/gender/material/condition fields. |
| `food` | Food and local products | No expiry, quantity, packaging, producer, dietary, delivery fields. |
| `animals` | Animals and livestock | No animal species, age, breed, health, sex, quantity fields. |
| `education` | Education and courses | No subject, level, format, schedule, instructor fields. |
| `business` | Business and industry | No machine/equipment/commercial fields. |
| `misc` | More | Catch-all. Needs guardrails to avoid taxonomy leakage. |

## Current Subcategory Pattern

The seed taxonomy uses one flat subcategory list. Examples:

- Vehicles: cars for sale, rental, parts, motorcycles, trucks, heavy equipment, agriculture, services.
- Real estate: apartments sale/rent, houses sale/rent, villas, land, shops, offices, warehouses, farms, commercial.
- Mobiles: iPhone, Samsung, Xiaomi, Huawei, Oppo, tablets, accessories, parts.
- Services: delivery, moving, cleaning, maintenance, plumbing, electricity, cars, real estate, design, programming, marketing, photography, tutoring.

This is workable for initial browse, but not enough for Sahibinden-style precision where the leaf category controls required fields and filters.

## Current Field Model

`CategoryFieldKind` is currently:

- `real_estate`
- `vehicles`
- `jobs`
- `services`
- `electronics`
- `general`

Current details fields:

- Real estate: property type, listing purpose, rental duration, area, rooms, bedrooms, bathrooms, floor, furnished, parking.
- Vehicles: make, model, year, mileage, fuel, transmission, body type, vehicle condition, color.
- Jobs: job type, employment type, experience level, salary type, salary min/max, work location, contract duration, application method.
- Services: service type, service area, delivery time, starting price.
- Electronics: brand, model, storage, RAM, warranty, accessories, condition.
- Location detail: neighborhood and extra location text.

## Current Search Filters

The listing page supports:

- Category, subcategory, governorate, district.
- Price min/max.
- Vehicle: make, model, fuel, transmission.
- Real estate: purpose, type, rooms, rental duration.
- Electronics: brand, condition.
- Jobs: employment type, salary type.
- Text query and sort.

## Key Gaps

1. Location hierarchy is too shallow.
   The current `districtsAr` array mixes formal districts, city areas, towns, neighborhoods, and legacy marketplace areas.

2. Field schemas are too broad.
   One `vehicles` schema cannot serve passenger cars, motorcycles, trucks, parts, rentals, and services equally.

3. Filters are broad-kind filters.
   Useful for MVP, but not enough for serious buyer search on vehicle, real estate, jobs, electronics, services, animals, and business equipment.

4. Subcategories are not modeled as leaf schemas.
   RAWAJ needs leaf-level configuration: required fields, optional fields, filters, conditionals, title hints, and display rows.

5. Arabic-first labels exist, but normalized stable keys are incomplete.
   Future data needs stable IDs, Arabic labels, English aliases, source notes, and review status.

## Recommended Design Direction

Use a two-layer approach:

- Simple user-facing browse: main category, popular subcategory, governorate, area.
- Deep internal taxonomy: main category -> group -> leaf category -> field schema -> filters -> display rows -> validation rules.

This preserves RAWAJ simplicity while allowing high-quality structured search.

## Migration Risk Summary

The proposed taxonomy is deeper than current RAWAJ contracts. Do not directly replace current data.

Key risks:

- Current listings reference existing category IDs and subcategory IDs.
- Current category slugs may be used in URLs, SEO labels, saved searches, and analytics.
- `CategoryFieldKind` only supports `real_estate`, `vehicles`, `jobs`, `services`, `electronics`, and `general`.
- Listing `details` JSON contains broad legacy keys such as `car_make`, `property_type`, `electronics_brand`, `employment_type`, and `service_type`.
- Listing search URLs use existing params such as `category`, `subcategory`, `gov`, `district`, `car_make`, `property_type`, and `electronics_brand`.
- Saved searches store the current `ListingFilters` shape.
- Add-listing, edit-listing, listing detail display, and moderation all assume broad category-kind details.

See `docs/taxonomy/rawaj-migration-risk-map.md` for the review-only mapping table.

## Initial Mapping Classes

| Current key | Proposed direction | Classification |
| --- | --- | --- |
| `cars` | `vehicles` | exact |
| `cars-sale` | `vehicles.cars.sale` | safe transform |
| `cars-trucks` | `vehicles.trucks_buses` | ambiguous |
| `cars-heavy-equipment` | `business_industry_agriculture.heavy_machinery` | safe transform after review |
| `realestate` | `real_estate` | exact |
| `realestate-land` | `real_estate.land.*` | ambiguous |
| `mobiles` | `phones_smart_devices` | exact |
| `electronics` | `computers_electronics` | ambiguous by subcategory |
| `food` | deferred food/local policy | deprecated/defer |
| `misc` | `more` | exact but controlled fallback |

No production migration should occur until exact/safe/ambiguous/manual/deprecated classes are reviewed.
