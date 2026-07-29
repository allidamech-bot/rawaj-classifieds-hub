import { expect, test } from "@playwright/test";

test("mobile listing filters scroll inside a fixed sheet with visible actions", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1440) >= 768, "Mobile filter sheet behavior");

  const response = await page.goto("/listings", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);

  const openFilters = page.getByRole("button", { name: /فتح الفلاتر|Open filters/i });
  await expect(openFilters).toBeVisible();
  await openFilters.click();

  const sheet = page.locator('.rawaj-filter-sheet[data-scroll-mode="content"]');
  const body = sheet.locator(".rawaj-filter-sheet__body");
  const footer = sheet.locator(".rawaj-filter-sheet__footer");
  const applyButton = footer.getByRole("button", {
    name: /تطبيق وعرض النتائج|Apply and show results/i,
  });

  await expect(sheet).toBeVisible();
  await expect(body).toBeVisible();
  await expect(footer).toBeVisible();
  await expect(applyButton).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: /توسيع نافذة الفلاتر|Expand filter sheet/i }),
  ).toHaveCount(0);

  const initialSheetBox = await sheet.boundingBox();
  expect(initialSheetBox).not.toBeNull();

  const metrics = await body.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: getComputedStyle(element).overflowY,
    touchAction: getComputedStyle(element).touchAction,
  }));

  expect(metrics.overflowY).toBe("auto");
  expect(metrics.touchAction).toBe("pan-y");
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  await body.evaluate((element) => {
    element.scrollTop = Math.min(320, element.scrollHeight - element.clientHeight);
  });
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  const scrolledSheetBox = await sheet.boundingBox();
  expect(scrolledSheetBox).not.toBeNull();
  expect(Math.abs(scrolledSheetBox!.y - initialSheetBox!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(scrolledSheetBox!.height - initialSheetBox!.height)).toBeLessThanOrEqual(1);

  const footerBox = await footer.boundingBox();
  const viewport = page.viewportSize();
  expect(footerBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewport!.height + 1);
});
