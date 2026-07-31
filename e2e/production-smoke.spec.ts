import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const productionOnly = !process.env.PRODUCTION_SMOKE;
const expectedCommitSha = process.env.EXPECTED_COMMIT_SHA ?? "";

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

async function readStaticSitemap(request: APIRequestContext) {
  const index = await expectTextEndpoint(request, "/sitemap.xml", /(?:xml|text\/plain)/i);
  if (index.includes("<urlset")) return index;

  expect(index).toMatch(/<sitemapindex/);
  const staticShardMatch = index.match(
    /<loc>([^<]*sitemap\.xml\?section=static(?:&amp;|&)page=1)<\/loc>/,
  );
  expect(staticShardMatch, "Sitemap index does not expose the static discovery shard").toBeTruthy();
  const shardUrl = staticShardMatch![1].replaceAll("&amp;", "&");
  return expectTextEndpoint(request, new URL(shardUrl).pathname + new URL(shardUrl).search, /xml/i);
}

test.describe("RAWAJ production launch health", () => {
  test.skip(productionOnly, "Production smoke runs only with PRODUCTION_SMOKE=1");

  test("production serves the expected merged commit", async ({ page }) => {
    expect(expectedCommitSha, "EXPECTED_COMMIT_SHA is required for production smoke").not.toBe("");
    await expectHealthyDocument(page, "/");
    const deployedCommit = await page
      .locator('meta[name="rawaj-build-commit"]')
      .getAttribute("content");
    expect(deployedCommit).toBe(expectedCommitSha);
  });

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
    const categoryHref = await page
      .locator('a[href^="/listings?category="], a[href^="/categories?node="]')
      .first()
      .getAttribute("href");
    expect(categoryHref, "No active category discovery URL was rendered").toBeTruthy();
    await expectHealthyDocument(page, categoryHref!);

    const sitemap = await readStaticSitemap(page.request);
    const governorateMatch = sitemap.match(/https:\/\/rawa-j\.com\/syria\/[^<]+/);
    expect(governorateMatch, "No governorate landing URL exists in sitemap.xml").toBeTruthy();
    await expectHealthyDocument(page, new URL(governorateMatch![0]).pathname);
  });

  test("robots and sitemap expose the production discovery contract", async ({ request }) => {
    const robots = await expectTextEndpoint(request, "/robots.txt", /text\/plain/i);
    expect(robots).toMatch(/sitemap:\s*https:\/\/rawa-j\.com\/sitemap\.xml/i);

    const sitemap = await readStaticSitemap(request);
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
