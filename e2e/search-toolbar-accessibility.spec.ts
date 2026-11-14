import { expect, test } from "@playwright/test";

// Exercise the actual toolbar at the narrowest supported width, including a
// query so the clear button replaces the decorative keyboard shortcut.
test("search toolbar keeps a usable clear target and native input direction at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/listings?q=Toyota", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  const toolbar = page.locator(".rawaj-search-toolbar");
  const input = toolbar.locator('input[type="search"]');
  const clear = toolbar.locator(".rawaj-search-toolbar__clear-query");
  await expect(clear).toBeVisible();
  const box = await clear.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  const metrics = await input.evaluate((element) => ({
    fontSize: parseFloat(getComputedStyle(element).fontSize),
    direction: getComputedStyle(element).direction,
    description: element.getAttribute("aria-describedby"),
  }));
  expect(metrics.fontSize).toBeGreaterThanOrEqual(16);
  expect(metrics.direction).toBe("ltr");
  expect(metrics.description).toBeNull();
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(toolbar.locator("#rawaj-search-shortcut")).toBeVisible();
  await expect(input).toHaveAttribute("aria-describedby", "rawaj-search-shortcut");
  await input.fill("سيارة");
  await expect(input).toHaveCSS("direction", "rtl");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
