import { expect, test } from "@playwright/test";

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
    expect(listingPath, "No public listing URL was present in initial listing results HTML").toBeTruthy();

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
  });
});
