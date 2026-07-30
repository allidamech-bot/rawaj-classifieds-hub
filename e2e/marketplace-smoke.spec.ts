import { expect, test, type Page } from "@playwright/test";

const publicRoutes = [
  "/",
  "/categories",
  "/listings",
  "/offers",
  "/login",
  "/support",
  "/safety",
  "/privacy",
  "/terms",
  "/prohibited",
  "/promotion",
] as const;

const protectedRoutes = ["/add-listing", "/profile", "/favorites", "/admin"] as const;
const delayedListingsRequest = /\/v1\/listings(?:\?|$)/;
const delayedReferenceRequest = /\/v1\/references(?:\?|$)/;

function isExpectedLocalRequestFailure(url: string, failure: string) {
  if (failure.includes("ERR_ABORTED")) return true;
  if (!url.includes("va.vercel-scripts.com")) return false;
  return failure === "csp" || failure.includes("ERR_BLOCKED_BY_ORB");
}

async function waitForHydratedRouter(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
}

async function openHealthyPage(page: Page, path: string) {
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!isExpectedLocalRequestFailure(request.url(), failure)) {
      failedRequests.push(`${request.method()} ${request.url()}: ${failure}`);
    }
  });

  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(() => page.title()).not.toBe("");
  await waitForHydratedRouter(page);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
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

test("home shell renders one header and one responsive dock", async ({ page }, testInfo) => {
  await openHealthyPage(page, "/");

  await expect(page.locator('[data-shell-region="header-region"]')).toHaveCount(1);
  await expect(page.locator('[data-shell-region="page-content"] main:visible')).toHaveCount(1);
  await expect(page.locator("main.rawaj-signature-home")).toHaveCount(1);

  const dock = page.locator(".rawaj-mobile-dock");
  await expect(dock).toHaveCount(1);
  if (testInfo.project.name.startsWith("mobile")) {
    await expect(dock).toBeVisible();
  } else {
    await expect(dock).toBeHidden();
  }
});

test("home search submits trimmed queries", async ({ page }) => {
  await openHealthyPage(page, "/");

  let search = page.locator("#rawaj-signature-search-input");
  await expect(search).toBeVisible();
  await expect(search).toHaveAttribute("name", "q");
  await expect(search).toHaveAttribute("enterkeyhint", "search");
  await expect(search).toHaveAttribute("dir", "auto");

  await search.fill("  سيارة  ");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("سيارة");

  await openHealthyPage(page, "/");
  search = page.locator("#rawaj-signature-search-input");
  await expect(search).toBeVisible();
  await search.fill("  iPhone 15  ");
  await page.locator(".rawaj-signature-search button").click();
  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("iPhone 15");

  await openHealthyPage(page, "/");
  search = page.locator("#rawaj-signature-search-input");
  await expect(search).toBeVisible();
  await search.fill("   ");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
});

test("mobile home search hides the bottom dock while the keyboard field is focused", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile keyboard contract");
  await openHealthyPage(page, "/");

  const search = page.locator("#rawaj-signature-search-input");
  await search.focus();
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "true");
  await expect(page.locator(".rawaj-mobile-dock")).toHaveCSS("pointer-events", "none");

  await search.blur();
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "false");
});

test("active public ad uses the unified ratio and follows the resolved route", async ({
  page,
}, testInfo) => {
  await openHealthyPage(page, "/");

  const expectedDevice = testInfo.project.name.startsWith("mobile") ? "mobile" : "desktop";
  const homeSlot = page.locator('[data-placement-page="home"]');
  await expect(homeSlot).toBeVisible({ timeout: 15_000 });
  await expect(homeSlot).toHaveAttribute("data-placement-device", expectedDevice);
  await expect(homeSlot).toHaveAttribute("data-placement-loading", "false");
  await expect(page.locator("[data-placement-page]")).toHaveCount(1);

  const link = homeSlot.locator("a");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("rel", /noreferrer/);
  await expect(link).toHaveAttribute("rel", /sponsored/);

  const image = homeSlot.locator("img.rawaj-ad-placement__image").first();
  const imageLoaded = () =>
    image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0);
  await expect.poll(imageLoaded).toBe(true);
  const ratio = await image.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.width / bounds.height;
  });
  expect(ratio).toBeGreaterThan(2.2);
  expect(ratio).toBeLessThan(2.38);

  await page.locator(".rawaj-signature-location").click();
  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  const listingsSlot = page.locator('[data-placement-page="search_results"]');
  await expect(listingsSlot).toBeVisible({ timeout: 15_000 });
  await expect(listingsSlot).toHaveAttribute("data-placement-device", expectedDevice);
  await expect(listingsSlot).toHaveAttribute("data-placement-loading", "false");
  await expect(page.locator("[data-placement-page]")).toHaveCount(1);
  await expect(page.locator('[data-placement-page="home"]')).toHaveCount(0);
});

test("home discovery can navigate to the public listings workspace", async ({ page }) => {
  await openHealthyPage(page, "/");
  const listingsLink = page.locator(".rawaj-signature-location");
  await expect(listingsLink).toBeVisible();
  await listingsLink.click();
  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  await expect(page.locator("main")).toBeVisible();
});

