import { expect, test } from "@playwright/test";

const widths = [320, 360, 390, 430, 768, 1024, 1440];
for (const language of ["ar", "en"]) {
  for (const width of widths) {
    test(`search identity and filter sheet ${language} ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      await page.goto("/listings", { waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
      await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
      await page.evaluate(() => document.fonts.ready);
      const main = page.locator("main.rawaj-search-results-v1");
      await expect(main).toHaveCSS("background-color", "rgb(249, 240, 228)");
      await expect(main.locator("h1")).toHaveCSS("color", "rgb(7, 56, 54)");
      await expect(main.locator(".rawaj-search-toolbar__saved")).toBeInViewport();
      const cards = main.locator(".rawaj-adaptive-card");
      await expect(cards.first()).toBeVisible();
      await expect(cards.first()).toHaveCSS("background-color", "rgb(255, 250, 243)");
      await expect(cards.first().locator(".rawaj-adaptive-card__title")).toHaveCSS(
        "color",
        "rgb(19, 39, 36)",
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const resultsPath = testInfo.outputPath(`results-${language}-${width}.png`);
      await page.screenshot({ path: resultsPath, fullPage: true });
      await testInfo.attach(`results-${language}-${width}`, {
        path: resultsPath,
        contentType: "image/png",
      });
      await main.getByRole("button", { name: /فتح الفلاتر|Open filters/ }).click();
      const sheet = page.locator(".rawaj-filter-sheet");
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveCSS("background-color", "rgb(255, 250, 243)");
      const apply = sheet.getByRole("button", {
        name: /تطبيق وعرض النتائج|Apply and show results/,
      });
      await expect(apply).toHaveCSS("background-color", "rgb(7, 56, 54)");
      await expect(apply).toBeInViewport();
      await expect(
        sheet.getByRole("button", { name: /إغلاق الفلاتر|Close filters/ }),
      ).toBeInViewport();
      await sheet.evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((a) => a.finished.catch(() => undefined)));
      });
      const filtersPath = testInfo.outputPath(`filters-${language}-${width}.png`);
      await page.screenshot({ path: filtersPath });
      await testInfo.attach(`filters-${language}-${width}`, {
        path: filtersPath,
        contentType: "image/png",
      });
    });
  }
}

test("sort and view remain URL-backed after the visual migration", async ({ page }) => {
  await page.goto("/listings", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  const toolbar = page.locator(".rawaj-search-toolbar");
  await toolbar
    .getByRole("combobox", { name: /ترتيب النتائج|Sort results/ })
    .selectOption("cheapest");
  await expect(page).toHaveURL(/sort=cheapest/);
  await toolbar.getByRole("button", { name: /عرض قائمة|List view/ }).click();
  await expect(page).toHaveURL(/view=list/);
  await expect(toolbar.getByRole("button", { name: /عرض قائمة|List view/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".rawaj-results-grid").last()).toHaveAttribute("data-view", "list");
});

test("mobile price drafts apply to the URL and can be reset", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/listings");
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  await page.getByRole("button", { name: /فتح الفلاتر|Open filters/ }).click();
  const sheet = page.locator(".rawaj-filter-sheet");
  await sheet.getByLabel(/السعر من|Price from/).fill("100");
  await sheet.getByLabel(/السعر إلى|Price to/).fill("500");
  await expect(page).not.toHaveURL(/price_min/);
  await sheet.getByRole("button", { name: /تطبيق وعرض النتائج|Apply and show results/ }).click();
  await expect(page).toHaveURL(/price_min=100/);
  await expect(page).toHaveURL(/price_max=500/);
  await expect(sheet).not.toBeVisible();
  await page.getByRole("button", { name: /فتح الفلاتر|Open filters/ }).click();
  await sheet.getByRole("button", { name: /مسح الفلاتر|Clear filters/ }).click();
  await expect(page).not.toHaveURL(/price_min|price_max/);
});

test("search remains operable with 200% text at 320px", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/listings");
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  const toolbar = page.locator(".rawaj-search-toolbar");
  const input = toolbar.locator('input[type="search"]');
  await input.focus();
  await input.press("a");
  await expect(input).toHaveCSS("outline-color", "rgb(8, 99, 94)");
  expect((await input.boundingBox())?.width).toBeGreaterThanOrEqual(80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const openFilters = toolbar.getByRole("button", { name: /فتح الفلاتر|Open filters/ });
  await openFilters.scrollIntoViewIfNeeded();
  await expect(openFilters).toBeInViewport();
  await testInfo.attach("search-200-percent", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
});

for (const state of ["empty", "error"] as const) {
  test(`search ${state} state retains readable recovery actions`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.route(/\/v1\/listings(?:\?|$)/, (route) =>
      route.fulfill({
        status: state === "empty" ? 200 : 503,
        contentType: "application/json",
        body: JSON.stringify(
          state === "empty"
            ? { data: { items: [], nextCursor: null, pageSize: 30 } }
            : { error: { code: "unavailable", message: "Fixture unavailable" } },
        ),
      }),
    );
    await page.goto("/listings");
    await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
    if (state === "empty") {
      await expect(page.locator(".rawaj-search-empty-state")).toBeVisible();
      await expect(page.locator(".rawaj-search-empty-state")).toHaveCSS(
        "background-color",
        "rgb(255, 250, 243)",
      );
    } else {
      await expect(
        page.getByText(/تعذر تحميل الإعلانات|Could not load listings/, { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /إعادة المحاولة|Try again/ })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
