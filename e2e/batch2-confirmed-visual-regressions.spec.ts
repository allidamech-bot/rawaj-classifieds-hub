import { expect, test } from "@playwright/test";

// Reproduces the November 15 production failures that the existing layout
// audit missed: text inside search inputs and plain divs, plus card-internal
// clipping when the document itself does not overflow.
const widths = [320, 390, 430, 1440];

function contrastRatio(foreground: string, background: string): number {
  const rgb = (value: string) => {
    const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (!match) throw new Error(`Unsupported computed RGB color: ${value}`);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
  };
  const luminance = (value: string) => {
    const channels = rgb(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const language of ["ar", "en"] as const) {
  test(`Batch 2 category search has readable typed text and placeholder in ${language}`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/categories");
    await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");

    const input = page.locator('.rawaj-categories-v2__hero-search input[type="search"]');
    await expect(input).toBeVisible();
    await input.fill(language === "ar" ? "سيارات" : "cars");

    for (const width of widths) {
      await page.setViewportSize({ width, height: 850 });
      const colors = await input.evaluate((element) => ({
        typed: getComputedStyle(element).color,
        placeholder: getComputedStyle(element, "::placeholder").color,
        background: getComputedStyle(element.parentElement!).backgroundColor,
      }));
      expect(
        contrastRatio(colors.typed, colors.background),
        `Typed category search text: ${language}, ${width}px`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(colors.placeholder, colors.background),
        `Category placeholder: ${language}, ${width}px`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test(`Batch 2 support detail text is legible in ${language}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/support");
    await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");

    const details = page.locator("main .rawaj-support-detail");
    await expect(details).toHaveCount(4);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 850 });
      const rows = await details.evaluateAll((elements) =>
        elements.map((element) => ({
          text: element.textContent?.trim() ?? "",
          foreground: getComputedStyle(element).color,
          background: getComputedStyle(element).backgroundColor,
        })),
      );
      for (const row of rows) {
        expect(
          contrastRatio(row.foreground, row.background),
          `Support detail "${row.text}": ${language}, ${width}px`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test(`Batch 2 complete listing prices remain visible in ${language}`, async ({
    page,
  }) => {
    await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto("/listings");
    await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
    const prices = page.locator(".rawaj-search-results-v1 .rawaj-adaptive-card__price");
    await expect(prices.first()).toBeVisible();

    for (const width of widths) {
      await page.setViewportSize({ width, height: 850 });
      await page.evaluate(() => document.fonts.ready);
      const truncated = await prices.evaluateAll((elements) =>
        elements.flatMap((element) => {
          const style = getComputedStyle(element);
          const lostPixels = element.scrollWidth - element.clientWidth;
          if (
            (style.overflowX === "hidden" || style.overflowX === "clip") &&
            lostPixels > 2
          ) {
            return [
              `${element.textContent?.trim()} [${lostPixels}px hidden; ${style.whiteSpace}]`,
            ];
          }
          return [];
        }),
      );
      expect(truncated, `Listing prices must not be truncated: ${language}, ${width}px`).toEqual(
        [],
      );
    }
  });
}
