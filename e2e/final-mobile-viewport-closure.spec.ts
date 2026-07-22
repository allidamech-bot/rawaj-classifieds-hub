import { expect, test } from "@playwright/test";

const widths = [360, 390, 412] as const;
const routes = [
  "/",
  "/categories",
  "/listings",
  "/add-listing",
  "/favorites",
  "/saved-searches",
  "/notifications",
  "/chats",
  "/support",
  "/admin",
] as const;

for (const width of widths) {
  test(`core surfaces remain structurally safe at ${width}px`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only viewport closure");
    await page.setViewportSize({ width, height: 844 });

    for (const path of routes) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(
        response?.status() ?? 200,
        `${path} returned a server failure at ${width}px`,
      ).toBeLessThan(500);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      const layout = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));

      expect(layout.document, `${path} overflows the viewport at ${width}px`).toBeLessThanOrEqual(
        layout.viewport + 2,
      );
      expect(layout.body, `${path} body overflows the viewport at ${width}px`).toBeLessThanOrEqual(
        layout.viewport + 2,
      );
    }
  });
}

test("interactive mobile controls preserve minimum touch geometry", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only touch geometry closure");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const controls = page.locator(
    'button:visible, input:visible, select:visible, [role="button"]:visible',
  );
  const count = Math.min(await controls.count(), 12);
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    if (!box) continue;
    expect(box.height, `control ${index} is too short for touch`).toBeGreaterThanOrEqual(40);
  }
});
