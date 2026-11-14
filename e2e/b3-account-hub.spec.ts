import { expect, test } from "@playwright/test";

const widths = [320, 360, 390, 430, 768, 1024, 1440] as const;

for (const language of ["ar", "en"] as const) {
  test(`B3.1a account hub uses approved identity at seven widths: ${language}`, async ({
    page,
  }, testInfo) => {
    await page.addInitScript(
      (value) => window.localStorage.setItem("rawaj-language", value),
      language,
    );
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto("/more", { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
      await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");

      const hub = page.locator("main.rawaj-account-command-v3");
      const hero = hub.locator('.rawaj-trust-hero[data-mode="more"]');
      const links = hub.locator("nav.rawaj-more-v2__secondary");
      await expect(hero).toBeVisible();
      await expect(links.locator("a")).toHaveCount(4);
      await expect(hero).toHaveCSS("background-color", "rgb(7, 56, 54)");

      const metrics = await page.evaluate(() => {
        const main = document.querySelector<HTMLElement>("main.rawaj-account-command-v3");
        const cards = [
          ...document.querySelectorAll<HTMLElement>(
            ".rawaj-more-v2__secondary > a.rawaj-color-card",
          ),
        ];
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          mainWidth: main?.getBoundingClientRect().width ?? 0,
          cardWidths: cards.map((node) => node.getBoundingClientRect().width),
          cardBackgrounds: cards.map((node) => getComputedStyle(node).backgroundColor),
        };
      });
      expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
      expect(metrics.mainWidth).toBeGreaterThan(0);
      expect(metrics.cardWidths.every((value) => value > 40)).toBe(true);
      expect(metrics.cardBackgrounds.every((value) => value !== "rgba(0, 0, 0, 0)")).toBe(true);

      if ([320, 390, 1440].includes(width)) {
        const filename = testInfo.outputPath(`b3-account-${language}-${width}.png`);
        await page.screenshot({ path: filename, fullPage: true, animations: "disabled" });
        await testInfo.attach(`b3-account-${language}-${width}`, {
          path: filename,
          contentType: "image/png",
        });
      }
    }
  });
}

test("B3.1a /more keyboard links and reduced motion remain accessible", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/more", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  const shortcut = page.locator("nav.rawaj-more-v2__secondary a").first();
  await shortcut.focus();
  await expect(shortcut).toBeFocused();
  const outline = await shortcut.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});
