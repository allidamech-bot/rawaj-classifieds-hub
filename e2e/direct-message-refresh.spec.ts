import { expect, test } from "@playwright/test";

const RECIPIENT_ID = "00000000-0000-4000-8000-000000000047";
const DIRECT_ID = "00000000-0000-4000-8000-000000000048";
const RECIPIENT_EMAIL = "relative@example.test";

test("new message starts a direct conversation without a listing", async ({ page }) => {
  test.setTimeout(90_000);
  let lookups = 0;
  let creations = 0;

  await page.route(/\/v1\/conversations\/direct(?:\/lookup)?$/, async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.headers().authorization).toBe("Bearer rawaj-e2e-firebase-token");

    if (request.url().endsWith("/lookup")) {
      lookups++;
      expect(request.postDataJSON()).toEqual({ email: RECIPIENT_EMAIL });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: RECIPIENT_ID, displayName: "أخي التجريبي" } }),
      });
      return;
    }
    creations++;
    expect(request.postDataJSON()).toEqual({ recipientId: RECIPIENT_ID });
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { id: DIRECT_ID, created: true } }),
    });
  });

  await page.route(new RegExp(`/v1/conversations/${DIRECT_ID}(?:\\?|$)`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: DIRECT_ID,
          listing_id: null,
          listing_title: null,
          status: "active",
          other_display_name: "أخي التجريبي",
          other_avatar_url: null,
          unread_count: 0,
          last_message_at: null,
          last_message_preview: null,
          created_at: "2026-11-22T00:00:00Z",
          updated_at: "2026-11-22T00:00:00Z",
        },
      }),
    });
  });
  await page.route(
    new RegExp(`/v1/conversations/${DIRECT_ID}/(?:messages|read)(?:\\?|$)`),
    async (route) => {
      const messages = route.request().url().includes("/messages");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: messages ? { items: [], hasMore: false } : { success: true },
        }),
      });
    },
  );

  await page.goto("/login?returnTo=/chats", { waitUntil: "domcontentloaded" });
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
  await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill("browser-smoke@rawa-j.test");
  await page.locator('form input[type="password"]').fill("Rawaj-E2E-Password-1");
  await page
    .locator("form")
    .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
    .click();

  await expect(page).toHaveURL(/\/chats(?:[/?#]|$)/, { timeout: 20_000 });
  await page.getByRole("button", { name: /رسالة جديدة|New message/ }).click();
  await page.getByLabel(/البريد الإلكتروني للمستخدم|Recipient email/).fill(RECIPIENT_EMAIL);
  await page.getByRole("button", { name: /بحث عن المستخدم|Find user/ }).click();
  await expect(page.getByText("أخي التجريبي")).toBeVisible();
  expect(lookups).toBe(1);
  await page.getByRole("button", { name: /بدء المحادثة|Start conversation/ }).click();
  await expect(page).toHaveURL(new RegExp(`conversation=${DIRECT_ID}`));
  await expect(page.locator(".rawaj-message-header h2")).toContainText("أخي التجريبي");
  expect(creations).toBe(1);
});

test("mobile pull keeps the document intact", async ({ page }, info) => {
  test.skip(!info.project.name.includes("mobile"), "Touchscreen project required.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.documentElement.dataset.refreshDocument = "persistent";
    document.documentElement.dataset.refreshEvents = "0";
    window.addEventListener("rawaj:pull-refresh", () => {
      document.documentElement.dataset.refreshEvents = String(
        Number(document.documentElement.dataset.refreshEvents ?? 0) + 1,
      );
    });
    const target = document.querySelector(".rawaj-signature-home");
    if (!(target instanceof HTMLElement)) throw new Error("Home pull target missing");
    const touch = (clientY: number) =>
      new Touch({
        identifier: 1,
        target,
        clientX: 60,
        clientY,
      });
    target.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        touches: [touch(100)],
        changedTouches: [touch(100)],
      }),
    );
    target.dispatchEvent(
      new TouchEvent("touchmove", {
        bubbles: true,
        cancelable: true,
        touches: [touch(280)],
        changedTouches: [touch(280)],
      }),
    );
    target.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        touches: [],
        changedTouches: [touch(280)],
      }),
    );
  });
  await expect.poll(() => page.locator("html").getAttribute("data-refresh-events")).toBe("1");
  await expect(page.locator("html")).toHaveAttribute("data-refresh-document", "persistent");
});
