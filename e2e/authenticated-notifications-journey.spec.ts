import { expect, test, type Locator, type Page } from "@playwright/test";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const ACCOUNT_NOTIFICATION_ID = "00000000-0000-4000-8000-000000000051";
const CONVERSATION_NOTIFICATION_ID = "00000000-0000-4000-8000-000000000052";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000041";

const ACCOUNT_NOTIFICATION_TITLE = "تم تحديث إعدادات حسابك";
const CONVERSATION_NOTIFICATION_TITLE = "لديك رسالة جديدة من سارة";
const REMINDER_NOTIFICATION_TITLE = "تذكير بإكمال معلومات الحساب";

const MARK_READ_LABEL = /تحديد كمقروء|Mark read/i;
const MARK_ALL_LABEL = /قراءة الكل|Mark all read/i;


test.describe("authenticated launch-critical notifications journey", () => {
  test.setTimeout(120_000);

  test("marks one, opens a target, marks all once, and restores activity", async ({ page }) => {
    const remoteWrites: string[] = [];
    const authorizedRequests: string[] = [];
    let singleReadRequests = 0;
    let markAllRequests = 0;

    const resetResponse = await page.request.post("/__rawaj_e2e__/notifications/reset", {
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

      const privateRequest =
        url.pathname === "/api/profile" ||
        url.pathname.startsWith("/v1/account/notifications") ||
        url.pathname === "/v1/account/notification-preferences" ||
        url.pathname.startsWith("/v1/account/conversations") ||
        url.pathname.startsWith(`/v1/conversations/${CONVERSATION_ID}`);
      if (privateRequest) {
        expect(request.headers().authorization).toBe(`Bearer ${FIXTURE_TOKEN}`);
        authorizedRequests.push(`${method} ${url.pathname}`);
      }

      if (
        method === "PATCH" &&
        [ACCOUNT_NOTIFICATION_ID, CONVERSATION_NOTIFICATION_ID].some((id) =>
          url.pathname.endsWith(`/notifications/${id}`),
        )
      ) {
        singleReadRequests += 1;
      }
      if (method === "POST" && url.pathname === "/v1/account/notifications/read-all") {
        markAllRequests += 1;
      }
    });

    await page.addInitScript(() => {
      const marker = "rawaj:e2e:notifications-storage-cleared";
      if (window.sessionStorage.getItem(marker) === "1") return;
      window.localStorage.clear();
      window.sessionStorage.setItem(marker, "1");
    });

    await signIn(page, "/notifications");
    await expect(page).toHaveURL(/\/notifications(?:[/?#]|$)/, { timeout: 20_000 });

    const notificationCards = page.locator("article.rawaj-notification-timeline");
    await expect(notificationCards).toHaveCount(3, { timeout: 30_000 });
    await expect(unreadNotificationsMetric(page).locator("strong")).toHaveText("3");

    const accountCard = notificationCard(page, ACCOUNT_NOTIFICATION_TITLE);
    const markReadButton = accountCard.getByRole("button", { name: MARK_READ_LABEL });
    await expect(markReadButton).toBeVisible();
    await clickTwiceInSameTick(markReadButton);

    await expect(accountCard).toHaveAttribute("data-read", "true");
    await expect(unreadNotificationsMetric(page).locator("strong")).toHaveText("2");
    expect(singleReadRequests).toBe(1);

    const conversationCard = notificationCard(page, CONVERSATION_NOTIFICATION_TITLE);
    await conversationCard.locator("button").first().click();

    await expect(page).toHaveURL(new RegExp(`/chats\\?conversation=${CONVERSATION_ID}`), {
      timeout: 30_000,
    });
    await expect(page.locator(".rawaj-message-header h2")).toHaveText("سارة التجريبية", {
      timeout: 30_000,
    });
    expect(singleReadRequests).toBe(2);

    await page.goto("/notifications", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(page.locator("article.rawaj-notification-timeline")).toHaveCount(3, {
      timeout: 30_000,
    });
    await expect(unreadNotificationsMetric(page).locator("strong")).toHaveText("1");
    await expect(notificationCard(page, REMINDER_NOTIFICATION_TITLE)).toHaveAttribute(
      "data-read",
      "false",
    );

    const markAllButton = page.getByRole("button", { name: MARK_ALL_LABEL }).first();
    await expect(markAllButton).toBeEnabled();
    await clickTwiceInSameTick(markAllButton);

    await expect(unreadNotificationsMetric(page).locator("strong")).toHaveText("0");
    await expect(page.locator("article.rawaj-notification-timeline[data-read='true']")).toHaveCount(3);
    expect(markAllRequests).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(page.locator("article.rawaj-notification-timeline")).toHaveCount(3, {
      timeout: 30_000,
    });
    await expect(unreadNotificationsMetric(page).locator("strong")).toHaveText("0");
    await expect(page.locator("article.rawaj-notification-timeline[data-read='true']")).toHaveCount(3);

    await page.goto("/activity?tab=notifications", { waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(unreadNotificationsMetric(page).locator("strong")).toHaveText("0", {
      timeout: 30_000,
    });
    await expect(page.locator(".rawaj-activity-feed .rawaj-notification-timeline")).toHaveCount(3);
    await expect(
      page.locator(".rawaj-activity-feed .rawaj-notification-timeline[data-read='true']"),
    ).toHaveCount(3);

    expect(singleReadRequests).toBe(2);
    expect(markAllRequests).toBe(1);
    expect(remoteWrites).toEqual([]);
    expect(authorizedRequests).toEqual(
      expect.arrayContaining([
        "GET /api/profile",
        "GET /v1/account/notifications",
        "GET /v1/account/notifications/unread-count",
        `PATCH /v1/account/notifications/${ACCOUNT_NOTIFICATION_ID}`,
        `GET /v1/account/notifications/${CONVERSATION_NOTIFICATION_ID}`,
        `PATCH /v1/account/notifications/${CONVERSATION_NOTIFICATION_ID}`,
        "POST /v1/account/notifications/read-all",
        "GET /v1/account/conversations",
      ]),
    );
  });
});

function notificationCard(page: Page, title: string): Locator {
  return page.locator("article.rawaj-notification-timeline").filter({ hasText: title }).first();
}

function unreadNotificationsMetric(page: Page): Locator {
  return page
    .locator(".rawaj-communication-hero__metrics > div")
    .filter({ hasText: /تنبيهات غير مقروءة|Unread notifications/ })
    .first();
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
