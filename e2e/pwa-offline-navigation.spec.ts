import { expect, test } from "@playwright/test";

test("PWA fallback is branded, localized and recovers the original route", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium offline emulation; iOS device verification is separate");
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/rawaj-offline-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    localStorage.setItem("rawaj-language", "en");
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith("/rawaj-offline-sw.js"));
  await context.setOffline(true);
  try {
    await page.goto("/categories?offline-test=1");
    await expect(page.getByRole("heading", { name: "Could not connect to Rawaj" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.locator(".brand img")).toBeVisible();
    await expect.poll(() => page.locator(".brand img").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "Could not connect to Rawaj" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(".offline-shell")).toHaveCount(0);
  await expect(page).toHaveURL(/\/categories\?offline-test=1$/);
});
