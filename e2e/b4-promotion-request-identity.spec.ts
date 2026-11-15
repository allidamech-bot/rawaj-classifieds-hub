import { expect, test } from "@playwright/test";

for (const language of ["ar", "en"] as const) {
  test(`B4 promotion request keeps approved design and guest access in ${language}`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);

    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const response = await page.goto("/promotion-request", { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
      await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");

      const shell = page.locator(".rawaj-app-shell");
      await expect(shell).toHaveAttribute("data-design-palette", "ivory");
      await expect(shell).toHaveCSS("color-scheme", "light");
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#073836");
      await expect(
        page.getByRole("link", { name: language === "ar" ? "تسجيل الدخول" : "Log in" }),
      ).toBeVisible();

      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${language}: promotion request at ${width}px must not overflow`,
      ).toBeLessThanOrEqual(width + 1);

      if (width === 390) {
        await page.screenshot({
          path: testInfo.outputPath(`promotion-request-${language}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  });
}

test("B4 authenticated promotion hero uses petrol and champagne, without submitting", async ({
  page,
}) => {
  test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Requires local Firebase fixtures");
  await page.addInitScript(() => {
    localStorage.setItem("rawaj-language", "en");
    localStorage.setItem(
      "rawaj:e2e:firebase-user",
      JSON.stringify({ email: "browser-smoke@rawa-j.test" }),
    );
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/promotion-request", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  const hero = page.locator("main.container-wide > section").first();
  await expect(hero.getByRole("heading", { name: "Choose where your listing should appear" })).toBeVisible();
  await expect(hero).toHaveCSS("background-color", "rgb(7, 56, 54)");
  await expect(page.locator(".rawaj-app-shell")).toHaveAttribute("data-design-palette", "ivory");
  // Read-only acceptance: never submit a request, receipt or payment.
});
