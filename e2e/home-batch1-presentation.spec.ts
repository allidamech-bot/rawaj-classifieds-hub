import { expect, test } from "@playwright/test";

// Local E2E fixture only; this suite never signs into production.
for (const language of ["ar", "en"] as const) {
  test(`B1 home signed-in store label stays legible in ${language}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((locale) => {
      localStorage.setItem("rawaj-language", locale);
      localStorage.setItem(
        "rawaj:e2e:firebase-user",
        JSON.stringify({ email: "browser-smoke@rawa-j.test" }),
      );
    }, language);

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 200).toBe(200);
    await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
    const store = page.locator(".rawaj-app-header .rawaj-header-store");
    await expect(store).toBeVisible();
    const label = store.locator(".rawaj-header-store__label");
    await expect(label).toHaveText(language === "ar" ? "متجري" : "My store");
    const metrics = await label.evaluate((node) => {
      const text = node.getBoundingClientRect();
      const hitTarget = node.parentElement!.getBoundingClientRect();
      return {
        fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
        clipped:
          text.left < hitTarget.left - 1 ||
          text.right > hitTarget.right + 1 ||
          text.top < hitTarget.top - 1 ||
          text.bottom > hitTarget.bottom + 1,
        hitHeight: hitTarget.height,
        generatedLabel: getComputedStyle(node.parentElement!, "::after").content,
      };
    });
    expect(metrics.fontSize).toBeGreaterThanOrEqual(11);
    expect(metrics.clipped).toBe(false);
    expect(metrics.hitHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.generatedLabel).toBe("none");

    const hero = page.locator(".rawaj-signature-hero");
    const search = page.locator(".rawaj-signature-search");
    await expect(hero).toBeVisible();
    await expect(search).toBeVisible();
    const geometry = await page.evaluate(() => {
      const header = document.querySelector(".rawaj-app-header")!.getBoundingClientRect();
      const heading = document
        .querySelector(".rawaj-signature-hero__tagline")!
        .getBoundingClientRect();
      const form = document.querySelector(".rawaj-signature-search")!.getBoundingClientRect();
      const button = document
        .querySelector(".rawaj-signature-search button")!
        .getBoundingClientRect();
      return {
        headlineClear: heading.top >= header.bottom - 2,
        formWithinViewport: form.left >= -2 && form.right <= innerWidth + 2,
        buttonHeight: button.height,
        inputFontSize: Number.parseFloat(
          getComputedStyle(document.querySelector("#rawaj-signature-search-input")!).fontSize,
        ),
      };
    });
    expect(geometry.headlineClear).toBe(true);
    expect(geometry.formWithinViewport).toBe(true);
    expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.inputFontSize).toBeGreaterThanOrEqual(16);
    await page.screenshot({
      path: testInfo.outputPath(`b1-home-header-${language}-390.png`),
      animations: "disabled",
    });
  });
}

test("B1 narrow guest home search stays usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
  const input = page.locator("#rawaj-signature-search-input");
  await expect(input).toBeVisible();
  await input.fill("سيارة");
  await expect(input).toHaveValue("سيارة");
  const widths = await page.evaluate(() => ({
    window: innerWidth,
    document: document.documentElement.scrollWidth,
    search: document.querySelector(".rawaj-signature-search")!.getBoundingClientRect().width,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.window + 2);
  expect(widths.search).toBeGreaterThan(200);
});
