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
      updatedAt: `2026-11-${String(12 - i).padStart(2, "0")}T12:00:00Z`,
    }));
    await route.fulfill({ json: body });
  });
  await page.goto("/profile/listings");
  await expect(page.locator(".my-store")).toBeVisible();
  await expect(page.locator(".ms-owner-listing-card")).toHaveCount(4);
  await expect(page.locator(".my-store-cover img")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  // A rendered-page regression guard: global legacy styles previously made
  // the entire ivory storefront charcoal and left headings/prices unreadable.
  for (const [selector, property, expected] of [
    ["main.my-store", "backgroundColor", "rgb(252, 250, 247)"],
    [".my-store-identity h1", "color", "rgb(16, 23, 22)"],
    [".my-store-stats dd", "color", "rgb(21, 35, 34)"],
    [".ms-owner-listing-card", "backgroundColor", "rgb(255, 253, 250)"],
    [".ms-owner-listing-card__summary h3", "color", "rgb(16, 23, 22)"],
    [".ms-store-card-price", "color", "rgb(16, 63, 66)"],
    [".ms-approved-tabs button[aria-pressed='true']", "color", "rgb(16, 63, 66)"],
  ] as const) {
    await expect
      .poll(() =>
        page
          .locator(selector)
          .first()
          .evaluate(
            (element, key) => getComputedStyle(element)[key as keyof CSSStyleDeclaration],
            property,
          ),
      )
      .toBe(expected);
  }
  for (const width of [390, 768, 1440, 320, 430]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1050 : 1000 });
    if (width <= 430) {
      await expect
        .poll(() =>
          page
            .locator("[data-shell-region=bottom-dock-region]")
            .evaluate((el) => getComputedStyle(el).backgroundColor),
        )
        .toBe("rgba(0, 0, 0, 0)");
      await expect
        .poll(() =>
          page
            .locator("[data-shell-region=bottom-dock-region]")
            .evaluate((el) => getComputedStyle(el).backdropFilter),
        )
        .toBe("none");
      await expect
        .poll(() =>
          page
            .locator("[data-dock-surface]")
            .evaluate((el) => getComputedStyle(el).backgroundColor),
        )
        .toBe("rgb(16, 63, 66)");
    }
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
  await expect
    .poll(() =>
      page
        .locator(".ms-approved-tabs > button[aria-pressed='true']")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe("rgba(0, 0, 0, 0)");
  await page.screenshot({
    path: testInfo.outputPath("owner-store-mobile-dock.png"),
    fullPage: false,
  });
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
  await expect(page.locator(".my-store-owner-menu")).not.toHaveAttribute("open", "");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Drafts & edits")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".my-store-dialog .ms-storefront-owner-tabs")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgba(0, 0, 0, 0)");
  await expect
    .poll(() =>
      page
        .locator(".my-store-dialog .ms-storefront-owner-tabs > button[aria-pressed='true']")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(16, 63, 66)");
  await page.screenshot({
    path: testInfo.outputPath("store-management-390.png"),
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await test.step("My Store tabs do not intercept Manage Store at 480, 500, and 520px", async () => {
    for (const width of [480, 500, 520]) {
      await page.setViewportSize({ width, height: 820 });
      const options = page.locator(".my-store-owner-menu summary");
      await options.click();
      await page.getByRole("button", { name: "Manage store", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Manage store" });
      await expect(dialog).toBeVisible();
      await expect
        .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
        .toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await page.getByRole("button", { name: "About", exact: true }).click();
      await expect(page.getByText("About this store", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: /Listings \(/ }).click();
    }
    await page.setViewportSize({ width: 390, height: 1000 });
  });
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

test("public seller has owner-level visual fidelity without owner actions", async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    localStorage.setItem("rawaj-language", "en");
  });
  await page.goto("/seller/00000000-0000-4000-8000-000000000010");
  // Wait for React hydration and the requested locale before clicking anchor tabs.
  // Otherwise a click can hit SSR-only markup before its onClick handler exists.
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  await expect(page.locator(".my-store-public .my-store-add")).toContainText("Browse listings");
  await expect(page.locator("main.my-store-public")).toBeVisible();
  await expect(page.locator(".my-store-hero[data-store-view='public']")).toBeVisible();
  await expect(page.locator(".my-store-identity h1")).toBeVisible();
  await expect(page.locator(".my-store-owner-menu")).toHaveCount(0);
  await expect(page.locator(".my-store-public .my-store-add")).toHaveAttribute(
    "href",
    "#storefront-listings",
  );
  await expect(page.locator("#seller-reviews")).toBeVisible();
  await expect(page.locator(".my-store-public-reviews")).toBeVisible();
  await expect(page.locator(".my-store-public-safety")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("#seller-about")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(255, 253, 250)");
  for (const selector of [".my-store-public-reviews", ".my-store-public-safety"]) {
    await expect
      .poll(() =>
        page.locator(selector).evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .toBe("rgb(255, 253, 250)");
  }
  await expect(page.locator(".my-store-public-grid .my-store-public-card").first()).toBeVisible();
  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1050 : 950 });
    if (width < 1024) {
      await expect
        .poll(() =>
          page
            .locator("[data-shell-region=bottom-dock-region]")
            .evaluate((el) => getComputedStyle(el).backgroundColor),
        )
        .toBe("rgba(0, 0, 0, 0)");
      await expect
        .poll(() =>
          page
            .locator("[data-shell-region=bottom-dock-region]")
            .evaluate((el) => getComputedStyle(el).backdropFilter),
        )
        .toBe("none");
      await expect
        .poll(() =>
          page
            .locator("[data-dock-surface]")
            .evaluate((el) => getComputedStyle(el).backgroundColor),
        )
        .toBe("rgb(16, 63, 66)");
      await expect(page.locator("[data-dock-surface] [data-section='categories']")).toHaveAttribute(
        "data-active",
        "false",
      );
    }
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect
      .poll(() =>
        page
          .locator("main.my-store-public")
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .toBe("rgb(252, 250, 247)");
    await page.screenshot({
      path: testInfo.outputPath("buyer-store-" + width + ".png"),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 950 });
  const firstTab = page.locator('.my-store-public-tabs > a[href="#storefront-listings"]');
  await expect(firstTab).toHaveAttribute("aria-current", "location");
  await expect
    .poll(() => firstTab.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgba(0, 0, 0, 0)");
  await expect.poll(() => firstTab.evaluate((el) => getComputedStyle(el).boxShadow)).toBe("none");
  await page.locator('.my-store-public-tabs a[href="#seller-about"]').click();
  await expect(page.locator('.my-store-public-tabs a[href="#seller-about"]')).toHaveAttribute(
    "aria-current",
    "location",
  );
  await firstTab.click();
  await expect(firstTab).toHaveAttribute("aria-current", "location");
  await expect(page.locator(".my-store-public .my-store-public-follow")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".my-store-public .my-store-actions").evaluate((row) => {
        const browse = row.querySelector(".my-store-add")?.getBoundingClientRect();
        const share = row.querySelector(":scope > button")?.getBoundingClientRect();
        return browse && share ? Math.abs(browse.y - share.y) : Infinity;
      }),
    )
    .toBeLessThan(8);
  await page.locator(".my-store-public .my-store-actions").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("buyer-store-mobile-dock.png"),
    fullPage: false,
  });
  await page.locator(".my-store-topbar .my-store-nav summary").click();
  await page.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(page.locator(".my-store-public-page")).toHaveAttribute("dir", "rtl");
  await expect(page.locator(".my-store-public-tabs > a").first()).toContainText("الإعلانات");
  await page.locator(".my-store-topbar .my-store-nav summary").click();
  await expect(page.locator(".my-store-topbar .my-store-nav")).not.toHaveAttribute("open", "");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect
    .poll(() => firstTab.evaluate((el) => getComputedStyle(el).backgroundColor))
    .toBe("rgba(0, 0, 0, 0)");
  await page.screenshot({ path: testInfo.outputPath("buyer-store-390-rtl.png"), fullPage: true });
  await page.locator(".my-store-public-card").first().click();
  await expect(page).toHaveURL(/\/listings\//);
});
