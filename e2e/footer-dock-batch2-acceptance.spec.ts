import { expect, test } from "@playwright/test";

// Read-only isolated fixture checks; no live account or customer data.
for (const language of ["ar", "en"] as const) {
  test(`B2 footer and dock share approved identity in ${language}`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((locale) => localStorage.setItem("rawaj-language", locale), language);

    for (const path of ["/", "/categories", "/more", "/profile", "/support"]) {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200).toBe(200);
      await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
      const footer = page.locator(".rawaj-site-footer");
      await expect(footer).toBeVisible();
      await expect(footer).toHaveCSS("background-color", "rgb(16, 63, 66)");
      await expect(footer).toHaveCSS("background-image", "none");
      const dock = page.locator(".rawaj-bottom-nav-shell");
      await expect(dock).toBeVisible();
      await expect(dock).toHaveCSS("background-color", "rgb(4, 52, 50)");
      const metrics = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
        footerLinkHeights: Array.from(
          document.querySelectorAll(".rawaj-site-footer__mobile nav a"),
        ).map((link) => link.getBoundingClientRect().height),
      }));
      expect(metrics.document).toBeLessThanOrEqual(metrics.viewport + 2);
      expect(metrics.footerLinkHeights).toHaveLength(3);
      expect(Math.min(...metrics.footerLinkHeights)).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: testInfo.outputPath(`b2-footer-dock-${language}-390.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("B2 owner storefront still uses its approved light footer and separate dock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/profile/listings", { waitUntil: "domcontentloaded" });
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
  const footer = page.locator(".rawaj-site-footer");
  await expect(footer).toBeVisible();
  await expect(footer).toHaveCSS("background-color", "rgb(241, 238, 234)");
  await expect(page.locator(".rawaj-bottom-nav-shell")).toHaveCSS(
    "background-color",
    "rgb(20, 59, 57)",
  );
});
