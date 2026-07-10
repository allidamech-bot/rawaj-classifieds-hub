import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSyriaSourceAliases,
  mergeSyriaLocationAliases,
  normalizeSyriaLocationAlias,
} from "./syria-location-search-aliases.mjs";

test("normalizes Arabic location spelling consistently with the database", () => {
  assert.equal(normalizeSyriaLocationAlias("  تلّة   آمنة "), "تله امنه");
});

test("publishes source-provided alternate names as reviewed searchable aliases", () => {
  const aliases = buildSyriaSourceAliases([
    {
      external_source: "ocha-hdx-cod-ab-syr",
      external_id: "C123",
      source_url: "https://data.humdata.org/dataset/cod-ab-syr",
      search_aliases: ["Tall Dahab", "تل ذهب"],
    },
  ]);

  assert.deepEqual(aliases, [
    {
      targetExternalSource: "ocha-hdx-cod-ab-syr",
      targetExternalId: "C123",
      alias: "Tall Dahab",
      languageCode: "en",
      aliasType: "alternate_name",
      sourceName: "OCHA/HDX COD-AB Syria",
      sourceUrl: "https://data.humdata.org/dataset/cod-ab-syr",
      sourceNote: "Source-provided alternate name for C123",
      confidence: "high",
      reviewStatus: "reviewed",
    },
    {
      targetExternalSource: "ocha-hdx-cod-ab-syr",
      targetExternalId: "C123",
      alias: "تل ذهب",
      languageCode: "ar",
      aliasType: "alternate_name",
      sourceName: "OCHA/HDX COD-AB Syria",
      sourceUrl: "https://data.humdata.org/dataset/cod-ab-syr",
      sourceNote: "Source-provided alternate name for C123",
      confidence: "high",
      reviewStatus: "reviewed",
    },
  ]);
});

test("deduplicates normalized aliases without inventing classifications", () => {
  const aliases = buildSyriaSourceAliases([
    {
      external_source: "ocha-hdx-cod-ab-syr",
      external_id: "C456",
      search_aliases: ["تلّة آمنة", "تله امنه", "", null],
    },
  ]);

  assert.equal(aliases.length, 1);
  assert.equal(aliases[0].alias, "تلّة آمنة");
  assert.equal("nodeType" in aliases[0], false);
});

test("lets a curated alias override duplicate source metadata", () => {
  const source = {
    targetExternalSource: "ocha-hdx-cod-ab-syr",
    targetExternalId: "C789",
    alias: "تلّة آمنة",
    reviewStatus: "reviewed",
  };
  const curated = {
    targetExternalSource: "ocha-hdx-cod-ab-syr",
    targetExternalId: "C789",
    alias: "تله امنه",
    reviewStatus: "needs_review",
  };

  assert.deepEqual(mergeSyriaLocationAliases([source], [curated]), [curated]);
});
