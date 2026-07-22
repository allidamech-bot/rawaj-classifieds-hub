import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile-360", width: 360, height: 800, project: "mobile" },
  { name: "mobile-390", width: 390, height: 844, project: "mobile" },
  { name: "mobile-412", width: 412, height: 915, project: "mobile" },
  { name: "desktop-1440", width: 1440, height: 1000, project: "desktop" },
] as const;

const routes = [
  { name: "home", path: "/" },
  { name: "categories", path: "/categories" },
  { name: "listings", path: "/listings" },
  { name: "add-listing", path: "/add-listing" },
  { name: "account", path: "/profile" },
  { name: "favorites", path: "/favorites" },
  { name: "saved-searches", path: "/saved-searches" },
  { name: "notifications", path: "/notifications" },
  { name: "chats", path: "/chats" },
  { name: "support", path: "/support" },
  { name: "admin", path: "/admin" },
] as const;

for (const viewport of viewports) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of routes) {
      test(`${route.name} rendered visual capture`, async ({ page }, testInfo) => {
        test.skip(
          !testInfo.project.name.startsWith(viewport.project),
          `${viewport.name} belongs to the ${viewport.project} project`,
        );
        const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 200).toBeLessThan(500);
        await expect(page.locator("main")).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        await page.screenshot({
          path: testInfo.outputPath(`${viewport.name}-${route.name}.png`),
          fullPage: true,
          animations: "disabled",
        });
      });
    }
  });
}
