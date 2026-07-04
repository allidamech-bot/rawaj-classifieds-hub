# RAWAJ Field Dictionary Draft

Date: 2026-07-04

Status: corrected review artifact. Not implemented.

## Field Record Contract

Every future field should have:

- `field_key`: stable ASCII snake_case.
- `label_ar`: Arabic display label.
- `label_en`: optional English support label.
- `type`: text, textarea, number, boolean, enum, multi_enum, enum_or_text, enum_or_number, range, date, ref, note.
- `unit`: optional, e.g. `sqm`, `km`, `syp`, `m`.
- `values`: stable enum keys with Arabic labels when `type` is enum.
- `applies_to`: leaf category IDs or a documented group.
- `required`: default boolean.
- `depends_on`: parent fields, if any.
- `visible_when`, `required_when`, `hidden_when`: conditional rules.
- `filterable`: whether search should expose it.
- `sortable`: whether sorting should support it.
- `searchable`: whether keyword/search tokens should include it.
- `display_on_card`: whether listing cards should show it.
- `display_on_detail`: whether listing detail should show it.
- `validation`: min/max/pattern/length constraints.

## Field Type Contract

| type | Storage semantics | UI behavior | Validation semantics | Filter semantics |
| --- | --- | --- | --- | --- |
| `text` | string | input | length/pattern | searchable or exact/prefix only if configured |
| `textarea` | string | multiline input | length/content rules | usually searchable, not faceted |
| `number` | number | numeric input | min/max/unit | range or exact |
| `boolean` | boolean | checkbox/toggle | true/false | yes/no facet |
| `enum` | stable key | select/radio/chips | must match values | facet |
| `multi_enum` | array of stable keys | checklist | each key must match values | multi-select facet if configured |
| `enum_or_text` | stable key or custom string | select with custom fallback | known values preferred; custom length-limited | known values faceted, custom text searchable |
| `enum_or_number` | stable key or number | select plus numeric fallback | known values or numeric range | facet/range depending value |
| `range` | `{ min, max }` or paired params | range inputs | min <= max | range filter only; not a listing detail field by default |
| `date` | ISO date | date input | valid date | date/range filter |
| `ref` | stable referenced ID | picker/search select | referenced ID must exist | reference facet |
| `note` | metadata text | read-only/admin note | not user-editable | never filterable |

## Global Search-Control References

These are not all listing fields:

| key | classification | Notes |
| --- | --- | --- |
| `query` | search-control pseudo-field | Full text input; not stored as listing detail. |
| `category` | taxonomy reference | Points to category/leaf IDs. |
| `governorate_id` | listing location reference | Existing listing-level location field. |
| `locality_id` | future listing location reference | Future structured location field. |
| `price_range` | search-control pseudo-field | Maps to listing `price` min/max. |
| `sort` | sort control | Search UI control, not listing detail. |

Unresolved research concerns, such as Syrian legal/ownership taxonomy, must remain in notes/policy sections and must not be represented as user listing fields.

## Shared Fields

| field_key | label_ar | type | filterable | display_on_card | Notes |
| --- | --- | --- | --- | --- | --- |
| `title` | عنوان الإعلان | text | no | yes | Existing required listing field. |
| `description` | الوصف | textarea | no | no | Existing required listing field; searchable. |
| `price` | السعر | number | yes | yes | Existing, SYP. |
| `price_type` | نوع السعر | enum | yes | yes | Existing-ish. Values need stable keys. |
| `governorate_id` | المحافظة | ref | yes | yes | Existing. |
| `district_id` | المنطقة | ref | yes | yes | Future structured replacement for raw `districtAr`. |
| `subdistrict_id` | الناحية | ref | advanced | no | Future; requires source/P-code. |
| `locality_id` | المدينة/الحي/القرية | ref | yes | yes | Marketplace locality; not always formal admin. |
| `location_note` | تفاصيل إضافية للمكان | text | no | no | Existing concept. |
| `contact_method` | طريقة التواصل | multi_enum | no | no | Existing contact options. |

Do not use a universal `condition` enum except as a fallback. Use contextual condition vocabularies.

## Contextual Condition Vocabularies

### Vehicle condition

| key | label_ar |
| --- | --- |
| `new` | جديد |
| `used_excellent` | مستعمل ممتاز |
| `used_good` | مستعمل جيد |
| `needs_repair` | يحتاج صيانة |
| `damaged` | متضرر |

