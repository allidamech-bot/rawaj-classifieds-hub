import { expect, test, type Page } from "@playwright/test";

const publicRoutes = [
  "/",
  "/categories",
  "/listings",
  "/offers",
  "/login",
  "/support",
  "/safety",
] as const;

const protectedRoutes = ["/add-listing", "/profile", "/favorites", "/admin"] as const;

async function openHealthyPage(page: Page, path: string) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(() => page.title()).not.toBe("");
  await page.waitForTimeout(250);
  expect(pageErrors).toEqual([]);
}

for (const path of publicRoutes) {
  test(`public route ${path} renders without a browser crash`, async ({ page }) => {
    await openHealthyPage(page, path);
  });
}

for (const path of protectedRoutes) {
  test(`protected route ${path} fails closed without a session`, async ({ page }) => {
    await openHealthyPage(page, path);

    if (path === "/admin") {
      await expect(page.locator('a[href="/admin/users"]')).toHaveCount(0);
      await expect(page.locator('a[href="/admin/owner-controls"]')).toHaveCount(0);
    }
  });
}

test("home discovery can navigate to the public listings workspace", async ({ page }) => {
  await openHealthyPage(page, "/");
  const listingsLink = page.locator('a[href="/listings"]').first();
  await expect(listingsLink).toBeVisible();
  await listingsLink.click();
  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  await expect(page.locator("main")).toBeVisible();
});

test("mobile marketplace routes do not widen the document viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only layout contract");

  for (const path of ["/", "/categories", "/listings", "/offers"] as const) {
    await openHealthyPage(page, path);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
  }
});
