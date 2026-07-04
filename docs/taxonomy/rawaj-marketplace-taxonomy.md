# RAWAJ Marketplace Taxonomy Draft

Date: 2026-07-04

Status: corrected review artifact. Not implemented.

## Taxonomy Goals

- Arabic-first labels and simple user discovery.
- Fewer top-level categories than the full internal taxonomy.
- Deep internal leaf categories for forms, filters, moderation, saved searches, and future analytics.
- Syria-adapted marketplace structure without fake trust, payment, shipping, verification, or regulatory claims.

## Corrected Top-Level Recommendation

Use 13 top-level categories initially. The earlier "12" count was wrong; the actual architecture includes `more` as a controlled fallback and should be stated truthfully rather than compressed to an arbitrary number.

| Key | Arabic label | Decision | Rationale |
| --- | --- | --- | --- |
| `real_estate` | عقارات | KEEP | High-intent category; requires deepest schema. |
| `vehicles` | مركبات | KEEP | High-intent category; needs vehicle-specific leaves. |
| `phones_smart_devices` | موبايلات وأجهزة ذكية | KEEP | Distinct buyer filters: brand, model, storage, battery, warranty. |
| `computers_electronics` | كمبيوتر وإلكترونيات | SPLIT FROM OLD ELECTRONICS | Avoid one generic electronics form; includes computers, TVs, audio, cameras, gaming, appliances. |
| `home_furniture` | منزل وأثاث | KEEP | Common marketplace family; simple fields. |
| `fashion_personal` | أزياء ومستلزمات شخصية | KEEP | Includes personal accessories; avoid mixing children. |
| `children_maternity` | أطفال وأمومة | SPLIT | Candidate family was missing; should not be buried in fashion. |
| `jobs` | وظائف | KEEP | Must split job offer from job seeker. |
| `services` | خدمات | KEEP | Must split service offered from service requested and use caution with regulated services. |
| `business_industry_agriculture` | أعمال ومعدات وزراعة | MERGE | Combines business equipment, industry, agriculture, farm equipment to avoid too many top-level categories. |
| `animals_supplies` | حيوانات ومستلزماتها | KEEP | Includes pets, livestock, supplies, feed; needs guardrails. |
| `education_hobbies_travel` | تعليم وهوايات وسفر | MERGE/DEFER PARTS | Education and hobbies fit; travel/tourism should be tightly controlled/deferred unless product scope expands. |
| `more` | أخرى | CONTROLLED FALLBACK | Keep small, monitored, and recategorized. |

## Minimal Internal Branch Coverage

The machine-readable draft should not leave kept top-level families empty. Minimal branch coverage is:

- `home_furniture`: furniture, decor/lighting, household items.
- `fashion_personal`: clothing, shoes/bags, watches/perfumes/accessories.
- `children_maternity`: strollers/car seats, toys, children clothing, maternity.
- `animals_supplies`: pets, livestock, birds, supplies/feed.
- `education_hobbies_travel`: education/training, sports/hobbies, travel/tourism deferred.
- `more`: books/media, gifts/collectibles, other controlled fallback.

These are intentionally shallow review branches, not final deep trees.

## Candidate Family Decisions

| Candidate family | Decision | Explanation |
| --- | --- | --- |
| عقارات | KEEP | Top-level; high-value and field-heavy. |
| مركبات | KEEP | Top-level; strong leaf-specific fields. |
| موبايلات وأجهزة ذكية | KEEP | Separate from electronics because phones/tablets/smart watches have distinct schemas. |
| إلكترونيات | MERGE INTO `computers_electronics` | Use as part of broader electronics/computers family. |
| كمبيوتر ولابتوب | SPLIT INSIDE `computers_electronics` | Distinct laptop/desktop/component fields, but not necessarily top-level. |
| منزل وأثاث | KEEP | Top-level, broad but coherent. |
| أزياء ومستلزمات شخصية | KEEP | Top-level if enough supply; includes watches/perfumes/accessories. |
| أطفال وأمومة | SPLIT | Missing before; should include children clothes, strollers, toys, maternity items. |
| وظائف | KEEP | Must separate job vacancies from job seekers. |
| خدمات | KEEP | Must separate offered/requested and regulate sensitive service claims. |
| أعمال ومعدات | MERGE | Merge with industry/agriculture at top level; split internally. |
| صناعة وتجهيزات | MERGE | Internal branch under business/industry/agriculture. |
| زراعة ومزارع | MERGE/SPLIT INTERNALLY | Farm real estate remains under real estate; farm equipment/products under business/agriculture; livestock under animals. |
| حيوانات ومستلزماتها | KEEP | Needs species/supplies separation. |
| رياضة وهوايات | MERGE | Put under education/hobbies/travel initially, or under More if low volume. |
| تعليم وتدريب | KEEP AS PART OF MERGED TOP-LEVEL | Important but can be grouped with hobbies to reduce top-level sprawl. |
| سفر وسياحة | DEFER | Only allow narrow non-regulated items/services later. Avoid lodging/tour claims initially unless scope and rules are explicit. |
| أخرى | CONTROLLED FALLBACK | Use for low-volume items only; monitor and migrate. |

## Food / Local Products Decision

Decision: `DEFER as top-level; allow only controlled non-perishable local products later after policy review`.

Food/local products were too confidently included in the first draft. Risks include homemade foods, perishables, refrigeration, expiry, infant food, supplements, medical/health claims, unknown origin, and regulated products. Without explicit product policy and moderation rules, RAWAJ should not launch a broad food top-level category.

