import { expect, test, type Page } from "@playwright/test";
import { expectRenderedLayout } from "./layout-audit";

const acceptanceOnly = !process.env.PRODUCTION_ACCEPTANCE;
const acceptanceEmail = process.env.RAWAJ_ACCEPTANCE_EMAIL ?? "";
const acceptancePassword = process.env.RAWAJ_ACCEPTANCE_PASSWORD ?? "";
const expectedCommitSha = process.env.EXPECTED_COMMIT_SHA ?? "";

const authenticatedRoutes = [
  "/profile",
  "/profile/listings",
  "/add-listing",
  "/favorites",
  "/saved-searches",
  "/chats",
  "/notifications",
  "/activity",
  "/more",
  "/verification",
  "/promotion",
] as const;

function isExpectedRequestFailure(url: string, failure: string) {
  return (
    failure.includes("ERR_ABORTED") || (failure === "csp" && url.includes("va.vercel-scripts.com"))
  );
}

async function expectAuthenticatedRoute(page: Page, path: (typeof authenticatedRoutes)[number]) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `Missing navigation response for ${path}`).not.toBeNull();
  expect(response!.status(), `${path} returned ${response!.status()}`).toBeLessThan(500);
  await expect(page.locator("main")).toBeVisible();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByText(/تسجيل الدخول مطلوب|Login required/)).toHaveCount(0);

  if (path === "/add-listing") {
    await expect(page.getByText(/استوديو الإعلان|Listing studio/).first()).toBeVisible();
  }

  await expectRenderedLayout(page, {
    label: `authenticated:${path}`,
    mobile: (page.viewportSize()?.width ?? 1440) < 768,
  });
}

test.describe("RAWAJ authenticated production acceptance", () => {
  test.skip(acceptanceOnly, "Production acceptance runs only with PRODUCTION_ACCEPTANCE=1");

  test("dedicated account can access launch-critical authenticated journeys", async ({ page }) => {
    expect(acceptanceEmail, "RAWAJ_ACCEPTANCE_EMAIL is required").not.toBe("");
    expect(acceptancePassword, "RAWAJ_ACCEPTANCE_PASSWORD is required").not.toBe("");
    expect(expectedCommitSha, "EXPECTED_COMMIT_SHA is required").not.toBe("");

    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "unknown failure";
      if (!isExpectedRequestFailure(request.url(), failure)) {
        failedRequests.push(`${request.method()} ${request.url()}: ${failure}`);
      }
    });

    const loginResponse = await page.goto("/login?returnTo=/profile", {
      waitUntil: "domcontentloaded",
    });
    expect(loginResponse?.status() ?? 200).toBeLessThan(500);

    const deployedCommit = await page
      .locator('meta[name="rawaj-build-commit"]')
      .getAttribute("content");
    expect(deployedCommit).toBe(expectedCommitSha);

    await page.locator('input[type="email"]').fill(acceptanceEmail);
    await page.locator('input[autocomplete="current-password"]').fill(acceptancePassword);
    await page.locator('form button[type="submit"]').click();

    await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
    await expect(page.locator("main")).toBeVisible();

    for (const path of authenticatedRoutes) {
      await expectAuthenticatedRoute(page, path);
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
