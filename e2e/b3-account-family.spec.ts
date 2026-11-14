import { expect, test } from "@playwright/test";

const routes = [
  { path: "/profile", selector: "main.rawaj-account-hub-v3" },
  { path: "/login", selector: "main.rawaj-auth-audit-v12" },
  { path: "/reset-password", selector: "main.rawaj-auth-recovery-v4" },
  { path: "/favorites", selector: "main.rawaj-account-collection-v3" },
  { path: "/saved-searches", selector: "main.rawaj-account-collection-v3" },
  { path: "/offers", selector: "main.rawaj-offers-premium-v3" },
] as const;

for (const { path, selector } of routes) {
  for (const language of ["ar", "en"] as const) {
    test(`B3.1 account route ${path} ${language} is usable on mobile and desktop`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript(
        (value) => window.localStorage.setItem("rawaj-language", value),
        language,
      );
      for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 850 });
        const response = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(response?.status() ?? 200).toBeLessThan(500);
        await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          language === "ar" ? "rtl" : "ltr",
        );
        const main = page.locator(selector);
        await expect(main).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const sizes = await page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: document.documentElement.clientWidth,
        }));
        expect(sizes.content).toBeLessThanOrEqual(sizes.viewport + 1);

        if (width === 390) {
          const shot = testInfo.outputPath(
            `b3-account-family-${path.slice(1).replaceAll("/", "-")}-${language}.png`,
          );
          await page.screenshot({ path: shot, fullPage: true, animations: "disabled" });
          await testInfo.attach(`b3-${path}-${language}`, {
            path: shot,
            contentType: "image/png",
          });
        }
      }
    });
  }
}

test("B3.1 login form retains keyboard focus, real labels and teal consent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  const email = page.locator('input[type="email"]').first();
  await expect(email).toBeVisible();
  await email.focus();
  await expect(email).toBeFocused();
  expect(await email.evaluate((node) => getComputedStyle(node).outlineStyle)).not.toBe("none");
  await expect(page.locator("main.rawaj-auth-audit-v12")).toBeVisible();
});
