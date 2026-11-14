import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 320, height: 720 },
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 900 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1600, height: 1000 },
] as const;

test.describe("premium listing workflow responsiveness", () => {
  test.setTimeout(180_000);

  test("keeps Add Listing and My Store compact and overflow-free", async ({ page }) => {
    await signIn(page, "/add-listing");
    const selector = page.locator('[data-listing-taxonomy-selector="true"]');
    await expect(selector).toBeVisible({ timeout: 30_000 });

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(75);
      await expectNoPageOverflow(page, `add-listing:${viewport.width}`);

      if (viewport.width < 768) {
        const hero = await page.locator('.rawaj-studio-hero[data-variant="compact"]').boundingBox();
        expect(hero?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(105);
        expect((await selector.boundingBox())?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
          viewport.height,
        );
        for (const height of await selector
          .locator(".rawaj-taxonomy-option")
          .evaluateAll((options) =>
            options.map((option) => option.getBoundingClientRect().height),
          )) {
          expect(height).toBeGreaterThanOrEqual(44);
        }
      }
    }

    await page.setViewportSize({ width: 320, height: 720 });
    for (let depth = 0; depth < 3; depth += 1) {
      await selector.locator('[data-taxonomy-kind="branch"]').first().click();
    }
    await expect(selector).toHaveAttribute("data-taxonomy-depth", "3");
    await expectNoPageOverflow(page, "add-listing:deep-taxonomy");
    await selector.locator('[data-taxonomy-kind="leaf"]').first().click();
    await expect(
      selector.getByText(/تم اختيار التصنيف النهائي|Final category selected/i),
    ).toBeVisible();
    await expectNoPageOverflow(page, "add-listing:selected-taxonomy");

    await page.goto("/profile/listings", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    // My Store was rebuilt around the approved owner storefront. Its old
    // control-center and workspace-summary selectors are intentionally gone.
    const ownerWorkspace = page.locator("main.my-store");
    await expect(ownerWorkspace).toBeVisible({ timeout: 30_000 });
    await expect(ownerWorkspace.locator('.my-store-hero[data-store-view="owner"]')).toBeVisible();
    await expect(ownerWorkspace.locator(".ms-owner-inventory")).toBeVisible();
    await expect(
      ownerWorkspace.getByRole("link", { name: /إضافة إعلان|Add Listing/i }),
    ).toBeVisible();

    const searchToggle = ownerWorkspace.getByRole("button", {
      name: /فتح البحث|Open search/i,
    });
    const storeSearch = ownerWorkspace.locator(".my-store-search input");
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(75);
      await expectNoPageOverflow(page, `profile-listings:${viewport.width}`);
      await expect(ownerWorkspace.locator(".ms-approved-tabs")).toBeVisible();

      if (viewport.width < 768) {
        await expect(searchToggle).toBeVisible();
        if ((await searchToggle.getAttribute("aria-expanded")) !== "true") {
          await searchToggle.click();
        }
      }
      // Desktop shows the search field directly. On mobile it is deliberately
      // hidden until the 44px search-toggle control is activated.
      await expect(storeSearch).toBeVisible();
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.localStorage.setItem("rawaj-language", "en"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expectNoPageOverflow(page, "profile-listings:english-ltr");
  });
});

async function signIn(page: Page, returnTo: string): Promise<void> {
  await page.addInitScript(() => {
    const marker = "rawaj:e2e:storage-cleared";
    if (window.sessionStorage.getItem(marker) === "1") return;
    window.localStorage.clear();
    window.sessionStorage.setItem(marker, "1");
  });
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForHydration(page);
  await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill("browser-smoke@rawa-j.test");
  await page.locator('form input[type="password"]').fill("Rawaj-E2E-Password-1");
  await page
    .locator("form")
    .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
    .click();
}

async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1, {
    timeout: 30_000,
  });
}

async function expectNoPageOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} must not create horizontal page overflow`).toBeLessThanOrEqual(1);
}
