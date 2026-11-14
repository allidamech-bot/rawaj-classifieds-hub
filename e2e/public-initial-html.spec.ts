import { expect, test } from "@playwright/test";

function stylesheetHrefs(html: string) {
  return [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)].map(
    (match) => match[1] ?? "",
  );
}

test.describe("public initial HTML", () => {
  test("categories renders useful discovery content before hydration", async ({ request }) => {
    const response = await request.get("/categories", {
      headers: { accept: "text/html" },
    });

    expect(response.status()).toBeLessThan(500);
    expect(response.headers()["content-type"] ?? "").toMatch(/text\/html/i);

    const html = await response.text();
    expect(html).toContain("<main");
    expect(html).toContain("اختر القسم المناسب");
    expect(html).not.toContain("جاري تحميل الأقسام");
  });

  test("listing results renders the public results shell before hydration", async ({ request }) => {
    const response = await request.get("/listings", {
      headers: { accept: "text/html" },
    });

    expect(response.status()).toBeLessThan(500);
    expect(response.headers()["content-type"] ?? "").toMatch(/text\/html/i);

    const html = await response.text();
    expect(html).toContain("<main");
    expect(html).toContain("كل الإعلانات");
    expect(html).not.toMatch(/جاري تحميل الإعلانات|Loading listings/i);
  });

  test("a public listing renders detail, media, and seller sections before hydration", async ({
    request,
  }) => {
    const listingsResponse = await request.get("/listings", {
      headers: { accept: "text/html" },
    });
    expect(listingsResponse.status()).toBeLessThan(500);

    const listingsHtml = await listingsResponse.text();
    const listingPath = listingsHtml.match(/href="(\/listings\/[^"?#]+)"/)?.[1];
    expect(
      listingPath,
      "No public listing URL was present in initial listing results HTML",
    ).toBeTruthy();

    const detailResponse = await request.get(listingPath!, {
      headers: { accept: "text/html" },
    });
    expect(detailResponse.status()).toBeLessThan(400);
    expect(detailResponse.headers()["content-type"] ?? "").toMatch(/text\/html/i);

    const detailHtml = await detailResponse.text();
    expect(detailHtml).toContain("<main");
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

    const listingsResponse = await request.get("/listings", {
      headers: { accept: "text/html" },
    });
    const listingStyles = stylesheetHrefs(await listingsResponse.text());
    expect(listingStyles.some((href) => href.includes("listings-results"))).toBeTruthy();
    expect(listingStyles.some((href) => href.includes("search-filters-v2"))).toBeTruthy();
    expect(listingStyles.some((href) => href.includes("home-discovery-v3"))).toBeFalsy();
    expect(listingStyles.some((href) => href.includes("listing-detail-v3"))).toBeFalsy();

    const offersResponse = await request.get("/offers", { headers: { accept: "text/html" } });
    const offerStyles = stylesheetHrefs(await offersResponse.text());
    expect(offerStyles.some((href) => href.includes("offers-signature"))).toBeTruthy();
    expect(offerStyles.some((href) => href.includes("home-discovery-v3"))).toBeFalsy();
    expect(offerStyles.some((href) => href.includes("seller-storefront-v2"))).toBeFalsy();
  });

  test("secondary public routes include their own CSS without unrelated page layers", async ({
    request,
  }) => {
    const supportResponse = await request.get("/support", { headers: { accept: "text/html" } });
    const supportStyles = stylesheetHrefs(await supportResponse.text());
    expect(supportStyles.some((href) => href.includes("trust-support-hub-v2"))).toBeTruthy();
    expect(supportStyles.some((href) => href.includes("listing-studio-v3"))).toBeFalsy();
    expect(supportStyles.some((href) => href.includes("communication-center-v3"))).toBeFalsy();

    const chatsResponse = await request.get("/chats", { headers: { accept: "text/html" } });
    const chatStyles = stylesheetHrefs(await chatsResponse.text());
    expect(chatStyles.some((href) => href.includes("messaging-v4"))).toBeTruthy();
    expect(chatStyles.some((href) => href.includes("communication-center-v3"))).toBeTruthy();
    expect(chatStyles.some((href) => href.includes("personal-space-polish"))).toBeTruthy();
    expect(chatStyles.some((href) => href.includes("listing-studio-v3"))).toBeFalsy();

    const studioResponse = await request.get("/add-listing", { headers: { accept: "text/html" } });
    const studioStyles = stylesheetHrefs(await studioResponse.text());
    expect(studioStyles.some((href) => href.includes("listing-studio-v2"))).toBeTruthy();
    expect(studioStyles.some((href) => href.includes("listing-studio-v3"))).toBeTruthy();
    expect(studioStyles.some((href) => href.includes("messaging-signature"))).toBeFalsy();
  });
});
