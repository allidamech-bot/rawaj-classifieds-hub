import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("root error boundary remains usable when reference data fails", async ({ page }, testInfo) => {
  await page.route("**/v1/references*", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "temporarily_unavailable", message: "Temporarily unavailable" },
      }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    history.pushState({}, "", "/category/vehicles");
    window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  });

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "حدث خطأ غير متوقع" })).toBeVisible();
  const retry = page.getByRole("button", { name: "إعادة المحاولة" });
  await expect(retry).toBeVisible();
  const retryBox = await retry.boundingBox();
  expect(retryBox?.height ?? 0).toBeGreaterThanOrEqual(40);

  await page.screenshot({
    path: testInfo.outputPath("root-error-boundary-390x844.png"),
    fullPage: true,
    animations: "disabled",
  });
});
