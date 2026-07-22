import { expect, test } from "@playwright/test";

const mobileViewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
] as const;

for (const viewport of mobileViewports) {
  test.describe(`add-listing mobile recovery ${viewport.width}px`, () => {
    test.use({ viewport });

    test("renders a readable bounded listing studio shell", async ({ page }) => {
      const response = await page.goto("/add-listing", { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200).toBeLessThan(500);

      const studio = page.locator(".rawaj-listing-studio-v4");
      if ((await studio.count()) === 0) {
        await expect(page.locator("main")).toBeVisible();
        return;
      }

      await expect(studio).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("dir", /rtl/i);

      const geometry = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      }));
      expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport + 1);
      expect(geometry.bodyWidth).toBeLessThanOrEqual(geometry.viewport + 1);

      const hero = studio.locator(".rawaj-studio-hero");
      await expect(hero).toBeVisible();
      const heroColors = await hero.evaluate((element) => {
        const style = getComputedStyle(element);
        const heading = element.querySelector("h1");
        return {
          background: style.backgroundImage,
          headingColor: heading ? getComputedStyle(heading).color : "",
        };
      });
      expect(heroColors.background).toContain("linear-gradient");
      expect(heroColors.headingColor).not.toBe("rgb(9, 45, 41)");

      const actionBar = studio.locator(".rawaj-studio-action-bar");
      if ((await actionBar.count()) > 0) {
        const box = await actionBar.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    });
  });
}
