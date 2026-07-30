import { expect, test, type Page } from "@playwright/test";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000041";
const INCOMING_MESSAGE = "مرحباً، هل السيارة ما زالت متوفرة؟";
const OUTGOING_MESSAGE = "نعم، ما زالت متوفرة ويمكن المعاينة غداً.";

test.describe("authenticated launch-critical messaging journey", () => {
  test.setTimeout(90_000);

  test("opens, marks read, sends once, and restores the conversation", async ({ page }) => {
    const remoteWrites: string[] = [];
    const authorizedRequests: string[] = [];
    let messageSendRequests = 0;

    page.on("request", (request) => {
      const url = new URL(request.url());
      const method = request.method();
      const isLocal = ["127.0.0.1", "localhost"].includes(url.hostname);
      if (!isLocal && method !== "GET" && method !== "HEAD") {
        remoteWrites.push(`${method} ${request.url()}`);
      }

      const privateMessagingRequest =
        url.pathname === "/api/profile" ||
        url.pathname.startsWith("/v1/account/conversations") ||
        url.pathname.startsWith("/v1/account/messages/") ||
        url.pathname.startsWith(`/v1/conversations/${CONVERSATION_ID}`);
      if (privateMessagingRequest) {
        expect(request.headers().authorization).toBe(`Bearer ${FIXTURE_TOKEN}`);
        authorizedRequests.push(`${method} ${url.pathname}`);
      }
      if (method === "POST" && url.pathname === `/v1/conversations/${CONVERSATION_ID}/messages`) {
        messageSendRequests += 1;
      }
    });

    await page.addInitScript(() => {
      const marker = "rawaj:e2e:messaging-storage-cleared";
      if (window.sessionStorage.getItem(marker) === "1") return;
      window.localStorage.clear();
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
    await expect(page.locator(".rawaj-message-header h2")).toHaveText("سارة التجريبية");
    await expect(
      page.locator(".rawaj-message-bubble").filter({ hasText: INCOMING_MESSAGE }),
    ).toHaveCount(1);

    const unreadMetric = page
      .locator(".rawaj-communication-hero__metrics > div")
      .filter({ hasText: /رسائل غير مقروءة|Unread messages/ });
    await expect(unreadMetric.locator("strong")).toHaveText("0", { timeout: 20_000 });

    const composer = page.getByLabel(/اكتب رسالة|Write a message/i);
    await composer.fill(OUTGOING_MESSAGE);
    const form = composer.locator("xpath=ancestor::form");
    await form.evaluate((element: HTMLFormElement) => {
      element.requestSubmit();
      element.requestSubmit();
    });

    await expect(page.getByText(/تم إرسال الرسالة|Message sent/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.locator(".rawaj-message-bubble").filter({ hasText: OUTGOING_MESSAGE }),
    ).toHaveCount(1);
    expect(messageSendRequests).toBe(1);

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHydration(page);
    await expect(page.locator(".rawaj-message-header h2")).toHaveText("سارة التجريبية", {
      timeout: 30_000,
    });
    await expect(
      page.locator(".rawaj-message-bubble").filter({ hasText: OUTGOING_MESSAGE }),
    ).toHaveCount(1);

    expect(remoteWrites).toEqual([]);
    expect(authorizedRequests).toEqual(
      expect.arrayContaining([
        "GET /api/profile",
        "GET /v1/account/conversations",
        `GET /v1/conversations/${CONVERSATION_ID}/messages`,
        `POST /v1/conversations/${CONVERSATION_ID}/read`,
        `POST /v1/conversations/${CONVERSATION_ID}/messages`,
      ]),
    );
  });
});

async function waitForHydration(page: Page): Promise<void> {
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1, {
    timeout: 30_000,
  });
}