Safer future scopes:

- Packaged non-perishable local products with expiry/source fields.
- Agricultural products only if seller type, quantity, unit, origin, storage, and claim restrictions are defined.
- Explicitly exclude infant formula/infant food, supplements, medication-like claims, and perishable prepared food until policy review.

## Transaction Intent Matrix

| Category | Sale | Rent | Short/daily rent | Wanted buy | Wanted rent | Exchange | Service offered | Service requested | Job vacancy | Job seeker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Real estate | structural | structural | structural/defer for tourism | structural/filter | structural/filter | field/defer | n/a | n/a | n/a | n/a |
| Vehicles | structural | structural for rental | n/a | structural/filter | n/a | field/defer | n/a | n/a | n/a | n/a |
| Vehicle parts/accessories | structural sale | n/a | n/a | filter/defer | n/a | field/defer | n/a | n/a | n/a | n/a |
| Phones/devices | listing field | n/a | n/a | filter/defer | n/a | field/defer | n/a | n/a | n/a | n/a |
| Home/furniture | listing field | n/a | n/a | filter/defer | n/a | field/defer | n/a | n/a | n/a | n/a |
| Jobs | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | structural | structural |
| Services | n/a | n/a | n/a | n/a | n/a | n/a | structural | structural |
| Education/training | n/a | n/a | n/a | n/a | n/a | n/a | structural offered | structural requested/defer | n/a | n/a |
| Animals/supplies | listing field | n/a | n/a | filter/defer | n/a | field/defer | optional service leaf/defer | n/a | n/a | n/a |

Do not expose every intent everywhere.

## Real Estate Leaf Schemas

### Apartment for sale

Core fields: area, rooms, bathrooms, floor, building floors, building age, elevator, balcony, parking, heating, condition, location.

Avoid unsourced Syrian legal fields. Ownership/title/registry/court/power-of-attorney/share/cooperative/possession/zoning/encumbrance values are unresolved and must not be made enum values until separately sourced.

### Apartment for rent

Core fields: area, rooms, bathrooms, floor, building floors, furnished, elevator, balcony, parking, heating, rental period, deposit amount optional, available from optional.

### House/villa

Core fields: area, land area optional, rooms, bathrooms, floors, garden/yard, parking, furnished, condition.

### Land

Core fields: area, frontage optional, road access optional, utilities available optional, intended use as free text or broad enum only after policy review.

Do not use legal zoning/ownership values as canonical before sourcing.

### Shop/office

Core fields: area, floor, frontage optional, bathroom, water/electricity availability, suitable use as broad text, parking/loading optional.

### Warehouse/workshop

Core fields: area, ceiling height, truck access, loading/unloading area, industrial electricity, water, drainage, internal office space.

### Agricultural property

Split carefully:

- Farm/land as real estate.
- Agricultural equipment as business/agriculture.
- Crops/products as deferred food/agricultural products policy.

## Vehicle Taxonomy Notes

Separate leaf schemas:

- Cars/SUVs/pickups: make, model, trim, year, mileage, fuel, transmission, body, engine optional, drivetrain optional, condition.
- Motorcycles: make, model, year, mileage, engine size, motorcycle type, condition. Do not show car body/transmission fields by default.
- Trucks/buses/vans: make, model, year, mileage, payload/seats/body configuration, fuel, transmission, condition.
- Heavy machinery: machine type, brand, model, year, hours used, capacity, condition.
- Agricultural vehicles: equipment type, brand, model, year, hours used, compatible use.
- Parts/accessories: part type, compatible make/model/year, new/used, original/aftermarket as unresolved optional labels.

Make/model should be dependent where curated lists exist; otherwise use searchable text with suggestions.

## Electronics Taxonomy Notes

Do not use one generic electronics schema.

- Phones: brand, model, storage, RAM, SIM, battery health optional, condition, warranty, accessories.
- Tablets: brand, model, screen size, storage, connectivity, condition, warranty.
- Smart watches: brand, model, size, connectivity, condition, warranty.
- Laptops: brand, model, processor, RAM, storage, screen size, GPU optional, battery condition optional, warranty.
- Desktops/components: component type, brand, model, specs by component.
- TVs: brand, size, display type, smart TV, resolution, condition.
- Audio: device type, brand, model, power/connectivity, condition.
- Cameras: brand, model, type, lens included, shutter count if relevant.
- Gaming: platform, model, storage/accessories, condition.
- Appliances: appliance type, brand, capacity, condition, warranty.

## Jobs and Services Notes

Jobs:

- `job_offer`: company/person hiring, job role, job family, location, employment type, work mode, salary type, salary range optional, experience, application method.
- `job_seeker`: desired role, experience, skills, desired location, work mode, availability, expected salary optional. Do not ask employer-only fields.

Services:

- `service_offered`: service family, coverage area, availability, starting price optional, pricing unit optional.
- `service_requested`: service family, needed date/time, location, budget optional, description.
- Legal, accounting, medical/health, and regulated services should be allowed only as cautious labels with no outcome/credential claims unless policy supports them.

## Rollout Recommendation

1. Keep current main categories visible.
2. Add a review-only mapping from current IDs to proposed internal keys.
3. Introduce leaf schema config behind review/feature gates.
4. Preserve existing listing display and saved-search URLs.
5. Migrate only after old category, subcategory, details, and URL mappings are tested.
