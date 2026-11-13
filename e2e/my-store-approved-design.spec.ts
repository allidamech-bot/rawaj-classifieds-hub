import { test, expect } from "@playwright/test";
import path from "node:path";

// Local browser fixtures only. These are representative data, never production store records.
test("approved store composition and owner interactions", async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await page.setExtraHTTPHeaders({ "x-rawaj-e2e-owner-listing-lifecycle": "1" });
  await page.addInitScript(() => {
    localStorage.setItem(
      "rawaj:e2e:firebase-user",
      JSON.stringify({ email: "browser-smoke@rawa-j.test" }),
    );
    localStorage.setItem("rawaj-language", "en");
  });
  await page.route("**/__store-photo.jpg", (route) =>
    route.fulfill({
      path: path.resolve("e2e/assets/my-store/sofa.jpg"),
      contentType: "image/jpeg",
    }),
  );
  await page.route("**/__store-cover.jpg", (route) =>
    route.fulfill({
      path: path.resolve("e2e/assets/my-store/room.jpg"),
      contentType: "image/jpeg",
    }),
  );
  await page.route("**/api/profile", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    Object.assign(body.data, {
      businessName: "Damascus Furniture",
      displayName: "Store owner",
      cityArea: "Damascus, Syria",
      bio: "Modern and high-quality home furniture with elegant designs and competitive prices.",
      avatarUrl: "/brand/rawaj-icon-192.png",
      coverUrl: "/__store-cover.jpg",
    });
    await route.fulfill({ json: body });
  });
  await page.route("**/v1/account/listings", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const item = body.data[0];
    body.data = [
      "Modern 3-Seater Sofa",
      "Dining Table with 6 Chairs",
      "King Size Bed with Storage",
      "3-Door Wardrobe",
    ].map((title, i) => ({
      ...item,
      id: `00000000-0000-4000-8000-00000000008${i}`,
      title,
      categoryId: i === 1 ? "cat-home" : "cat-furniture",
      primaryImageUrl: "/__store-photo.jpg",
      price: [5900000, 8750000, 7200000, 4100000][i],
      updatedAt: `2026-11-${12 - i}T12:00:00Z`,
    }));
    await route.fulfill({ json: body });
  });
  await page.goto("/profile/listings");
  await expect(page.locator(".my-store")).toBeVisible();
  await expect(page.locator(".ms-owner-listing-card")).toHaveCount(4);
  await expect(page.locator(".my-store-cover img")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 768, 1440, 320, 430]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1050 : 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`store-${width}.png`), fullPage: true });
    const columns = await page
      .locator(".ms-storefront-owner-grid")
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(width >= 1024 ? 4 : width >= 640 ? 2 : 1);
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.getByRole("button", { name: "About", exact: true }).click();
  await expect(page.getByText("About this store", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Reviews \(/ }).click();
  await expect(page.getByText("No approved reviews yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Listings \(/ }).click();
  await page.getByRole("button", { name: "Open search" }).click();
  await page.getByRole("textbox", { name: "Search my listings" }).fill("Dining");
  await expect(page.locator(".ms-owner-listing-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search my listings" }).fill("");
  await page.getByLabel("Sort listings", { exact: true }).selectOption("price_asc");
  await expect(page.locator(".ms-owner-listing-card h3").first()).toHaveText("3-Door Wardrobe");
  await page.getByLabel("Listing category", { exact: true }).selectOption("cat-home");
  await expect(page.locator(".ms-owner-listing-card")).toHaveCount(1);
  await page.getByLabel("Listing category", { exact: true }).selectOption("");
  await page
    .getByRole("button", { name: "Listing actions: Modern 3-Seater Sofa", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("link", { name: "View listing", exact: true })).toHaveAttribute(
    "href",
    /\/listings\//,
  );
  await page.keyboard.press("Escape");
  await page.locator(".my-store-owner-menu summary").click();
  await page.getByRole("button", { name: "Manage store", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Drafts & edits")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".my-store-add")).toHaveAttribute("href", "/add-listing");
  await page.locator(".my-store-topbar .my-store-nav summary").click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator(".my-store")).toHaveAttribute("dir", "rtl");
  await page.locator(".my-store-topbar .my-store-nav summary").click();
  await page.screenshot({ path: testInfo.outputPath("store-390-rtl.png"), fullPage: true });
  await page.route("**/v1/account/listings", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data = body.data.map((item: object) => ({ ...item, primaryImageUrl: null }));
    await route.fulfill({ json: body });
  });
  await page.reload();
  await expect(page.locator(".rawaj-listing-media--placeholder").first()).toBeVisible();
  expect(
    (await page.locator(".ms-product-media").first().boundingBox())!.height,
  ).toBeLessThanOrEqual(180);
  await page.screenshot({ path: testInfo.outputPath("store-missing-image.png"), fullPage: true });
});
