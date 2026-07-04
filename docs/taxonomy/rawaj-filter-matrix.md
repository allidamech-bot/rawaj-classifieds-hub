# RAWAJ Filter Matrix Draft

Date: 2026-07-04

Status: corrected review artifact. Not implemented.

## Filter Principles

- Do not expose every listing field as a filter.
- Primary filters should support the most common buyer narrowing actions.
- Advanced filters should be hidden behind a secondary control.
- Display-only fields can appear on cards/details but should not clutter search.
- Leaf category controls filter availability.

## Matrix

| Leaf/category group | PRIMARY | ADVANCED | DISPLAY ONLY / NOT FILTERABLE |
| --- | --- | --- | --- |
| Apartment rent | location, price, area, rooms, furnished | floor, elevator, parking, balcony, building age, available from | deposit amount, building floors |
| Apartment sale | location, price, area, rooms | floor, elevator, parking, balcony, building age, condition | building floors |
| House/villa | location, price, area, rooms | bathrooms, floors, garden/yard, parking, condition | descriptive amenities |
| Land | location, price, area | frontage, road access, utilities available | legal/ownership values unresolved; do not filter |
| Shop/office | location, price, area | floor, frontage, bathroom, parking | suitable use text |
| Warehouse/workshop | location, price, area | ceiling height, truck access, loading area, industrial electricity | internal office, drainage |
| Cars/SUVs/pickups | location, price, make, model, year | mileage, fuel, transmission, body, condition | color, trim initially display/search only |
| Motorcycles | location, price, make, model, year | engine size, mileage, motorcycle type, condition | color |
| Trucks/buses/vans | location, price, make, model, year | payload/seats, fuel, transmission, condition | color |
| `business_industry_agriculture.heavy_machinery` / `business_industry_agriculture.agriculture_equipment` | location, price, equipment type, brand | year, hours used, capacity, condition | attachments text |
| Vehicle parts | location, price, part type | compatible make/model/year, condition | part origin initially display only |
| Phones | location, price, brand, model, storage | RAM, condition, warranty, battery health | accessories |
| Tablets | location, price, brand, model, screen size | storage, connectivity, condition, warranty | accessories |
| Laptops | location, price, brand, processor, RAM | storage, screen size, GPU, condition, warranty | battery note |
| TVs | location, price, size, brand | display type, resolution, smart TV, condition | accessories |
| Appliances | location, price, appliance type, brand | capacity, condition, warranty | installation notes |
| Jobs: offer | location, job family, employment type, work mode | salary type/range, experience, shift | application method |
| Jobs: seeker | desired location, desired role, work mode | experience years, expected salary | skills text |
| Services offered | location/service area, service family | availability, starting price, pricing unit | provider type initially display only |
| Services requested | location, service family, needed date | budget | detailed description |
| `animals_supplies.livestock` | location, species, price, quantity | breed, age, sex | health/vaccination deferred to policy review |
| `children_maternity.strollers_car_seats` | location, price, item type, age range, condition | brand | safety notes |
| `fashion_personal.clothing` | location, price, item type, size, audience | condition, brand | material |
| `education_hobbies_travel.education_training` | location, subject/activity, format | level, schedule | instructor details |
| Food/local products | deferred | deferred | Do not launch broad filters before policy review |
| More | location, price | item type | encourage recategorization |

## Current App Mapping

Currently supported:

- Category, subcategory, governorate, district.
- Price min/max.
- Vehicle make/model/fuel/transmission.
- Real estate purpose/type/rooms/rental duration.
- Electronics brand/condition.
- Jobs employment type/salary type.
- Query and sort.

Main gap:

- Current filters are broad category-kind filters, not leaf filters.
- Saved URLs use current parameter names and must remain backwards-compatible during any future migration.
