import { expect, test } from "@playwright/test";

const routes = ["/category/vehicles", "/syria/damascus"] as const;

for (const route of routes) {
  for (const language of ["ar", "en"] as const) {
    test(`B4 ${route} has approved RTL/LTR SEO landing identity: ${language}`, async ({
      page,
    }, testInfo) => {
      test.skip(
        process.env.RAWAJ_E2E_USE_FIXTURES !== "1",
        "Requires active local catalog fixtures",
      );
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 850 });
        const response = await page.goto(route, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 200, route).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          language === "ar" ? "rtl" : "ltr",
        );
        await expect(page.locator(".rawaj-app-shell")).toHaveAttribute(
          "data-design-palette",
          "ivory",
        );
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
          "content",
          "#073836",
        );

        const main = page.locator("main.rawaj-seo-landing");
        await expect(main).toBeVisible();
        await expect(main).toHaveCSS("background-color", "rgb(249, 240, 228)");
        const hero = main.locator("section.rawaj-surface").first();
        await expect(hero).toHaveCSS("background-color", "rgb(255, 250, 243)");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${route} ${language} ${width}px viewport`,
        ).toBeLessThanOrEqual(width + 1);

        if (width === 390) {
          await page.screenshot({
            path: testInfo.outputPath(`${route.replaceAll("/", "-")}-${language}.png`),
            fullPage: true,
            animations: "disabled",
          });
        }
      }
    });
  }
}
