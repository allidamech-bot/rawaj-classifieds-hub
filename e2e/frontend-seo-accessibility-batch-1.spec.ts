import { expect, test } from "@playwright/test";

const publicCanonicalRoutes = [
  "/",
  "/categories",
  "/listings",
  "/offers",
  "/support",
  "/terms",
  "/privacy",
  "/safety",
  "/prohibited",
] as const;

for (const path of publicCanonicalRoutes) {
  test(`${path} exposes its own canonical URL`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    await expect(canonical).toHaveAttribute("href", new URL(path, "https://rawa-j.com").href);
  });
}

test("unknown routes return a real noindex 404 without a home canonical", async ({ page }) => {
  const missingPath = "/__rawaj_accessibility_batch_1_missing__";
  const response = await page.goto(missingPath, { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(/الصفحة غير موجودة|Page not found/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
});

test("login uses localized accessible email validation and one page heading", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");

  await expect(page.locator("h1")).toHaveCount(1);
  const email = page.locator('input[type="email"]');
  await email.fill("not-an-email");
  await expect(email).toHaveValue("not-an-email");
  await page.locator('form button[type="submit"]').click();

  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "login-email-error");
  const error = page.locator("#login-email-error");
  await expect(error).toHaveAttribute("role", "alert");
  await expect(error).toContainText(/بريدًا إلكترونيًا صالحًا|valid email address/);
});

test("support, account and signed-out chat states expose one page heading", async ({ page }) => {
  for (const path of ["/support", "/profile", "/chats"] as const) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toHaveCount(1);
  }
});

test("saved-search navigation omits empty search parameters", async ({ page }) => {
  await page.goto("/listings", { waitUntil: "domcontentloaded" });

  const savedSearchLink = page.locator('a[href^="/saved-searches"]').first();
  await expect(savedSearchLink).toHaveAttribute("href", "/saved-searches");
  await savedSearchLink.click();
  await expect(page).toHaveURL(/\/saved-searches$/);
});

test("location search fields have an accessible name", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "The canonical location search is rendered in the desktop filter surface.",
  );
  await page.goto("/listings", { waitUntil: "domcontentloaded" });

  const locationSearch = page.getByRole("searchbox", {
    name: /البحث عن موقع|Search for a location/,
  });
  await expect(locationSearch).toBeVisible();
});
