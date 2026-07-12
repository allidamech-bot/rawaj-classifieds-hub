import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const productionOnly = !process.env.PRODUCTION_SMOKE;

async function expectHealthyDocument(page: Page, path: string) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown failure";
    if (!failure.includes("ERR_ABORTED"))
      failedRequests.push(`${request.method()} ${request.url()}: ${failure}`);
  });

  const response = await page.goto(path, { waitUntil: "networkidle" });
  expect(response, `Missing navigation response for ${path}`).not.toBeNull();
  expect(response!.status(), `${path} returned ${response!.status()}`).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect.poll(() => page.title()).not.toBe("");
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
}

async function expectTextEndpoint(request: APIRequestContext, path: string, contentType: RegExp) {
  const response = await request.get(path);
  expect(response.status(), `${path} returned ${response.status()}`).toBeLessThan(400);
  expect(response.headers()["content-type"] ?? "").toMatch(contentType);
  const body = await response.text();
  expect(body.trim().length).toBeGreaterThan(0);
  return body;
}

test.describe("RAWAJ production launch health", () => {
  test.skip(productionOnly, "Production smoke runs only with PRODUCTION_SMOKE=1");

  for (const path of [
    "/",
    "/categories",
    "/listings",
    "/offers",
    "/support",
    "/safety",
    "/privacy",
    "/terms",
    "/prohibited",
    "/promotion",
  ] as const) {
    test(`${path} is healthy on production`, async ({ page }) => {
      await expectHealthyDocument(page, path);
    });
  }

  test("production category and governorate landing routes are discoverable", async ({ page }) => {
    await expectHealthyDocument(page, "/categories");
    const categoryHref = await page.locator('a[href^="/category/"]').first().getAttribute("href");
    expect(categoryHref, "No active category landing URL was rendered").toBeTruthy();
    await expectHealthyDocument(page, categoryHref!);

    const sitemapResponse = await page.request.get("/sitemap.xml");
    expect(sitemapResponse.status()).toBeLessThan(400);
    const sitemap = await sitemapResponse.text();
    const governorateMatch = sitemap.match(/https:\/\/rawa-j\.com\/syria\/[^<]+/);
    expect(governorateMatch, "No governorate landing URL exists in sitemap.xml").toBeTruthy();
    await expectHealthyDocument(page, new URL(governorateMatch![0]).pathname);
  });

  test("robots and sitemap expose the production discovery contract", async ({ request }) => {
    const robots = await expectTextEndpoint(request, "/robots.txt", /text\/plain/i);
    expect(robots).toMatch(/sitemap:\s*https:\/\/rawa-j\.com\/sitemap\.xml/i);

    const sitemap = await expectTextEndpoint(request, "/sitemap.xml", /(?:xml|text\/plain)/i);
    expect(sitemap).toMatch(/<urlset/);
    expect(sitemap).toMatch(/\/category\//);
    expect(sitemap).toMatch(/\/syria\//);
  });

  test("unknown production routes fail safely", async ({ page }) => {
    const response = await page.goto("/__rawaj_production_missing_route__", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status() ?? 404).toBeLessThan(500);
    await expect(page.locator("body")).toBeVisible();
  });
});
