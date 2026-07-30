import { expect, test, type Locator, type Page } from "@playwright/test";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const FIXTURE_HEADER = "x-rawaj-e2e-owner-listing-lifecycle";
const APPROVED_LISTING_ID = "00000000-0000-4000-8000-000000000071";
const DRAFT_LISTING_ID = "00000000-0000-4000-8000-000000000072";
const APPROVED_TITLE = "سيارة عائلية معتمدة";
const DRAFT_TITLE = "مسودة أثاث منزل";
const REDUCED_PRICE = "400000000";

test.describe("authenticated launch-critical owner listing lifecycle journey", () => {
  test.setTimeout(180_000);

  test("persists owner lifecycle changes without duplicate writes", async ({ page }) => {
    const remoteWrites: string[] = [];
    const authorizedRequests: string[] = [];
    const lifecycleActions = new Map<string, number>();
    let draftDeletes = 0;

    await page.setExtraHTTPHeaders({ [FIXTURE_HEADER]: "1" });
    const resetResponse = await page.request.post("/__rawaj_e2e__/owner-listings/reset", {
      headers: { "x-rawaj-e2e-reset": "1" },
    });
    expect(resetResponse.ok()).toBe(true);

    page.on("request", (request) => {
      const url = new URL(request.url());
      const method = request.method();
      const isLocal = ["127.0.0.1", "localhost"].includes(url.hostname);
      if (!isLocal && method !== "GET" && method !== "HEAD") {
        remoteWrites.push(`${method} ${request.url()}`);
      }

      const isLifecycleRequest =
        method === "PATCH" && url.pathname === `/v1/listings/${APPROVED_LISTING_ID}/lifecycle`;
      const isDraftDelete =
        method === "DELETE" && url.pathname === `/v1/listings/${DRAFT_LISTING_ID}`;
      const privateRequest =
        url.pathname === "/api/profile" ||
        url.pathname === "/v1/account/listings" ||
        url.pathname.startsWith("/api/listings/") ||
        isLifecycleRequest ||
        isDraftDelete;

      if (privateRequest) {
        expect(request.headers()[FIXTURE_HEADER]).toBe("1");
        expect(request.headers().authorization).toBe(`Bearer ${FIXTURE_TOKEN}`);
        authorizedRequests.push(`${method} ${url.pathname}`);
      }

      if (isLifecycleRequest) {
        const body = request.postDataJSON() as { action?: unknown };
        const action = typeof body.action === "string" ? body.action : "unknown";
        lifecycleActions.set(action, (lifecycleActions.get(action) ?? 0) + 1);
      }
      if (isDraftDelete) draftDeletes += 1;
    });

    await page.addInitScript(() => {
      const marker = "rawaj:e2e:owner-listing-lifecycle-storage-cleared";
      if (window.sessionStorage.getItem(marker) === "1") return;
      window.localStorage.clear();
      window.sessionStorage.setItem(marker, "1");
    });

    await signIn(page, "/profile/listings?tab=approved");
    await expect(page).toHaveURL(/\/profile\/listings(?:\?tab=approved)?(?:[&#]|$)/, {
      timeout: 30_000,
    });

    let approvedCard = ownerCard(page, APPROVED_TITLE);
    await expect(approvedCard).toBeVisible({ timeout: 30_000 });

    const markReservedButton = approvedCard.getByRole("button", {
      name: /وضع محجوز|Mark reserved/i,
    });
    await clickTwiceInSameTick(markReservedButton);
    await expect(
      ownerCard(page, APPROVED_TITLE).getByRole("button", {
        name: /إلغاء الحجز|Clear reservation/i,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expectActionCount(lifecycleActions, "reserve", 1);

    await reloadCurrentPage(page);
    approvedCard = ownerCard(page, APPROVED_TITLE);
    await expect(
      approvedCard.getByRole("button", { name: /إلغاء الحجز|Clear reservation/i }),
    ).toBeVisible({ timeout: 30_000 });

    await clickTwiceInSameTick(
      approvedCard.getByRole("button", { name: /إلغاء الحجز|Clear reservation/i }),
    );
    await expect(
      ownerCard(page, APPROVED_TITLE).getByRole("button", {
        name: /وضع محجوز|Mark reserved/i,
      }),
    ).toBeVisible({ timeout: 30_000 });
    await expectActionCount(lifecycleActions, "unreserve", 1);

    approvedCard = ownerCard(page, APPROVED_TITLE);
    const priceInput = approvedCard.getByLabel(/السعر الجديد|New price/i);
    await priceInput.fill(REDUCED_PRICE);
    const dropPriceButton = approvedCard.getByRole("button", {
      name: /خفض السعر|Drop price/i,
    });
    await clickTwiceInSameTick(dropPriceButton);
    await expectActionCount(lifecycleActions, "reduce_price", 1);
    await expect(dropPriceButton).toBeEnabled({ timeout: 30_000 });

    approvedCard = ownerCard(page, APPROVED_TITLE);
    await approvedCard.getByLabel(/مدة صلاحية الإعلان|Listing expiry duration/i).selectOption("90");
    const applyExpiryButton = approvedCard.getByRole("button", {
      name: /تطبيق \/ تجديد المدة|Apply \/ renew duration/i,
    });
    await clickTwiceInSameTick(applyExpiryButton);
    await expectActionCount(lifecycleActions, "set_expiry", 1);
    await expect(applyExpiryButton).toBeEnabled({ timeout: 30_000 });

    await reloadCurrentPage(page);
    approvedCard = ownerCard(page, APPROVED_TITLE);
    await expect(approvedCard.getByLabel(/السعر الجديد|New price/i)).toHaveValue(REDUCED_PRICE, {
      timeout: 30_000,
    });
    await expect(
      approvedCard.getByLabel(/مدة صلاحية الإعلان|Listing expiry duration/i),
    ).toHaveValue("90");
    await expect(
      approvedCard.getByRole("button", { name: /وضع محجوز|Mark reserved/i }),
    ).toBeVisible();

    await clickTwiceInSameTick(approvedCard.getByRole("button", { name: /تم البيع|Mark sold/i }));
    await expect(ownerCard(page, APPROVED_TITLE)).toHaveCount(0, { timeout: 30_000 });
    await expectActionCount(lifecycleActions, "sold", 1);

    await openOwnerTab(page, "closed");
    let closedCard = ownerCard(page, APPROVED_TITLE);
    await expect(closedCard).toBeVisible({ timeout: 30_000 });
    await expect(
      closedCard.getByRole("button", {
        name: /إعادة التفعيل للمراجعة|Reactivate for review/i,
      }),
    ).toBeVisible();

    await reloadCurrentPage(page);
    closedCard = ownerCard(page, APPROVED_TITLE);
    await expect(closedCard).toBeVisible({ timeout: 30_000 });
    await clickTwiceInSameTick(
      closedCard.getByRole("button", {
        name: /إعادة التفعيل للمراجعة|Reactivate for review/i,
      }),
    );
    await expect(ownerCard(page, APPROVED_TITLE)).toHaveCount(0, { timeout: 30_000 });
    await expectActionCount(lifecycleActions, "reactivate", 1);

    await openOwnerTab(page, "pending");
    await expect(ownerCard(page, APPROVED_TITLE)).toBeVisible({ timeout: 30_000 });
    await reloadCurrentPage(page);
    await expect(ownerCard(page, APPROVED_TITLE)).toBeVisible({ timeout: 30_000 });

    await openOwnerTab(page, "needs_edit");
    const draftCard = ownerCard(page, DRAFT_TITLE);
    await expect(draftCard).toBeVisible({ timeout: 30_000 });
    await clickTwiceInSameTick(
      draftCard.getByRole("button", { name: /حذف المسودة|Delete draft/i }),
    );

    const deleteDialog = page.getByRole("dialog");
    await expect(deleteDialog).toBeVisible();
    await clickTwiceInSameTick(
      deleteDialog.getByRole("button", { name: /حذف المسودة|Delete draft/i }),
    );
    await expect(ownerCard(page, DRAFT_TITLE)).toHaveCount(0, { timeout: 30_000 });
    await expect.poll(() => draftDeletes).toBe(1);

    await reloadCurrentPage(page);
    await expect(ownerCard(page, DRAFT_TITLE)).toHaveCount(0);
    await expect(page.getByText(/لا توجد عناصر في هذا القسم|Nothing in this section/i)).toBeVisible(
      {
        timeout: 30_000,
      },
    );

    expect(Object.fromEntries(lifecycleActions)).toEqual({
      reserve: 1,
      unreserve: 1,
      reduce_price: 1,
      set_expiry: 1,
      sold: 1,
      reactivate: 1,
    });
    expect(draftDeletes).toBe(1);
    expect(remoteWrites).toEqual([]);
    expect(authorizedRequests).toEqual(
      expect.arrayContaining([
        "GET /api/profile",
        "GET /v1/account/listings",
        `PATCH /v1/listings/${APPROVED_LISTING_ID}/lifecycle`,
        `GET /api/listings/${APPROVED_LISTING_ID}`,
        `DELETE /v1/listings/${DRAFT_LISTING_ID}`,
      ]),
    );
  });
});

function ownerCard(page: Page, title: string): Locator {
  return page.locator("article.rawaj-owner-listing-card").filter({ hasText: title }).first();
}

async function openOwnerTab(
  page: Page,
  tab: "approved" | "pending" | "needs_edit" | "closed",
): Promise<void> {
  await page.goto(`/profile/listings?tab=${tab}`, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
}

async function reloadCurrentPage(page: Page): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForHydration(page);
}

async function expectActionCount(
  actions: Map<string, number>,
  action: string,
  count: number,
): Promise<void> {
  await expect.poll(() => actions.get(action) ?? 0).toBe(count);
}

async function clickTwiceInSameTick(locator: Locator): Promise<void> {
  await locator.evaluate((element: HTMLButtonElement) => {
    element.click();
    element.click();
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
}

async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1, {
    timeout: 30_000,
  });
}
