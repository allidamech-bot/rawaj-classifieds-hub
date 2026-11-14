import { expect, test } from "@playwright/test";

const widths = [320, 360, 390, 430, 768, 1024, 1440];

for (const language of ["ar", "en"] as const) {
  for (const width of widths) {
    test(`B2.2 listing detail identity, dock and responsive layout ${language} ${width}px`, async (
      { page },
      testInfo,
    ) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      const response = await page.goto("/listings/e2e-listing-featured", {
        waitUntil: "domcontentloaded",
      });
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
      await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#073836");
      await page.evaluate(() => document.fonts.ready);
      const detail = page.locator("main.rawaj-detail-v2");
      await expect(detail).toHaveAttribute("data-design-palette", "ivory");
      await expect(detail).toHaveCSS("background-color", "rgb(249, 240, 228)");
      await expect(detail.locator(".rawaj-detail-summary h1")).toBeVisible();
      await expect(detail.locator(".rawaj-detail-summary h1")).toHaveCSS(
        "color",
        "rgb(19, 39, 36)",
      );
      await expect(detail.locator(".rawaj-detail-price")).toBeVisible();
      await expect(detail.locator(".rawaj-detail-seller")).toBeVisible();
      const dock = page.locator(".rawaj-contact-dock");
      await expect(dock).toHaveAttribute("data-design-palette", "ivory");
      await expect(dock.locator(".rawaj-contact-dock__primary")).toBeVisible();
      await expect(dock.locator(".rawaj-contact-dock__inner")).toHaveCSS(
        "background-color",
        "rgb(255, 250, 243)",
      );
      const metrics = await page.evaluate(() => {
        const dock = document.querySelector(".rawaj-contact-dock__inner")?.getBoundingClientRect();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          dockLeft: dock?.left ?? -1,
          dockRight: dock?.right ?? Infinity,
        };
      });
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.dockLeft).toBeGreaterThanOrEqual(-1);
      expect(metrics.dockRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      const screenshot = testInfo.outputPath(`detail-${language}-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`detail-${language}-${width}`, {
        path: screenshot,
        contentType: "image/png",
      });
    });
  }
}
