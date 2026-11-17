import { expect, test, type Page } from "@playwright/test";

/**
 * Batch 4 independent functional acceptance.
 * Run only against the local RAWAJ fixture server. Never exercise writes on production.
 */
test.describe("B4 independent marketplace journeys", () => {
  test.beforeEach(() => {
    test.skip(
      process.env.RAWAJ_E2E_USE_FIXTURES !== "1" || Boolean(process.env.E2E_BASE_URL),
      "B4 functional acceptance requires the isolated local fixture server",
    );
  });

  async function visit(page: Page, path: string, language: "ar" | "en") {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 200).toBeLessThan(500);
    await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
    await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
    await expect(page.locator("main").first()).toBeVisible();
  }

  for (const language of ["ar", "en"] as const) {
    test(
      "home to categories, search, filters, listing, seller and guest contact: " + language,
      async ({ page }, testInfo) => {
        await page.addInitScript(
          (value) => localStorage.setItem("rawaj-language", value),
          language,
        );
        await visit(page, "/", language);

        // Follow the real home category entry point, not a programmatic route push.
        const categories = page
          .locator('.rawaj-signature-categories a[href="/categories"]')
          .first();
        await expect(categories).toBeVisible();
        await categories.click();
        await expect(page).toHaveURL(/\/categories(?:[?#]|$)/);
        await expect(page.locator("main h1")).toBeVisible();
        const shell = page.locator(".rawaj-app-shell");
        await expect(shell).toHaveAttribute("data-route-state", "idle");
        await expect(shell).toHaveAttribute("data-resolved-pathname", "/categories");

        await visit(page, "/", language);
        const search = page.locator("#rawaj-signature-search-input");
        await expect(search).toBeVisible();
        await search.fill("  سيارة  ");
        await search.press("Enter");
        await expect(page).toHaveURL(/\/listings(?:\?|$)/);
        expect(new URL(page.url()).searchParams.get("q")).toBe("سيارة");

        // Filter state must be expressed in the URL, including after reload.
        const toolbar = page.locator(".rawaj-search-toolbar");
        await expect(toolbar).toBeVisible();
        await toolbar
          .getByRole("combobox", { name: /ترتيب النتائج|Sort results/ })
          .selectOption("cheapest");
        await expect(page).toHaveURL(/sort=cheapest/);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
        await expect(
          toolbar.getByRole("combobox", { name: /ترتيب النتائج|Sort results/ }),
        ).toHaveValue("cheapest");

        const listingLink = page.locator('a[href^="/listings/e2e-listing-"]').first();
        await expect(listingLink).toBeVisible();
        await listingLink.click();
        await expect(page).toHaveURL(/\/listings\/e2e-listing-/);
        await expect(page.locator(".rawaj-detail-summary h1")).toBeVisible();

        const contact = page.locator(
          'aside[data-action-contract="conversation-and-direct-contact"]',
        );
        await expect(contact).toBeVisible();
        await expect(contact.getByRole("button", { name: /مراسلة|Message/ })).toBeEnabled();
        await expect(contact.getByRole("button", { name: /قدّم عرضًا|Make an offer/ })).toBeEnabled();

        const seller = page.locator(".rawaj-detail-seller a[href^='/seller/']").first();
        await expect(seller).toBeVisible();
        await seller.click();
        await expect(page).toHaveURL(/\/seller\/[^/?#]+/);
        await expect(page.locator("#storefront-listings")).toBeVisible();
        await expect(page.locator("#seller-about")).toBeAttached();
        await expect(page.locator("#seller-reviews")).toBeAttached();

        await page.goBack();
        await expect(
          page.locator('aside[data-action-contract="conversation-and-direct-contact"]'),
        ).toBeVisible();
        await contact.getByRole("button", { name: /مراسلة|Message/ }).click();
        await expect(page).toHaveURL(/\/login(?:\?|$)/);
        expect(new URL(page.url()).searchParams.get("returnTo")).toMatch(/^\/listings\//);
        await expect(page.locator('input[type="email"]')).toBeVisible();

        // This verifies the user journey, not a production-authenticated message write.
        await testInfo.attach("b4-guest-contact-" + language, {
          body: JSON.stringify({
            contactOutcome: "login required",
            reason: "anonymous visitor cannot create private conversations",
            productionWrites: 0,
          }),
          contentType: "application/json",
        });
      },
    );

    test("transient listing failure stays recoverable: " + language, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      await visit(page, "/", language);
      let attempts = 0;
      let fail = true;
      await page.route(/\/v1\/listings(?:\?|$)/, async (route) => {
        attempts += 1;
        if (fail) {
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({
              error: { code: "unavailable", message: "B4 fixture unavailable" },
            }),
          });
        } else {
          await route.continue();
        }
      });
      const search = page.locator("#rawaj-signature-search-input");
      await search.fill("rawaj-recovery");
      await search.press("Enter");
      await expect(page).toHaveURL(/\/listings\?[^#]*q=rawaj-recovery/);
      await expect(page.getByRole("button", { name: /إعادة المحاولة|Try again/ })).toBeVisible();
      expect(attempts).toBeGreaterThan(0);
      const failedAttempts = attempts;
      await page.evaluate(() => {
        document.documentElement.dataset.retryDocument = "same";
      });
      fail = false;
      await page.getByRole("button", { name: /إعادة المحاولة|Try again/ }).click();
      await expect.poll(() => attempts).toBeGreaterThan(failedAttempts);
      await expect(page.locator(".rawaj-adaptive-card").first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-retry-document", "same");
      await expect(page).toHaveURL(/\/listings\?[^#]*q=rawaj-recovery/);
    });

    test("empty listings response is a controlled state: " + language, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      await visit(page, "/", language);
      let intercepted = 0;
      await page.route(/\/v1\/listings(?:\?|$)/, async (route) => {
        intercepted += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { items: [], nextCursor: null, pageSize: 30 } }),
        });
      });
      const search = page.locator("#rawaj-signature-search-input");
      await search.fill("rawaj-empty");
      await search.press("Enter");
      await expect(page).toHaveURL(/\/listings\?[^#]*q=rawaj-empty/);
      await expect(page.locator(".rawaj-search-empty-state")).toBeVisible();
      expect(intercepted).toBeGreaterThan(0);
      await expect(page.locator(".rawaj-adaptive-card")).toHaveCount(0);
    });

    test(
      "non-destructive public and member route inventory renders: " + language,
      async ({ page }) => {
        // Twenty sequential SSR/hydration transitions exceed the generic 60s timeout on cold WebKit/Firefox.
        // Keep each route's assertion timeout unchanged so a genuinely stuck route still fails.
        test.setTimeout(180_000);
        await page.addInitScript(
          (value) => localStorage.setItem("rawaj-language", value),
          language,
        );
        const routes = [
          "/login",
          "/reset-password",
          "/more",
          "/offers",
          "/promotion",
          "/promotion-request",
          "/support",
          "/safety",
          "/prohibited",
          "/privacy",
          "/terms",
          "/verification",
          "/favorites",
          "/saved-searches",
          "/notifications",
          "/activity",
          "/chats",
          "/add-listing",
          "/profile",
          "/profile/listings",
        ] as const;
        const remoteWrites: string[] = [];
        page.on("request", (request) => {
          if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return;
          const hostname = new URL(request.url()).hostname;
          if (hostname !== "127.0.0.1" && hostname !== "localhost") {
            remoteWrites.push(request.method() + " " + request.url());
          }
        });
        for (const route of routes) {
          await visit(page, route, language);
          // Avoid false success from an unexpected client-side route crash.
          await expect(page.locator(".rawaj-app-shell")).toBeVisible();
        }
        expect(remoteWrites, "Local fixture inventory must never write remotely").toEqual([]);
      },
    );
  }
});
