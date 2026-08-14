import assert from "node:assert/strict";
import test from "node:test";

import { listingShareHighlights } from "../src/lib/listing-share-highlights.ts";

const listing = (details = {}, condition = "used") => ({ condition, details });

test("vehicle share highlights are localized, useful, and capped at three", () => {
  const highlights = listingShareHighlights(
    listing({
      car_make: "Toyota",
      car_model: "Corolla",
      year: 2021,
      mileage_km: 42_000,
      transmission: "automatic",
    }),
    "vehicles",
    "en",
  );

  assert.deepEqual(highlights, [
    { label: "Vehicle", value: "Toyota · Corolla" },
    { label: "Year", value: "2,021" },
    { label: "Mileage", value: "42,000 km" },
  ]);
  assert.equal(highlights.length, 3);
});

test("real-estate share highlights use trusted structured details", () => {
  assert.deepEqual(
    listingShareHighlights(
      listing({ property_type: "apartment", listing_purpose: "rent", bedrooms: 3, area_sqm: 125 }),
      "real_estate",
      "en",
    ),
    [
      { label: "Property", value: "Apartment · Rent" },
      { label: "Bedrooms", value: "3" },
      { label: "Area", value: "125 sqm" },
    ],
  );
});

test("electronics share highlights handle missing data without placeholders", () => {
  assert.deepEqual(
    listingShareHighlights(
      listing({ electronics_brand: "Samsung", electronics_model: "S24", ram: "12 GB" }),
      "electronics",
      "ar",
    ),
    [
      { label: "الجهاز", value: "Samsung · S24" },
      { label: "الذاكرة", value: "12 GB" },
      { label: "الحالة", value: "مستعمل" },
    ],
  );
  assert.deepEqual(listingShareHighlights(listing(), "real_estate", "en"), []);
});

test("share highlights localize like-new and exclude internal IDs and raw keys", () => {
  const highlights = listingShareHighlights(
    listing(
      {
        electronics_brand: "category_01j9internalvalue",
        electronics_model: "550e8400-e29b-41d4-a716-446655440000",
        storage: "undefined",
        ram: undefined,
        _taxonomy_node_id: "node_123456789",
      },
      "like_new",
    ),
    "electronics",
    "en",
  );

  assert.deepEqual(highlights, [{ label: "Condition", value: "Like new" }]);
  const serialized = JSON.stringify(highlights);
  for (const forbidden of ["undefined", "null", "_taxonomy_node_id", "category_", "550e8400"]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden));
  }
});

test("jobs and services only expose their approved display fields", () => {
  assert.deepEqual(
    listingShareHighlights(
      listing({ job_type: "Accountant", employment_type: "full_time", work_location: "onsite" }),
      "jobs",
      "en",
    ),
    [
      { label: "Role", value: "Accountant" },
      { label: "Employment", value: "Full-time" },
      { label: "Work location", value: "On-site" },
    ],
  );
  assert.deepEqual(
    listingShareHighlights(
      listing({ service_type: "تنظيف", service_area: "دمشق", delivery_time: "same_day" }),
      "services",
      "ar",
    ),
    [
      { label: "الخدمة", value: "تنظيف" },
      { label: "نطاق الخدمة", value: "دمشق" },
      { label: "وقت التنفيذ", value: "نفس اليوم" },
    ],
  );
});
