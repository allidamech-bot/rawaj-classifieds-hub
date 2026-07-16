import { expect, test } from "@playwright/test";

function stylesheetHrefs(html: string) {
  return [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)].map(
    (match) => match[1],
  );
}

test.describe("public initial HTML", () => {
  test("categories renders useful discovery content before hydration", async ({ request }) => {
    const response = await request.get("/categories", {
      headers: { accept: "text/html" },
    });

    expect(response.status()).toBeLessThan(400);
    const html = await response.text();
    expect(html).toContain("التصنيفات");
    expect(html).toContain("استكشف أقسام رواج");
    expect(html).not.toMatch(/جاري تحميل|Loading/i);
  });

  test("listing results render useful inventory before hydration", async ({ request }) => {
    const response = await request.get("/listings", {
      headers: { accept: "text/html" },
    });

    expect(response.status()).toBeLessThan(400);
    const html = await response.text();
    expect(html).toContain("rawaj-listings-results");
    expect(html).toMatch(/rawaj-listing-card|لا توجد إعلانات/);
    expect(html).not.toMatch(/جاري تحميل الإعلانات|Loading listings/i);
  });

  test("listing detail renders media and seller content before hydration", async ({ request }) => {
    const listingsResponse = await request.get("/listings", {
      headers: { accept: "text/html" },
    });
    expect(listingsResponse.status()).toBeLessThan(400);
    const listingsHtml = await listingsResponse.text();
    const detailPath = listingsHtml.match(/href="(\/listings\/[^"?#]+)"/)?.[1];
    test.skip(!detailPath, "No public listing was available in the test environment");

    const detailResponse = await request.get(detailPath!, {
      headers: { accept: "text/html" },
    });
    expect(detailResponse.status()).toBeLessThan(400);
    const detailHtml = await detailResponse.text();
    expect(detailHtml).toContain("rawaj-detail-media");
    expect(detailHtml).toContain("rawaj-detail-seller");
    expect(detailHtml).not.toMatch(/جاري تحميل الإعلان|Loading listing/i);

    const detailStyles = stylesheetHrefs(detailHtml);
    expect(detailStyles.some((href) => href.includes("listing-detail-v3"))).toBeTruthy();
    expect(detailStyles.some((href) => href.includes("home-discovery-v3"))).toBeFalsy();
    expect(detailStyles.some((href) => href.includes("search-filters-v2"))).toBeFalsy();
  });

  test("public route HTML includes only its scoped stylesheet group", async ({ request }) => {
    const homeResponse = await request.get("/", { headers: { accept: "text/html" } });
    const homeStyles = stylesheetHrefs(await homeResponse.text());
    expect(homeStyles.some((href) => href.includes("home-discovery-v3"))).toBeTruthy();
    expect(homeStyles.some((href) => href.includes("listing-detail-v3"))).toBeFalsy();
    expect(homeStyles.some((href) => href.includes("search-filters-v2"))).toBeFalsy();
    expect(homeStyles.some((href) => href.includes("listing-studio-v3"))).toBeFalsy();
    expect(homeStyles.some((href) => href.includes("communication-center-v2"))).toBeFalsy();
    expect(homeStyles.some((href) => href.includes("personal-space-polish"))).toBeFalsy();
    expect(homeStyles.some((href) => href.includes("trust-support-hub-v2"))).toBeFalsy();

    const listingsResponse = await request.get("/listings", {
      headers: { accept: "text/html" },
    });
    const listingStyles = stylesheetHrefs(await listingsResponse.text());
    expect(listingStyles.some((href) => href.includes("listings-results"))).toBeTruthy();
    expect(listingStyles.some((href) => href.includes("search-filters-v2"))).toBeTruthy();
    expect(listingStyles.some((href) => href.includes("home-discovery-v3"))).toBeFalsy();
    expect(listingStyles.some((href) => href.includes("listing-detail-v3"))).toBeFalsy();
    expect(listingStyles.some((href) => href.includes("listing-studio-v3"))).toBeFalsy();

    const offersResponse = await request.get("/offers", { headers: { accept: "text/html" } });
    const offerStyles = stylesheetHrefs(await offersResponse.text());
    expect(offerStyles.some((href) => href.includes("offers-signature"))).toBeTruthy();
    expect(offerStyles.some((href) => href.includes("home-discovery-v3"))).toBeFalsy();
    expect(offerStyles.some((href) => href.includes("seller-storefront-v2"))).toBeFalsy();
    expect(offerStyles.some((href) => href.includes("listing-studio-v3"))).toBeFalsy();
  });

  test("secondary public routes include only their matching stylesheet groups", async ({ request }) => {
    const supportResponse = await request.get("/support", { headers: { accept: "text/html" } });
    const supportStyles = stylesheetHrefs(await supportResponse.text());
    expect(supportStyles.some((href) => href.includes("trust-support-hub-v2"))).toBeTruthy();
    expect(supportStyles.some((href) => href.includes("listing-studio-v3"))).toBeFalsy();
    expect(supportStyles.some((href) => href.includes("communication-center-v2"))).toBeFalsy();
    expect(supportStyles.some((href) => href.includes("personal-space-polish"))).toBeFalsy();

    const addListingResponse = await request.get("/add-listing", {
      headers: { accept: "text/html" },
    });
    const addListingStyles = stylesheetHrefs(await addListingResponse.text());
    expect(addListingStyles.some((href) => href.includes("listing-studio-signature"))).toBeTruthy();
    expect(addListingStyles.some((href) => href.includes("listing-studio-v2"))).toBeTruthy();
    expect(addListingStyles.some((href) => href.includes("listing-studio-v3"))).toBeTruthy();
    expect(addListingStyles.some((href) => href.includes("trust-support-hub-v2"))).toBeFalsy();
    expect(addListingStyles.some((href) => href.includes("communication-center-v2"))).toBeFalsy();
  });
});
