import { expect, test, type Page, type TestInfo } from "@playwright/test";

const viewportMatrix = [
  { name: "mobile-320x568", width: 320, height: 568 },
  { name: "mobile-360x800", width: 360, height: 800 },
  { name: "mobile-375x812", width: 375, height: 812 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-412x915", width: 412, height: 915 },
  { name: "mobile-430x932", width: 430, height: 932 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "tablet-820x1180", width: 820, height: 1180 },
  { name: "tablet-1024x1366", width: 1024, height: 1366 },
  { name: "desktop-1280x720", width: 1280, height: 720 },
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
] as const;

const publicRoutes = [
  "/",
  "/categories",
  "/listings",
  "/offers",
  "/login",
  "/reset-password",
  "/support",
  "/safety",
  "/privacy",
  "/terms",
  "/prohibited",
  "/promotion",
  "/verification",
] as const;

const protectedRoutes = [
  "/profile",
  "/profile/listings",
  "/add-listing",
  "/favorites",
  "/saved-searches",
  "/chats",
  "/notifications",
  "/activity",
  "/more",
  "/admin",
  "/admin/verifications",
  "/admin/users",
  "/admin/safety",
  "/admin/reviews",
  "/admin/reports",
  "/admin/promotions",
  "/admin/pending",
  "/admin/owner-controls",
  "/admin/message-reports",
  "/admin/listings",
  "/admin/campaigns",
  "/admin/audit",
  "/admin/ad-placements",
] as const;

const evidenceRoutes = new Set([
  "/",
  "/listings",
  "/login",
  "/add-listing",
  "/profile",
  "/chats",
  "/notifications",
]);

const ignoredRuntimeFragments = ["ERR_ABORTED", "va.vercel-scripts.com", "vercel-insights.com"];

function routeSlug(route: string) {
  return route === "/" ? "home" : route.replace(/^\//, "").replaceAll("/", "-");
}

function monitorRuntime(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!ignoredRuntimeFragments.some((fragment) => text.includes(fragment))) {
      consoleErrors.push(text);
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    const evidence = `${request.method()} ${request.url()}: ${failure}`;
    if (!ignoredRuntimeFragments.some((fragment) => evidence.includes(fragment))) {
      failedRequests.push(evidence);
    }
  });

  return { pageErrors, consoleErrors, failedRequests };
}

async function assertRouteHealth(
  page: Page,
  route: string,
  testInfo?: TestInfo,
  screenshotName?: string,
) {
  const runtime = monitorRuntime(page);
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });

  expect(response?.status() ?? 200, `${route} returned a server failure`).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", /^ar(?:-|$)/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.waitForTimeout(500);

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth, `${route} has horizontal overflow`).toBeLessThanOrEqual(
    dimensions.viewportWidth + 2,
  );

  if (testInfo && screenshotName) {
    await page.screenshot({
      path: testInfo.outputPath(`${screenshotName}.png`),
      fullPage: false,
      animations: "disabled",
    });
  }

  expect(runtime.pageErrors, `${route} emitted page errors`).toEqual([]);
  expect(runtime.consoleErrors, `${route} emitted console errors`).toEqual([]);
  expect(runtime.failedRequests, `${route} emitted failed requests`).toEqual([]);
}

test.describe.configure({ mode: "serial" });

for (const viewport of viewportMatrix) {
  test(`viewport ${viewport.name} remains RTL, renderable, and overflow-safe`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: "ar-SY",
      reducedMotion: "reduce",
    });

    try {
      for (const route of ["/", "/listings"] as const) {
        const page = await context.newPage();
        await assertRouteHealth(page, route, testInfo, `${viewport.name}-${routeSlug(route)}`);
        await page.close();
      }
    } finally {
      await context.close();
    }
  });
}

for (const viewport of [
  { name: "mobile-360x800", width: 360, height: 800 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
] as const) {
  test(`route inventory survives direct load and reload at ${viewport.name}`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: "ar-SY",
    });

    try {
      for (const route of [...publicRoutes, ...protectedRoutes]) {
        const page = await context.newPage();
        await assertRouteHealth(
          page,
          route,
          testInfo,
          evidenceRoutes.has(route) ? `${viewport.name}-${routeSlug(route)}` : undefined,
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator("main")).toBeVisible();
        await page.close();
      }
    } finally {
      await context.close();
    }
  });
}

