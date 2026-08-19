import { expect, test, type Page } from "@playwright/test";

const OWNER_FIXTURE_HEADER = "x-rawaj-e2e-owner-listing-lifecycle";

async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1, {
    timeout: 30_000,
  });
}

async function signIn(page: Page, returnTo: string): Promise<void> {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await waitForHydration(page);
  await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill("browser-smoke@rawa-j.test");
  await page.locator('form input[type="password"]').fill("Rawaj-E2E-Password-1");
  await page
    .locator("form")
    .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
    .click();
  await expect(page).toHaveURL(new RegExp(returnTo.replaceAll("/", "\\/") + "(?:[/?#]|$)"), {
    timeout: 30_000,
  });
}

test.describe("search + customer promotion repair", () => {
  test.setTimeout(120_000);

  test("home search input stays transparent inside the dark RAWAJ search shell", async ({
    page,
  }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 200).toBe(200);
    await waitForHydration(page);

    const search = page.getByRole("searchbox", {
      name: /^(ابحث في رواج|Search RAWAJ)$/,
    });
    await expect(search).toBeVisible();
    const style = await search.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        backgroundColor: computed.backgroundColor,
        boxShadow: computed.boxShadow,
        appearance: computed.appearance,
      };
    });

    expect(style.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(style.boxShadow).toBe("none");
    expect(style.appearance).toBe("none");
  });

  test("approved My Store listing exposes paid promotion intake beside listing actions", async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ [OWNER_FIXTURE_HEADER]: "1" });
    const resetResponse = await page.request.post("/__rawaj_e2e__/owner-listings/reset", {
      headers: { "x-rawaj-e2e-reset": "1" },
    });
    expect(resetResponse.ok()).toBe(true);

    await signIn(page, "/profile/listings?tab=approved");
    await waitForHydration(page);

    const approvedCard = page
      .locator("article.rawaj-owner-listing-card")
      .filter({ hasText: "سيارة عائلية معتمدة" })
      .first();
    await expect(approvedCard).toBeVisible({ timeout: 30_000 });

    const promote = approvedCard.locator('[data-tone="advertise"]');
    await expect(promote).toBeVisible();
    await promote.click();

    const dialog = page.getByRole("dialog", {
      name: /^(اطلب مساحة إعلانية أو حملة|Request an ad placement or campaign)$/,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio")).toHaveCount(6);
    await expect(dialog.getByText(/^(المدة المطلوبة|Requested duration)$/)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^(إرسال طلب الترويج|Send promotion request)$/ }),
    ).toBeVisible();

    const geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.top).toBeGreaterThanOrEqual(-1);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  });
});
