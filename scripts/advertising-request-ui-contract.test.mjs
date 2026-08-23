import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  requestClient,
  customerRoute,
  adminRoute,
  adSlot,
  ownerTools,
  finalCss,
  stabilityCss,
] = await Promise.all([
  read("../src/lib/advertising-request.ts"),
  read("../src/routes/advertise.tsx"),
  read("../src/routes/admin.ad-requests.tsx"),
  read("../src/components/PublicAdPlacementSlot.tsx"),
  read("../src/features/storefront/OwnerListingsWorkspaceTools.tsx"),
  read("../src/rawaj-live-repair-sweep-v25.css"),
  read("../src/stability-accessibility-fixes.css"),
]);

test("customer advertising stays separate from Search Boost", () => {
  assert.match(requestClient, /RAWAJ_AD_REQUEST_V1/);
  assert.match(requestClient, /createMySupportRequest/);
  assert.match(requestClient, /fetchMySupportRequests/);
  assert.doesNotMatch(requestClient, /createSearchBoostRequest/);
  assert.match(customerRoute, /createFileRoute\("\/advertise"\)/);
  for (const kind of ["home", "search_results", "categories", "campaign"]) {
    assert.match(customerRoute, new RegExp(`value: "${kind}"`));
  }
});

test("customer has advertising entry points from empty inventory and My Store", () => {
  assert.match(adSlot, /href=\{`\/advertise\?placement=/);
  assert.match(adSlot, /مساحة إعلانية متاحة/);
  assert.match(ownerTools, /to="\/advertise"/);
  assert.match(ownerTools, /إعلان مدفوع/);
});

test("admin has a dedicated advertising request inbox", () => {
  assert.match(adminRoute, /createFileRoute\("\/admin\/ad-requests"\)/);
  assert.match(adminRoute, /fetchAdminAdvertisingRequests/);
  assert.match(adminRoute, /updateAdminAdvertisingRequest/);
  assert.match(adminRoute, /\/admin\/ad-placements/);
  assert.match(adminRoute, /\/admin\/campaigns/);
});

test("final search layer removes native light WebKit search decorations", () => {
  assert.match(finalCss, /input\[type="search"\]/);
  assert.match(finalCss, /-webkit-appearance:\s*none\s*!important/);
  assert.match(finalCss, /::-webkit-search-decoration/);
  assert.match(finalCss, /::-webkit-search-cancel-button/);
  assert.match(finalCss, /background-color:\s*transparent\s*!important/);
  assert.match(stabilityCss, /@import "\.\/rawaj-live-repair-sweep-v25\.css";/);
});

function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}
