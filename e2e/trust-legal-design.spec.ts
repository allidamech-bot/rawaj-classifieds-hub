import { expect, test } from "@playwright/test";

test("trust pages use the accessible light hero", async ({ page }) => {
  for (const route of ["/support", "/safety"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
    const hero = page.locator(".rawaj-trust-hero");
    await expect(hero).toBeVisible();
    await expect(hero).toHaveCSS("background-color", "rgb(255, 255, 255)");
  }
});

test("terms and privacy paragraphs use readable type without shadowed cards", async ({ page }) => {
  for (const route of ["/terms", "/privacy"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
    const section = page.locator(".rawaj-legal-v3 > div.grid > section").first();
    await expect(section).toBeVisible();
    const layout = await section.evaluate((element) => ({
      shadow: getComputedStyle(element).boxShadow,
      fontSize: Number.parseFloat(getComputedStyle(element.querySelector("p")!).fontSize),
    }));
    expect(layout.shadow).toBe("none");
    expect(layout.fontSize).toBeGreaterThanOrEqual(15);
  }
});

test("prohibited policy listing retains legible white cards", async ({ page }) => {
  await page.goto("/prohibited", { waitUntil: "domcontentloaded" });
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
  const item = page.locator(".rawaj-prohibited-v3 > div.grid > article").first();
  await expect(item).toBeVisible();
  await expect(item).toHaveCSS("background-color", "rgb(255, 255, 255)");
  const fontSize = await item
    .locator("span")
    .last()
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(15);
});
