import { expect, test } from "@playwright/test";

async function readInitialHtml(request: Parameters<typeof test>[0] extends never ? never : never) {
  return request;
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
});
