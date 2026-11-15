import { expect, test } from "@playwright/test";

/**
 * B4 identity convergence: migrated account/communication routes share the
 * approved ivory semantic shell without inheriting the retired V7 dark mode.
 * Use only local fixtures; never mutate production or log in to a real account.
 */
const routes = [
  { pathname: "/more", chrome: "#f9f0e4" },
  { pathname: "/profile", chrome: "#f9f0e4" },
  { pathname: "/favorites", chrome: "#f9f0e4" },
  { pathname: "/saved-searches", chrome: "#f9f0e4" },
  { pathname: "/activity", chrome: "#073836" },
  { pathname: "/notifications", chrome: "#073836" },
  { pathname: "/chats", chrome: "#073836" },
] as const;

for (const language of ["ar", "en"] as const) {
  for (const route of routes) {
    test(`B4 ${route.pathname} uses approved personal shell: ${language}`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 860 });
        const response = await page.goto(route.pathname, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 200, route.pathname).toBeLessThan(500);
        await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          language === "ar" ? "rtl" : "ltr",
        );
        const shell = page.locator(".rawaj-app-shell");
        await expect(shell).toHaveAttribute("data-design-palette", "ivory");
        await expect(shell).toHaveCSS("color-scheme", "light");
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
          "content",
          route.chrome,
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${route.pathname} ${language} ${width} must fit viewport`,
        ).toBeLessThanOrEqual(width + 1);
        if (width === 390) {
          await page.screenshot({
            path: testInfo.outputPath(`${route.pathname.slice(1)}-${language}.png`),
            fullPage: true,
            animations: "disabled",
          });
        }
      }
    });
  }
}
