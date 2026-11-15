import { expect, test } from "@playwright/test";

/**
 * The migrated RAWAJ routes have an approved petrol/ivory identity. This
 * acceptance asserts the actual rendered shell across Arabic/English and
 * iPhone/desktop, not merely successful CSS compilation.
 * Runs only against isolated local fixtures; never writes production data.
 */
const ivoryRoutes = [
  "/categories",
  "/listings",
  "/offers",
  "/login",
  "/reset-password",
  "/more",
  "/profile",
  "/favorites",
  "/saved-searches",
  "/activity",
  "/notifications",
  "/chats",
  "/support",
] as const;

for (const pathname of ivoryRoutes) {
  for (const language of ["ar", "en"] as const) {
    test(`approved ivory route: ${pathname} (${language})`, async ({ page }, testInfo) => {
      test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Isolated fixture browser only");
      const mobile = testInfo.project.name.startsWith("mobile");
      await page.setViewportSize({
        width: mobile ? 390 : 1440,
        height: mobile ? 844 : 900,
      });
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      const response = await page.goto(pathname, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200, pathname).toBe(200);
      await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
      const shell = page.locator(".rawaj-app-shell");
      await expect(shell).toHaveAttribute("data-design-palette", "ivory");
      await expect(shell).toHaveCSS("color-scheme", "light");
      await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
      await expect(page.locator("html")).toHaveCSS("background-color", "rgb(249, 240, 228)");
      await expect(page.locator("main")).toBeVisible();

      if (pathname === "/categories") {
        await expect(page.locator(".rawaj-categories-v2__hero-search input")).toHaveCSS(
          "color",
          "rgb(19, 39, 36)",
        );
      }
      if (pathname === "/login") {
        await expect(page.locator(".rawaj-auth-layout")).toHaveCSS(
          "background-color",
          "rgb(255, 250, 243)",
        );
      }
      if (pathname === "/offers") {
        await expect(page.locator(".rawaj-offers-stage")).toHaveCSS(
          "background-color",
          "rgb(7, 56, 54)",
        );
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${pathname} ${language} must fit ${mobile ? "iPhone" : "desktop"}`,
      ).toBeLessThanOrEqual(mobile ? 391 : 1441);
    });
  }
}

for (const pathname of ["/", "/seller/90fc1187-0357-46da-9c19-d984536df794"] as const) {
  test(`preserve pre-approved homepage/storefront route: ${pathname}`, async ({ page }) => {
    test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Isolated fixture browser only");
    await page.goto(pathname, { waitUntil: "domcontentloaded" });
    await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
    await expect(page.locator(".rawaj-app-shell")).not.toHaveAttribute(
      "data-design-palette",
      "ivory",
    );
    await expect(page.locator("main")).toBeVisible();
  });
}
