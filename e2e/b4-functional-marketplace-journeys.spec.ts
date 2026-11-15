import { expect, test, type Page } from "@playwright/test";

const featured = "/listings/e2e-listing-featured";
const seller = "/seller/00000000-0000-4000-8000-000000000010";
const fixtureOnly = process.env.RAWAJ_E2E_USE_FIXTURES !== "1" || Boolean(process.env.E2E_BASE_URL);

async function hydrated(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
}

async function setLanguage(page: Page, language: "ar" | "en") {
  await page.addInitScript((value) => {
    localStorage.setItem("rawaj-language", value);
    localStorage.removeItem("rawaj:e2e:firebase-user");
  }, language);
}

test.describe("B4 independent public marketplace functional journeys", () => {
  test.skip(fixtureOnly, "No live data or production actions. Requires isolated local fixtures.");
  test.setTimeout(120_000);

  for (const language of ["ar", "en"] as const) {
    test("search -> real listing details -> seller store -> safe contact - " + language, async ({ page }, testInfo) => {
      await setLanguage(page, language);
      const protectedWrites: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (request.method() !== "GET" && request.method() !== "HEAD" &&
            /^\/(?:v1\/(?:chats|conversations|messages|listings\/[^/]+\/(?:reports|favorite))|api\/profile)/.test(url.pathname)) {
          protectedWrites.push(request.method() + " " + request.url());
        }
      });

      await hydrated(page, "/");
      await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
      const search = page.locator("#rawaj-signature-search-input");
      await expect(search).toBeVisible();
      await search.fill("  سيارة  ");
      await search.press("Enter");
      await expect(page).toHaveURL(/\/listings(?:\?|$)/);
      expect(new URL(page.url()).searchParams.get("q")).toBe("سيارة");
      await expect(page.locator("main.rawaj-search-results-v1")).toBeVisible();

      const listingLink = page.locator('a[href="' + featured + '"]').first();
      await expect(listingLink).toBeVisible();
      await listingLink.click();
      await expect(page).toHaveURL(new RegExp(featured + "$"));
      await expect(page.locator("main h1").first()).toContainText("سيارة عائلية بحالة ممتازة");
      const dock = page.locator('aside.rawaj-contact-dock[data-owner="false"]');
      await expect(dock).toBeVisible();
      await expect(dock.getByRole("button", { name: /^(Message|مراسلة)$/ })).toBeVisible();
      await expect(dock.getByRole("button", { name: /^(Make an offer|قدّم عرضًا)$/ })).toBeVisible();

      for (const phoneLink of await dock.locator('a[href^="tel:"]').all()) {
        expect(await phoneLink.getAttribute("href")).toMatch(/^tel:\+?[0-9]+$/);
      }
      for (const whatsappLink of await dock.locator('a[data-tone="whatsapp"]').all()) {
        expect(await whatsappLink.getAttribute("href")).toMatch(/^https:\/\/(?:api\.whatsapp\.com|wa\.me)\//);
        await expect(whatsappLink).toHaveAttribute("target", "_blank");
        await expect(whatsappLink).toHaveAttribute("rel", /noreferrer/);
      }

      const sellerLink = page.getByRole("link", { name: /زيارة متجر البائع|Visit seller store/i }).first();
      await expect(sellerLink).toHaveAttribute("href", seller);
      await sellerLink.click();
      await expect(page).toHaveURL(new RegExp(seller + "$"));
      await expect(page.locator("main.my-store-public")).toBeVisible();
      await expect(page.locator("main")).toContainText("بائع رواج التجريبي");

      await page.goBack({ waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(new RegExp(featured + "$"));
      await page.locator("aside.rawaj-contact-dock").getByRole("button", { name: /^(Message|مراسلة)$/ }).click();
      await expect(page).toHaveURL(/\/login(?:\?|$)/);
      expect(new URL(page.url()).searchParams.get("returnTo")).toBe(featured);
      expect(protectedWrites, "Guest contact must never write a private conversation").toEqual([]);
      await testInfo.attach("b4-public-journey.json", {
        body: JSON.stringify({ language, start: "/", search: "سيارة", listing: featured, seller, guestContact: "login-required", protectedWrites }, null, 2),
        contentType: "application/json",
      });
    });

    test("login rejects malformed input before starting a session - " + language, async ({ page }) => {
      await setLanguage(page, language);
      await hydrated(page, "/login?returnTo=/add-listing");
      const email = page.locator('main input[type="email"]').first();
      await expect(email).toBeVisible();
      const submit = page.locator('#rawaj-auth-form button[type="submit"]').first();
      await expect(submit).toBeVisible();
      await submit.click();
      await expect(page.getByText(/أدخل بريدك الإلكتروني|Enter your email address/i)).toBeVisible();
      await email.fill("not-an-email");
      await submit.click();
      await expect(page.getByText(/أدخل بريدًا إلكترونيًا صالحًا|Enter a valid email address/i)).toBeVisible();
      await email.fill("fixture@rawa-j.test");
      await page.locator('#rawaj-auth-form input[type="password"]').fill("123");
      await submit.click();
      await expect(page.getByText(/كلمة المرور يجب أن تكون|Password must be at least/i)).toBeVisible();
      expect(new URL(page.url()).pathname).toBe("/login");
      expect(await page.evaluate(() => localStorage.getItem("rawaj:e2e:firebase-user"))).toBeNull();
    });

    test("category directory supports a real query without leaving stale content - " + language, async ({ page }) => {
      await setLanguage(page, language);
      await hydrated(page, "/");
      const categories = page.locator('a[href="/categories"]:visible').first();
      await expect(categories).toBeVisible();
      await categories.click();
      await expect(page).toHaveURL(/\/categories(?:\?|$)/);
      const finder = page.locator('main input[type="search"]').first();
      await expect(finder).toBeVisible();
      await finder.fill("السيارات");
      await expect(page.locator("main")).toContainText("السيارات");
      await finder.fill("zz-absent-category-rawaj");
      await expect(page.locator("main")).not.toContainText("سيارات للبيع");
      await finder.fill("");
      await expect(finder).toHaveValue("");
      await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
    });
  }
});
