import { expect, test } from "@playwright/test";

for (const language of ["ar", "en"] as const) {
  test(`B3 account and saved collections use ivory Safari chrome in ${language}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((locale) => localStorage.setItem("rawaj-language", locale), language);
    for (const route of ["/more", "/profile", "/favorites", "/saved-searches"]) {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200).toBe(200);
      await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
      await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f9f0e4");
      await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
      await expect(page.locator(".rawaj-app-shell")).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
      const widths = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(widths.document).toBeLessThanOrEqual(widths.viewport + 2);
    }
  });
}

test("B3 signed-in account labels meet the legibility floor at 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "rawaj:e2e:firebase-user",
      JSON.stringify({ email: "browser-smoke@rawa-j.test" }),
    );
  });
  await page.goto("/profile", { waitUntil: "domcontentloaded" });
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
  const labels = page.locator(
    ".rawaj-account-identity__copy > p, .rawaj-account-section > header p",
  );
  await expect(labels.first()).toBeVisible();
  const sizes = await labels.evaluateAll((nodes) =>
    nodes.map((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
  );
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
});
