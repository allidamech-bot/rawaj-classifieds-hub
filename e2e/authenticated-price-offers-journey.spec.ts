import { expect, test, type Page, type Request } from "@playwright/test";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000041";

test.describe.serial("authenticated structured price-offer journey", () => {
  test.setTimeout(90_000);

  test("seller reviews and accepts an incoming buyer offer", async ({ page }) => {
    const observed = observeOfferRequests(page);
    await resetOffers(page, "seller");
    await openFixtureConversation(page);

    const panel = page.locator('[data-price-offer-panel="true"]');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.locator('[data-price-offer-card="pending"]')).toHaveCount(1);
    await expect(panel.locator('[data-price-offer-action="accept"]')).toBeEnabled();

    page.once("dialog", (dialog) => void dialog.accept());
    await panel.locator('[data-price-offer-action="accept"]').click();

    await expect(panel.locator('[data-price-offer-card="accepted"]')).toHaveCount(1, {
      timeout: 20_000,
    });
    expect(observed.patchCount()).toBe(1);
    expect(observed.remoteWrites()).toEqual([]);
    expect(observed.authorized()).toEqual(
      expect.arrayContaining([
        `GET /v1/conversations/${CONVERSATION_ID}/offers`,
        `PATCH /v1/offers/00000000-0000-4000-8000-000000000044`,
      ]),
    );
  });

  test("buyer creates and withdraws a price offer exactly once", async ({ page }) => {
    const observed = observeOfferRequests(page);
    await resetOffers(page, "buyer");
    await openFixtureConversation(page);

    const panel = page.locator('[data-price-offer-panel="true"]');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    const amountInput = panel.locator('[data-price-offer-input="initial"]');
    await expect(amountInput).toBeVisible();
    await amountInput.fill("410000000");
    await panel.locator('[data-price-offer-action="create"]').click();

    await expect(panel.locator('[data-price-offer-card="pending"]')).toHaveCount(1, {
      timeout: 20_000,
    });
    expect(observed.postCount()).toBe(1);

    page.once("dialog", (dialog) => void dialog.accept());
    await panel.locator('[data-price-offer-action="withdraw"]').click();

    await expect(panel.locator('[data-price-offer-card="withdrawn"]')).toHaveCount(1, {
      timeout: 20_000,
    });
    expect(observed.patchCount()).toBe(1);
    expect(observed.remoteWrites()).toEqual([]);
    expect(observed.authorized()).toEqual(
      expect.arrayContaining([
        `POST /v1/conversations/${CONVERSATION_ID}/offers`,
        expect.stringMatching(/^PATCH \/v1\/offers\//),
      ]),
    );
  });
});

async function resetOffers(page: Page, role: "buyer" | "seller") {
  const response = await page.request.post(
    `/__rawaj_e2e__/messaging/reset?offerRole=${encodeURIComponent(role)}`,
    { headers: { "x-rawaj-e2e-reset": "1" } },
  );
  expect(response.ok()).toBe(true);
}

async function openFixtureConversation(page: Page) {
  await page.addInitScript(() => {
    const marker = "rawaj:e2e:price-offers-storage-cleared";
    if (window.sessionStorage.getItem(marker) === "1") return;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem(marker, "1");
  });
  await page.goto("/login?returnTo=/chats", { waitUntil: "domcontentloaded" });
  await waitForHydration(page);

  await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill("browser-smoke@rawa-j.test");
  await page.locator('form input[type="password"]').fill("Rawaj-E2E-Password-1");
  await page
    .locator("form")
    .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
    .click();

  await expect(page).toHaveURL(/\/chats(?:[/?#]|$)/, { timeout: 20_000 });
  const conversation = page
    .locator(".rawaj-conversation-summary")
    .filter({ hasText: "سارة التجريبية" })
    .first();
  await expect(conversation).toBeVisible({ timeout: 30_000 });
  await conversation.click();
  await expect(page).toHaveURL(new RegExp(`conversation=${CONVERSATION_ID}`));
}

function observeOfferRequests(page: Page) {
  const authorized: string[] = [];
  const remoteWrites: string[] = [];
  let postCount = 0;
  let patchCount = 0;

  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    const method = request.method();
    const isLocal = ["127.0.0.1", "localhost"].includes(url.hostname);
    if (!isLocal && method !== "GET" && method !== "HEAD") {
      remoteWrites.push(`${method} ${request.url()}`);
    }

    const isOfferRequest =
      url.pathname === `/v1/conversations/${CONVERSATION_ID}/offers` ||
      url.pathname.startsWith("/v1/offers/");
    if (!isOfferRequest) return;

    expect(request.headers().authorization).toBe(`Bearer ${FIXTURE_TOKEN}`);
    authorized.push(`${method} ${url.pathname}`);
    if (method === "POST") postCount += 1;
    if (method === "PATCH") patchCount += 1;
  });

  return {
    authorized: () => authorized,
    remoteWrites: () => remoteWrites,
    postCount: () => postCount,
    patchCount: () => patchCount,
  };
}

async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1, {
    timeout: 30_000,
  });
}
