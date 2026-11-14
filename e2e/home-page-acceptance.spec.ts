import { expect, test, type Page } from "@playwright/test";

const MOCK_AD_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='700' viewBox='0 0 1600 700'%3E%3Crect width='1600' height='700' fill='%23123f38'/%3E%3C/svg%3E";

async function openHydrated(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  await expect(page.locator('[data-shell-region="page-content"] main:visible')).toHaveCount(1);
}

function mockAdPlacementResponse() {
  return JSON.stringify({
    data: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        imageUrl: MOCK_AD_IMAGE,
        destinationUrl: "https://example.com/rawaj-ad",
        priority: 100,
      },
    ],
  });
}

async function mockPublicAdApi(page: Page) {
  await page.route(/\/v1\/ad-placements(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: mockAdPlacementResponse(),
    });
  });
}

test("home category cards expose unique canonical destinations", async ({ page }) => {
  await openHydrated(page, "/");

  const categoryLinks = page.locator(".rawaj-signature-category-chip");
  await expect(categoryLinks.first()).toBeVisible();
  const count = await categoryLinks.count();

  const destinations = await categoryLinks.evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href") ?? ""),
  );
  expect(new Set(destinations).size).toBe(destinations.length);
  for (const destination of destinations) {
    expect(destination).toMatch(/^\/(?:categories|listings|category\/)/);
    expect(destination).not.toContain("undefined");
    expect(destination).not.toContain("null");
  }

  await categoryLinks.first().click();
  await expect(page).not.toHaveURL(/\/$/);
  await expect(page.locator("main.rawaj-signature-home")).toHaveCount(0);
  await expect(page.locator('[data-shell-region="page-content"] main:visible')).toHaveCount(1);
});

test("featured and latest home inventory never repeat the same listing", async ({ page }) => {
  await openHydrated(page, "/");

  const featured = await page
    .locator('.rawaj-signature-featured a[href^="/listings/"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).pathname));
  const latestLinks = page.locator('.rawaj-signature-latest a[href^="/listings/"]');
  await expect(latestLinks.first()).toBeVisible();
  const latest = await latestLinks.evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).pathname),
  );

  expect(latest.length).toBeGreaterThan(0);
  expect(new Set(featured).size).toBe(featured.length);
  expect(new Set(latest).size).toBe(latest.length);

  const latestSet = new Set(latest);
  for (const listingPath of featured) expect(latestSet.has(listingPath)).toBe(false);
});

test("browser back and forward keep exactly one resolved page", async ({ page }) => {
  await openHydrated(page, "/");
  const shell = page.locator(".rawaj-app-shell");

  await page.locator(".rawaj-signature-location").click();
  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  await expect(shell).toHaveAttribute("data-resolved-pathname", "/listings");
  await expect(page.locator('[data-shell-region="page-content"] main:visible')).toHaveCount(1);
  await expect(page.locator("main.rawaj-signature-home")).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(shell).toHaveAttribute("data-resolved-pathname", "/");
  await expect(page.locator('[data-shell-region="page-content"] main:visible')).toHaveCount(1);
  await expect(page.locator("main.rawaj-signature-home")).toHaveCount(1);

  await page.goForward();
  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  await expect(shell).toHaveAttribute("data-resolved-pathname", "/listings");
  await expect(page.locator('[data-shell-region="page-content"] main:visible')).toHaveCount(1);
  await expect(page.locator("main.rawaj-signature-home")).toHaveCount(0);
});

test("all supported routes mount one correctly targeted public ad slot", async ({
  page,
}, testInfo) => {
  test.skip(
    !["mobile-chromium", "desktop-chromium"].includes(testInfo.project.name),
    "Chromium mobile and desktop placement contract",
  );
  await mockPublicAdApi(page);

  await openHydrated(page, "/");
  const firstListing = page.locator('.rawaj-signature-latest a[href^="/listings/"]').first();
  await expect(firstListing).toBeVisible();
  const firstListingPath = await firstListing.getAttribute("href");
  expect(firstListingPath).toMatch(/^\/listings\//);

  const routes = [
    { path: "/", placement: "home" },
    { path: "/listings", placement: "search_results" },
    { path: "/categories", placement: "categories" },
    { path: "/offers", placement: "offers" },
    { path: firstListingPath!, placement: "listing_detail" },
  ] as const;
  const expectedDevice = testInfo.project.name.startsWith("mobile") ? "mobile" : "desktop";

  for (const route of routes) {
    await openHydrated(page, route.path);
    const slot = page.locator(`[data-placement-page="${route.placement}"]`);
    await expect(slot).toBeVisible();
    await expect(slot).toHaveAttribute("data-placement-device", expectedDevice);
    await expect(slot).toHaveAttribute("data-placement-loading", "false");
    await expect(page.locator("[data-placement-page]")).toHaveCount(1);
    const contentImage = slot.locator("img.rawaj-ad-placement__image");
    await expect(contentImage).toHaveAttribute("width", "1600");
    await expect(contentImage).toHaveAttribute("height", "700");
  }
});

test("active home ad mounts without an empty SSR placeholder or shifting main content", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Single deterministic layout check");

  let releaseRequest = () => {};
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route(/\/v1\/ad-placements(?:\?|$)/, async (route) => {
    await requestGate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: mockAdPlacementResponse(),
    });
  });

  try {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");

    await expect(
      page.locator('[data-placement-page="home"][data-placement-loading="true"]'),
    ).toHaveCount(0);
    const mainTopBefore = (await page.locator("main.rawaj-signature-home").boundingBox())?.y;
    expect(mainTopBefore).toBeDefined();

    releaseRequest();
    const loadedSlot = page.locator('[data-placement-page="home"][data-placement-loading="false"]');
    await expect(loadedSlot).toBeVisible();
    const mainTopAfter = (await page.locator("main.rawaj-signature-home").boundingBox())?.y;
    expect(mainTopAfter).toBeDefined();
    expect(Math.abs(mainTopAfter! - mainTopBefore!)).toBeLessThanOrEqual(1);
  } finally {
    releaseRequest();
  }
});
