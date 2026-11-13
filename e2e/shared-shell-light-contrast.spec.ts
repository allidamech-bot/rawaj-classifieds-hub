import { expect, test } from "@playwright/test";

test("shared light navigation and footer win over legacy Home CSS", async ({ page }) => {
  for (const path of ["/", "/categories", "/terms"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
    const header = page.locator('header[data-shell-region="header-region"]').first();
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS("background-color", "rgb(255, 255, 255)");
    const footer = page.locator(".rawaj-site-footer");
    await expect(footer).toBeVisible();
    await expect(footer).toHaveCSS("background-color", "rgb(255, 255, 255)");
  }
});
