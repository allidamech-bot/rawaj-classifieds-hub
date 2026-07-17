import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";

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

const staticPublicRoutes = [
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

const expectedFailureFragments = [
  "ERR_ABORTED",
  "va.vercel-scripts.com",
  "vercel-insights.com",
];

function routeSlug(route: string) {
  return route === "/" ? "home" : route.replace(/^\//, "").replaceAll("/", "-");
}

function monitorRuntime(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!expectedFailureFragments.some((fragment) => text.includes(fragment))) {
        consoleErrors.push(text);
      }
    }
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    const evidence = `${request.method()} ${request.url()}: ${failure}`;
    if (!expectedFailureFragments.some((fragment) => evidence.includes(fragment))) {
      failedRequests.push(evidence);
    }
  });

  return { pageErrors, consoleErrors, failedRequests };
}

async function assertRouteHealth(
  page: Page,
  route: string,
  testInfo: TestInfo,
  screenshotName?: string,
) {
  const runtime = monitorRuntime(page);
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });

  expect(response?.status() ?? 200, `${route} returned a server failure`).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", /^ar(?:-|$)/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.waitForTimeout(700);

  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));

  expect(
    dimensions.documentWidth,
    `${route} has horizontal overflow: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 2);

  if (screenshotName) {
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

async function auditViewport(browser: Browser, testInfo: TestInfo, viewport: (typeof viewportMatrix)[number]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "ar-SY",
    reducedMotion: "reduce",
  });

  try {
    for (const route of ["/", "/listings"] as const) {
      const page = await context.newPage();
      await assertRouteHealth(
        page,
        route,
        testInfo,
        `${viewport.name}-${routeSlug(route)}`,
      );
      await page.close();
    }
  } finally {
    await context.close();
  }
}

test.describe.configure({ mode: "serial" });

test("required viewport matrix remains RTL, renderable, and overflow-safe", async ({ browser }, testInfo) => {
  for (const viewport of viewportMatrix) {
    await test.step(viewport.name, async () => {
      await auditViewport(browser, testInfo, viewport);
    });
  }
});

test("all static and protected release routes survive direct load, reload, back, and forward", async ({ browser }, testInfo) => {
  for (const viewport of [
    { name: "mobile-360x800", width: 360, height: 800 },
    { name: "desktop-1440x900", width: 1440, height: 900 },
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      locale: "ar-SY",
    });

    try {
      for (const route of [...staticPublicRoutes, ...protectedRoutes]) {
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

      const historyPage = await context.newPage();
      await assertRouteHealth(historyPage, "/", testInfo);
      await assertRouteHealth(historyPage, "/categories", testInfo);
      await historyPage.goBack({ waitUntil: "domcontentloaded" });
      await expect(historyPage).toHaveURL(/\/$/);
      await historyPage.goForward({ waitUntil: "domcontentloaded" });
      await expect(historyPage).toHaveURL(/\/categories\/?$/);
      await historyPage.close();
    } finally {
      await context.close();
    }
  }
});

test("login validation blocks malformed credentials without losing the form", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertRouteHealth(page, "/login?returnTo=/favorites", testInfo, "login-validation-mobile");

  const email = page.locator('input[type="email"]');
  const password = page.locator('input[type="password"]');
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();

  await email.fill("invalid-email");
  await password.fill("123");
  await page.locator('form button[type="submit"]').click();

  const emailInvalid = await email.evaluate((element) => !(element as HTMLInputElement).validity.valid);
  const validationMessageVisible = await page
    .locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]')
    .filter({ hasText: /البريد|كلمة المرور|صحيح|مطلوب/i })
    .first()
    .isVisible()
    .catch(() => false);

  expect(emailInvalid || validationMessageVisible).toBeTruthy();
  await expect(page).toHaveURL(/\/login/);
  await expect(email).toHaveValue("invalid-email");
  await page.screenshot({
    path: testInfo.outputPath("login-invalid-validation.png"),
    fullPage: false,
    animations: "disabled",
  });
});

test("keyboard navigation exposes a visible focus target and dialogs remain escapable", async ({ page }) => {
  await assertRouteHealth(page, "/");
  await page.keyboard.press("Tab");

  const focus = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return { tag: "NONE", visible: false };
    const style = window.getComputedStyle(active);
    return {
      tag: active.tagName,
      visible: style.display !== "none" && style.visibility !== "hidden",
    };
  });

  expect(focus.tag).not.toBe("BODY");
  expect(focus.visible).toBeTruthy();

  const dialogTrigger = page.locator('button[aria-haspopup="dialog"]').filter({ visible: true }).first();
  if (await dialogTrigger.count()) {
    await dialogTrigger.click();
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
  }
});

test("public discovery opens a real listing and seller storefront when data is available", async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ar-SY",
  });
  const page = await context.newPage();

  try {
    await assertRouteHealth(page, "/listings", testInfo, "listings-discovery-mobile");
    const listingLinks = page.locator('a[href^="/listings/"]');
    await page.waitForTimeout(1_500);

    if ((await listingLinks.count()) === 0) {
      test.skip(true, "No public listing data is available in this environment.");
    }

    const firstListingHref = await listingLinks.first().getAttribute("href");
    expect(firstListingHref).toBeTruthy();
    await listingLinks.first().click();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1").first()).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("listing-detail-mobile.png"),
      fullPage: false,
      animations: "disabled",
    });

    const sellerLink = page.locator('a[href^="/seller/"]').first();
    if (await sellerLink.isVisible().catch(() => false)) {
      await sellerLink.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/seller\//);
      await expect(page.locator("main")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath("seller-storefront-mobile.png"),
        fullPage: false,
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
      await page.waitForTimeout(500);
      const contactOutcome = new URL(page.url()).pathname;
      expect(
        contactOutcome.startsWith("/login") ||
          contactOutcome.startsWith("/chats") ||
          (await page.locator('[role="dialog"]').isVisible().catch(() => false)),
      ).toBeTruthy();
    }
  } finally {
    await context.close();
  }
});