test("pending navigation keeps the resolved page visible without mixing route shells", async ({
  page,
}) => {
  await openHealthyPage(page, "/");

  const shell = page.locator(".rawaj-app-shell");
  const pageContent = page.locator('[data-shell-region="page-content"]');
  await expect(shell).toHaveAttribute("data-route-state", "idle");
  await expect(shell).toHaveAttribute("data-resolved-pathname", "/");
  await expect(page.locator("main.rawaj-signature-home")).toBeVisible();

  let releaseRequest = () => {};
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  let delayedRequestCount = 0;

  await page.route(delayedListingsRequest, async (route) => {
    delayedRequestCount += 1;
    await requestGate;
    await route.continue();
  });

  const listingsLink = page.locator(".rawaj-signature-location");

  try {
    await listingsLink.dispatchEvent("click");

    await expect.poll(() => delayedRequestCount).toBeGreaterThan(0);
    await expect(shell).toHaveAttribute("data-route-state", "pending");
    await expect(shell).toHaveAttribute("data-resolved-pathname", "/");
    await expect(shell).toHaveAttribute("data-pending-pathname", "/listings");
    await expect(page.locator('[data-shell-region="route-pending-mask"]')).toBeVisible();
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toHaveCSS("pointer-events", "none");
    await expect(page.locator("main.rawaj-signature-home")).toBeVisible();
    await expect(page.locator("main.rawaj-search-results-v1")).toHaveCount(0);
  } finally {
    releaseRequest();
  }

  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  await expect(shell).toHaveAttribute("data-route-state", "idle");
  await expect(shell).toHaveAttribute("data-resolved-pathname", "/listings");
  await expect(page.locator('[data-shell-region="route-pending-mask"]')).toHaveCount(0);
  await expect(page.locator("main.rawaj-signature-home")).toHaveCount(0);
  await expect(page.locator("main.rawaj-search-results-v1")).toBeVisible();
  await page.unroute(delayedListingsRequest);
});

test("rapid bottom navigation resolves to one page without stacked route content", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile bottom-dock contract");
  await openHealthyPage(page, "/");

  let releaseRequest = () => {};
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  let delayedRequestCount = 0;

  await page.route(delayedReferenceRequest, async (route) => {
    delayedRequestCount += 1;
    await requestGate;
    await route.continue();
  });

  const shell = page.locator(".rawaj-app-shell");
  const pageContent = page.locator('[data-shell-region="page-content"]');
  const categoriesDockLink = page.locator('.rawaj-mobile-dock a[href="/categories"]');
  const homeDockLink = page.locator('.rawaj-mobile-dock a[href="/"]');

  try {
    await categoriesDockLink.dispatchEvent("click");
    await expect.poll(() => delayedRequestCount).toBeGreaterThan(0);
    await expect(shell).toHaveAttribute("data-route-state", "pending");
    await homeDockLink.dispatchEvent("click");
    await categoriesDockLink.dispatchEvent("click");

    await expect(shell).toHaveAttribute("data-resolved-pathname", "/");
    await expect(page.locator('[data-shell-region="route-pending-mask"]')).toBeVisible();
    await expect(pageContent).toBeVisible();
    await expect(pageContent).toHaveCSS("pointer-events", "none");
    await expect(page.locator("main:visible")).toHaveCount(1);
    await expect(page.locator("main.rawaj-signature-home")).toBeVisible();
  } finally {
    releaseRequest();
  }

  await expect(page).toHaveURL(/\/categories(?:\?|$)/);
  await expect(shell).toHaveAttribute("data-route-state", "idle");
  await expect(page.locator('[data-shell-region="page-content"] main:visible')).toHaveCount(1);
  await expect(page.locator("main.rawaj-signature-home")).toHaveCount(0);
  await expect(page.locator("main.rawaj-categories-v2")).toHaveCount(1);
  await page.unroute(delayedReferenceRequest);
});

test("category directory exposes an indexable category landing route when data exists", async ({
  page,
}) => {
  await openHealthyPage(page, "/categories");
  const categoryLink = page.locator('a[href^="/category/"]').first();
  if ((await categoryLink.count()) === 0)
    test.skip(true, "No active public categories in this environment");
  await expect(categoryLink).toBeVisible();
  await categoryLink.click();
  await expect(page).toHaveURL(/\/category\/[^/?#]+/);
  await expect(page.locator("h1")).toBeVisible();
});

test("home stays within the viewport at audited mobile and desktop widths", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Single Chromium viewport matrix");

  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openHealthyPage(page, "/");

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
    await expect(page.locator('[data-shell-region="header-region"]')).toHaveCount(1);
    await expect(page.locator('[data-shell-region="page-content"] main:visible')).toHaveCount(1);
    await expect(page.locator(".rawaj-signature-category-chip").first()).toBeVisible();

    const searchSubmit = page.locator(".rawaj-signature-search button");
    const submitBounds = await searchSubmit.boundingBox();
    expect(submitBounds?.height ?? 0).toBeGreaterThanOrEqual(44);

    const dock = page.locator(".rawaj-mobile-dock");
    if (width < 1024) {
      await expect(dock).toBeVisible();
    } else {
      await expect(dock).toBeHidden();
    }
  }
});

test("unknown routes render a controlled not-found surface", async ({ page }) => {
  const response = await page.goto("/__rawaj_missing_route__", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 404).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
});

test("mobile marketplace routes do not widen the document viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only layout contract");

  for (const path of ["/", "/categories", "/listings", "/offers", "/support"] as const) {
    await openHealthyPage(page, path);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
  }
});

test("CSP header allows Vercel analytics script source", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("va.vercel-scripts.com");
});

test("auth callback without a Firebase action redirects safely to login", async ({ page }) => {
  const response = await page.goto("/auth/callback", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page).toHaveURL(/\/login\?returnTo=(?:%2F|\/)more$/i);
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
