import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOchaSourceNotes,
  classifySyriaPopulatedPlace,
  summarizeSyriaSourceClassifications,
} from "./syria-location-type-classification.mjs";

test("maps only explicit semantic settlement labels", () => {
  assert.equal(classifySyriaPopulatedPlace("City", "1").nodeType, "city");
  assert.equal(classifySyriaPopulatedPlace("Governorate City", "1").nodeType, "city");
  assert.equal(classifySyriaPopulatedPlace("Town", "2").nodeType, "town");
  assert.equal(classifySyriaPopulatedPlace("Village", "3").nodeType, "village");
  assert.equal(classifySyriaPopulatedPlace("Community", "4").nodeType, "locality");
  assert.equal(classifySyriaPopulatedPlace("مدينة", "1").nodeType, "city");
  assert.equal(classifySyriaPopulatedPlace("بلدة", "2").nodeType, "town");
  assert.equal(classifySyriaPopulatedPlace("قرية", "3").nodeType, "village");
});

test("does not guess a city from an administrative capital label", () => {
  const result = classifySyriaPopulatedPlace("Admin1 Capital", "1");
  assert.deepEqual(result, {
    nodeType: "locality",
    mapped: false,
    reason: "unrecognized_source_class",
    sourceTitle: "Admin1 Capital",
    sourceNumber: "1",
    normalizedTitle: "admin1 capital",
  });
});

test("marks missing source classes as unmapped", () => {
  const result = classifySyriaPopulatedPlace("", null);
  assert.equal(result.nodeType, "locality");
  assert.equal(result.mapped, false);
  assert.equal(result.reason, "missing_source_class");
});

test("summarizes unmapped classes with bounded review examples", () => {
  const city = { pcode: "C1", ...classifySyriaPopulatedPlace("City", "1") };
  const unknown = { pcode: "C2", ...classifySyriaPopulatedPlace("Admin1 Capital", "2") };
  const summary = summarizeSyriaSourceClassifications([city, unknown]);

  assert.equal(summary.total, 2);
  assert.equal(summary.mappedCount, 1);
  assert.equal(summary.unmappedCount, 1);
  assert.deepEqual(summary.unmappedExamples, [
    {
      pcode: "C2",
      sourceTitle: "Admin1 Capital",
      sourceNumber: "2",
      reason: "unrecognized_source_class",
    },
  ]);
});

test("preserves the raw OCHA class and version in node notes", () => {
  const classification = classifySyriaPopulatedPlace("Village", "3");
  assert.equal(
    buildOchaSourceNotes("2020-08-16", classification),
    "OCHA/HDX source version 2020-08-16; OCHA/HDX populated place class: Village (#3)",
  );
});
