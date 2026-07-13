import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sellerCard = await readFile(
  new URL("../src/features/listing-detail/ListingSellerProfileCard.tsx", import.meta.url),
  "utf8",
);

test("listing seller avatar replaces broken public identity images", () => {
  assert.match(sellerCard, /rawaj-detail-seller__avatar relative/);
  assert.match(sellerCard, /<User aria-hidden="true" \/>/);
  assert.match(
    sellerCard,
    /className="absolute inset-0 h-full w-full object-cover"/,
  );
  assert.match(
    sellerCard,
    /onError=\{\(event\) => event\.currentTarget\.remove\(\)\}/,
  );
  assert.match(sellerCard, /loading="lazy"/);
  assert.match(sellerCard, /decoding="async"/);
  assert.match(sellerCard, /width=\{64\}/);
  assert.match(sellerCard, /height=\{64\}/);
});
