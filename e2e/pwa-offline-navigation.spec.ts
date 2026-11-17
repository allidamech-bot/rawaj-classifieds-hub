import { expect, test } from "@playwright/test";

test("installed PWA fallback restores the original route after connection returns", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Chromium network emulation; physical iOS is separate");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    localStorage.setItem("rawaj-language", "en");
  });
  await page.goto("/");
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return registration?.active?.scriptURL.endsWith("/rawaj-offline-sw.js");
  });
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith("/rawaj-offline-sw.js"),
  );
  await context.setOffline(true);
  try {
    await page.goto("/categories?offline-test=1");
    await expect(page.getByRole("heading", { name: "Connection unavailable" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect
      .poll(() =>
        page.locator("main img").evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("heading", { name: "Connection unavailable" })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { name: "Connection unavailable" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/categories\?offline-test=1$/);
});