### Device condition

| key | label_ar |
| --- | --- |
| `sealed_new` | جديد مغلق |
| `new_open_box` | جديد مفتوح |
| `used_excellent` | مستعمل ممتاز |
| `used_good` | مستعمل جيد |
| `for_parts` | للقطع |

### Furniture condition

| key | label_ar |
| --- | --- |
| `new` | جديد |
| `used_excellent` | مستعمل ممتاز |
| `used_good` | مستعمل جيد |
| `needs_repair` | يحتاج إصلاح |

### Real estate condition

| key | label_ar |
| --- | --- |
| `new_build` | بناء جديد |
| `ready` | جاهز |
| `needs_finishing` | يحتاج إكساء |
| `needs_renovation` | يحتاج ترميم |

## Real Estate Field Groups

### Apartment rent

Core: `area_sqm`, `rooms`, `bathrooms`, `floor`, `building_floors`, `furnished`, `elevator`, `balcony`, `parking`, `rental_period`, `deposit_amount`, `available_from`.

Primary filters: price, location, area, rooms, furnished.

### Apartment sale

Core: `area_sqm`, `rooms`, `bathrooms`, `floor`, `building_floors`, `building_age`, `elevator`, `balcony`, `parking`, `real_estate_condition`.

Primary filters: price, location, area, rooms.

### Land

Core: `area_sqm`, `frontage_m`, `road_access`, `utilities_available`.

Unresolved: legal ownership, title, registry, court judgment, power of attorney, shares, cooperative, possession, formal zoning, encumbrance. These must not become stable enum values without Syria-specific sourcing.

### Warehouse/workshop

Core: `area_sqm`, `ceiling_height_m`, `truck_access`, `loading_area`, `industrial_electricity`, `water_available`, `drainage_available`, `internal_office`.

## Vehicle Field Groups

### Cars/SUVs/pickups

Core: `vehicle_make`, `vehicle_model`, `vehicle_trim`, `year`, `mileage_km`, `fuel_type`, `transmission`, `body_type`, `engine_size`, `drivetrain`, `vehicle_condition`, `color`.

### Motorcycles

Core: `motorcycle_make`, `motorcycle_model`, `year`, `mileage_km`, `engine_size`, `motorcycle_type`, `vehicle_condition`, `color`.

Do not show `body_type` car values or truck payload fields for motorcycles.

### Trucks/buses/vans

Core: `vehicle_make`, `vehicle_model`, `year`, `mileage_km`, `fuel_type`, `transmission`, `payload_kg` or `seats_count`, `vehicle_condition`.

### Parts/accessories

Core: `part_type`, `compatible_make`, `compatible_model`, `compatible_year_from`, `compatible_year_to`, `part_condition`, `part_origin`.

## Phones and Electronics Field Groups

### Phones

Core: `brand`, `model`, `storage`, `ram`, `sim_type`, `battery_health_percent`, `device_condition`, `warranty`, `accessories`.

### Tablets

Core: `brand`, `model`, `screen_size_in`, `storage`, `connectivity`, `device_condition`, `warranty`.

### Laptops

Core: `brand`, `model`, `processor`, `ram`, `storage`, `screen_size_in`, `gpu`, `device_condition`, `warranty`.

### Desktops/components

Core: `component_type`, `brand`, `model`, `processor`, `ram`, `storage`, `gpu`, `device_condition`.

### TVs

Core: `brand`, `screen_size_in`, `display_type`, `resolution`, `smart_tv`, `device_condition`.

## Jobs and Services

### Job offer

Core: `job_role`, `job_family`, `employment_type`, `work_mode`, `work_location`, `salary_type`, `salary_min`, `salary_max`, `experience_level`, `application_method`.

### Job seeker

Core: `desired_role`, `experience_years`, `skills`, `desired_location`, `work_mode`, `availability`, `expected_salary`.

### Service offered

Core: `service_family`, `service_area`, `availability`, `starting_price`, `pricing_unit`, `provider_type`.

### Service requested

Core: `service_family`, `needed_date`, `service_location`, `budget`, `description`.

## Food / Local Products

Broad food is deferred. If later allowed, fields must include at minimum: `product_type`, `seller_type`, `quantity`, `unit`, `packaging`, `expiry_date` for packaged/perishable products, `storage_requirement`, and `claim_restrictions_acknowledged`. Infant food, supplements, medication-like claims, and prepared perishables require policy review before listing.
