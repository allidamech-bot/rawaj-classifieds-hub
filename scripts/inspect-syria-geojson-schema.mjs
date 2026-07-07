#!/usr/bin/env node

/**
 * Inspect extracted Syria GeoJSON source schemas without modifying data.
 * Prints feature counts, property keys, first non-empty examples, and geometry types.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const baseDir = resolve(process.argv[2] ?? "data/locations/sources/geojson");

const files = [
  "syr_admin0.geojson",
  "syr_admin1.geojson",
  "syr_admin2.geojson",
  "syr_admin3.geojson",
  "syr_admincapitals.geojson",
  "syr_adminlines.geojson",
  "syr_adminpoints.geojson",
  "syr_neighborhoods.geojson",
  "syr_populatedplaces.geojson",
];

const report = {};

for (const filename of files) {
  const filepath = resolve(baseDir, filename);
  const raw = await readFile(filepath, "utf8");
  const geojson = JSON.parse(raw);
  const features = Array.isArray(geojson.features) ? geojson.features : [];

  const propertyKeys = new Set();
  const examples = {};
  const geometryTypes = new Set();

  for (const feature of features) {
    const properties =
      feature?.properties && typeof feature.properties === "object" ? feature.properties : {};

    for (const [key, value] of Object.entries(properties)) {
      propertyKeys.add(key);
      if (
        !(key in examples) &&
        value !== null &&
        value !== undefined &&
        String(value).trim() !== ""
      ) {
        examples[key] = value;
      }
    }

    if (feature?.geometry?.type) geometryTypes.add(feature.geometry.type);
  }

  const sampleFeatures = features.slice(0, 3).map((feature) => ({
    properties: feature?.properties ?? null,
    geometryType: feature?.geometry?.type ?? null,
  }));

  report[filename] = {
    featureCount: features.length,
    geometryTypes: [...geometryTypes].sort(),
    propertyKeys: [...propertyKeys].sort(),
    firstNonEmptyExamples: examples,
    sampleFeatures,
  };
}

console.log(JSON.stringify(report, null, 2));
