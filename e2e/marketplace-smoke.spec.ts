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

function isExpectedLocalRequestFailure(url: string, failure: string) {
  return (
    failure.includes("ERR_ABORTED") || (failure === "csp" && url.includes("va.vercel-scripts.com"))
  );
}

async function waitForHydratedRouter(page: Page) {
  await page.waitForFunction(() => {
    const runtime = window as typeof window & { $_TSR?: unknown };
    return Boolean(document.querySelector('script[type="module"][src]')) && runtime.$_TSR === undefined;
  });
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
  await page.waitForTimeout(100);
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

test("home discovery can navigate to the public listings workspace", async ({ page }) => {
  await openHealthyPage(page, "/");
  const listingsLink = page.locator('a[href="/listings"]').first();
  await expect(listingsLink).toBeVisible();
  await listingsLink.click();
  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  await expect(page.locator("main")).toBeVisible();
});

test("pending navigation never exposes the previous home page inside the next route shell", async ({
  page,
}) => {
  await openHealthyPage(page, "/");

  const shell = page.locator(".rawaj-app-shell");
  await expect(shell).toHaveAttribute("data-route-state", "idle");
  await expect(shell).toHaveAttribute("data-resolved-pathname", "/");
  await expect(page.locator("main.rawaj-home-v3-main")).toBeVisible();

  let releaseRequest = () => {};
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  let delayedRequestCount = 0;

  await page.route("**/listings", async (route) => {
    if (route.request().isNavigationRequest()) {
      await route.continue();
      return;
    }
    delayedRequestCount += 1;
    await requestGate;
    await route.continue();
  });

  const listingsLink = page.locator('a[href="/listings"]').first();

  try {
    await listingsLink.dispatchEvent("click");

    await expect(shell).toHaveAttribute("data-route-state", "pending");
    await expect(shell).toHaveAttribute("data-resolved-pathname", "/");
    await expect(shell).toHaveAttribute("data-pending-pathname", "/listings");
    await expect(page.locator('[data-shell-region="route-pending-mask"]')).toBeVisible();
    await expect(page.locator('[data-shell-region="page-content"]')).toBeHidden();
    await expect(page.locator("main.rawaj-search-results-v1")).toHaveCount(0);
    expect(delayedRequestCount).toBeGreaterThan(0);
  } finally {
    releaseRequest();
  }

  await expect(page).toHaveURL(/\/listings(?:\?|$)/);
  await expect(shell).toHaveAttribute("data-route-state", "idle");
  await expect(shell).toHaveAttribute("data-resolved-pathname", "/listings");
  await expect(page.locator('[data-shell-region="route-pending-mask"]')).toHaveCount(0);
  await expect(page.locator("main.rawaj-home-v3-main")).toHaveCount(0);
  await expect(page.locator("main.rawaj-search-results-v1")).toBeVisible();
  await page.unroute("**/listings");
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

  await page.route("**/categories", async (route) => {
    if (route.request().isNavigationRequest()) {
      await route.continue();
      return;
    }
    delayedRequestCount += 1;
    await requestGate;
    await route.continue();
  });

  const shell = page.locator(".rawaj-app-shell");
  const categoriesDockLink = page.locator('.rawaj-mobile-dock a[href="/categories"]');
  const homeDockLink = page.locator('.rawaj-mobile-dock a[href="/"]');

  try {
    await categoriesDockLink.dispatchEvent("click");
    await expect(shell).toHaveAttribute("data-route-state", "pending");
    await homeDockLink.dispatchEvent("click");
    await categoriesDockLink.dispatchEvent("click");

    await expect(shell).toHaveAttribute("data-resolved-pathname", "/");
    await expect(page.locator('[data-shell-region="route-pending-mask"]')).toBeVisible();
    await expect(page.locator('[data-shell-region="page-content"]')).toBeHidden();
    await expect(page.locator("main:visible")).toHaveCount(0);
    expect(delayedRequestCount).toBeGreaterThan(0);
  } finally {
    releaseRequest();
  }

  await expect(page).toHaveURL(/\/categories(?:\?|$)/);
  await expect(shell).toHaveAttribute("data-route-state", "idle");
  await expect(page.locator('[data-shell-region="page-content"] main:visible')).toHaveCount(1);
  await expect(page.locator("main.rawaj-home-v3-main")).toHaveCount(0);
  await expect(page.locator("main.rawaj-categories-v2")).toHaveCount(1);
  await page.unroute("**/categories");
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

test("auth callback shows error immediately when no code is present", async ({ page }) => {
  const response = await page.goto("/auth/callback", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
  await expect(
    page.locator("text=تعذر تسجيل الدخول").or(page.locator("text=Could not sign in")),
  ).toBeVisible({
    timeout: 3000,
  });
});