test("browser back and forward preserve public navigation", async ({ page }) => {
  await assertRouteHealth(page, "/");
  await page.goto("/categories", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();
  await page.goBack({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/$/);
  await page.goForward({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/categories\/?$/);
});

test("320px hero and primary dock action remain readable", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await assertRouteHealth(page, "/", testInfo, "home-mobile-320-readability");

  const heading = page.locator("#rawaj-home-title");
  const description = heading.locator("xpath=following-sibling::p[1]");
  const headingBox = await heading.boundingBox();
  const descriptionBox = await description.boundingBox();
  expect(headingBox).not.toBeNull();
  expect(descriptionBox).not.toBeNull();
  expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(descriptionBox!.y + 1);

  const primaryDockAction = page.locator('.rawaj-dock-item[data-primary="true"]');
  await expect(primaryDockAction).toBeVisible();
  await expect(primaryDockAction.locator(".rawaj-bottom-dock__compact-label")).toBeVisible();
  await expect(primaryDockAction.locator(".rawaj-bottom-dock__compact-label")).toHaveText("أضف");
});

test("login validation blocks malformed credentials without losing the form", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertRouteHealth(page, "/login?returnTo=/favorites", testInfo, "login-validation-mobile");

  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');
  if ((await email.count()) === 0 || (await password.count()) === 0) {
    await expect(
      page.getByText(/خدمة الحسابات غير متاحة|Account service is unavailable/i).first(),
    ).toBeVisible();
    test.skip(true, "Authentication environment variables are not configured for this target.");
  }

  await email.fill("invalid-email");
  await password.fill("123");
  await page.locator('form button[type="submit"]').click();
  expect(
    await email.evaluate((element) => !(element as HTMLInputElement).validity.valid),
  ).toBeTruthy();
  await expect(page).toHaveURL(/\/login/);
  await expect(email).toHaveValue("invalid-email");
});

test("keyboard navigation exposes focus and open dialogs close with Escape", async ({ page }) => {
  await assertRouteHealth(page, "/");
  await page.keyboard.press("Tab");
  const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
  expect(activeTag).not.toBe("BODY");

  const dialogTrigger = page.locator('button[aria-haspopup="dialog"]').first();
  if ((await dialogTrigger.count()) > 0 && (await dialogTrigger.isVisible())) {
    await dialogTrigger.click();
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
  }
});

test("public discovery opens listing detail and seller storefront when data exists", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertRouteHealth(page, "/listings", testInfo, "listings-discovery-mobile");
  const listingLinks = page.locator('a[href^="/listings/"]');
  await page.waitForTimeout(1_000);

  if ((await listingLinks.count()) === 0) {
    test.skip(true, "No public listing data is available in this target.");
  }

  const firstListingHref = await listingLinks.first().getAttribute("href");
  expect(firstListingHref).toBeTruthy();
  await listingLinks.first().click();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("h1").first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("listing-detail-mobile.png"),
    animations: "disabled",
  });

  const sellerLink = page.locator('a[href^="/seller/"]').first();
  if (await sellerLink.isVisible().catch(() => false)) {
    await sellerLink.click();
    await expect(page).toHaveURL(/\/seller\//);
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("seller-storefront-mobile.png"),
      animations: "disabled",
    });
  }

  await page.goto(firstListingHref!, { waitUntil: "domcontentloaded" });
  const messageAction = page
    .getByRole("button", { name: /مراسلة|تواصل عبر رواج|ابدأ محادثة/i })
    .or(page.getByRole("link", { name: /مراسلة|تواصل عبر رواج|ابدأ محادثة/i }))
    .first();
  if (await messageAction.isVisible().catch(() => false)) {
    await messageAction.click();
    await page.waitForTimeout(400);
    const pathname = new URL(page.url()).pathname;
    const dialogVisible = await page
      .locator('[role="dialog"]')
      .isVisible()
      .catch(() => false);
    expect(
      pathname.startsWith("/login") || pathname.startsWith("/chats") || dialogVisible,
    ).toBeTruthy();
  }
});
