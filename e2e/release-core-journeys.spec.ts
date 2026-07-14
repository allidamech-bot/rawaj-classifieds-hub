import { expect, test, type Page } from "@playwright/test";

const publicReleaseRoutes = [
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

const protectedReleaseRoutes = [
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

function isExpectedRequestFailure(url: string, failure: string) {
  return (
    failure.includes("ERR_ABORTED") || (failure === "csp" && url.includes("va.vercel-scripts.com"))
  );
}

async function expectHealthyRoute(page: Page, path: string) {
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!isExpectedRequestFailure(request.url(), failure)) {
      failedRequests.push(`${request.method()} ${request.url()}: ${failure}`);
    }
  });

  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200, `${path} returned a server failure`).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await page.waitForTimeout(200);
  expect(pageErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
}

for (const path of publicReleaseRoutes) {
  test(`release public route ${path} remains browser healthy`, async ({ page }) => {
    await expectHealthyRoute(page, path);
  });
}

for (const path of protectedReleaseRoutes) {
  test(`release protected route ${path} fails closed without crashing`, async ({ page }) => {
    await expectHealthyRoute(page, path);
    await expect(page.locator('input[type="password"]')).toHaveCount(path === "/login" ? 1 : 0);
  });
}

test("authentication surfaces expose password-manager-compatible fields", async ({ page }) => {
  await expectHealthyRoute(page, "/login?returnTo=/profile");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  await expect(page.locator('form button[type="submit"]')).toBeVisible();
});

test("listing discovery preserves explicit URL search state", async ({ page }) => {
  await expectHealthyRoute(page, "/listings?q=rawaj");
  expect(new URL(page.url()).searchParams.get("q")).toBe("rawaj");
});

test("default document semantics remain Arabic RTL and keyboard reachable", async ({ page }) => {
  await expectHealthyRoute(page, "/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.keyboard.press("Tab");
  const focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
  expect(focusedTag).not.toBe("BODY");
});

test("reduced-motion mobile rendering does not widen the viewport", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only release contract");
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const path of ["/", "/listings", "/add-listing", "/chats"] as const) {
    await expectHealthyRoute(page, path);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 2);
  }
});
