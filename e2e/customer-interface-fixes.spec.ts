import { expect, test, type Page } from "@playwright/test";

/** Customer-facing acceptance; all messaging writes are intercepted by the local fixture.
 * No test in this file may create a production message, complaint, or block.
 */
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000041";

async function hydrated(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
}

for (const language of ["ar", "en"] as const) {
  for (const path of ["/", "/support"] as const) {
    test(`feedback dialog: ${path} ${language} contrast, focus, validation and close`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      await page.setViewportSize({
        width: testInfo.project.name.startsWith("mobile") ? 390 : 1200,
        height: 640,
      });
      await page.route("**/v1/feedback/config", async (route) => {
        await route.fulfill({ status: 200, json: { data: { enabled: true } } });
      });
      let submissions = 0;
      await page.route("**/v1/feedback", async (route) => {
        if (route.request().method() !== "GET") submissions += 1;
        await route.fulfill({ status: 400, json: { error: { code: "fixture_only" } } });
      });
      await hydrated(page, path);
      const entry = page.locator("[data-feedback-trigger] button").first();
      await expect(entry).toBeVisible();
      await entry.click();
      const dialog = page.getByRole("dialog", { name: /اقتراح أو شكوى|suggestion or complaint/i });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await expect(dialog).toHaveCSS("background-image", "none");
      await expect(dialog).toHaveCSS("color", "rgb(21, 35, 34)");
      const close = dialog.getByRole("button", { name: language === "ar" ? "إغلاق" : "Close" });
      await expect(close).toHaveCSS("color", "rgb(16, 63, 66)");
      const selected = dialog.locator('[aria-pressed="true"]');
      await expect(selected).toHaveCSS("background-color", "rgb(234, 241, 238)");
      const newCategory = dialog.locator(".rawaj-feedback-dialog__category").nth(1);
      await expect(newCategory).toHaveAttribute("aria-pressed", "false");
      await newCategory.click();
      await expect(newCategory).toHaveAttribute("aria-pressed", "true");
      await dialog.getByRole("button", { name: /إرسال للإدارة|Send to management/i }).click();
      await expect(dialog.getByRole("status")).toContainText(language === "ar" ? "4" : "4");
      expect(submissions).toBe(0);
      await expect(dialog).toBeVisible();
      await dialog.screenshot({
        path: testInfo.outputPath(`feedback-${path.slice(1) || "home"}-${language}.png`),
        animations: "disabled",
      });
      await close.click();
      await expect(dialog).toHaveCount(0);
      await expect(entry).toBeFocused();
    });
  }
}

test("mobile Home has one Categories entry in the bottom dock, not a duplicate header hamburger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await hydrated(page, "/");
  await expect(page.locator(".rawaj-home-menu-action")).toHaveCount(0);
  await expect(page.locator('.rawaj-mobile-dock [data-section="categories"]')).toBeVisible();
});

test("iPhone-sized conversation has reachable Send and tools, secondary offers, and restores dock on exit", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.RAWAJ_E2E_USE_FIXTURES !== "1",
    "Requires local-only messaging/Firebase fixtures",
  );
  await page.request.post("/__rawaj_e2e__/messaging/reset", {
    headers: { "x-rawaj-e2e-reset": "1" },
  });
  await page.addInitScript(() => {
    const marker = "rawaj:e2e:customer-reset";
    if (sessionStorage.getItem(marker) === "1") return;
    localStorage.clear();
    sessionStorage.setItem(marker, "1");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await hydrated(page, "/login?returnTo=/chats");
  await page.getByLabel(/^(Email|البريد الإلكتروني)$/).fill("browser-smoke@rawa-j.test");
  await page.locator('form input[type="password"]').fill("Rawaj-E2E-Password-1");
  await page
    .locator("form")
    .getByRole("button", { name: /^(Log in|تسجيل الدخول)$/ })
    .click();
  await expect(page).toHaveURL(/\/chats/);
  await expect(page.locator(".rawaj-message-workspace")).toHaveAttribute("data-view", "list");
  await page.locator(".rawaj-conversation-summary").first().click();
  await expect(page).toHaveURL(new RegExp(`conversation=${CONVERSATION_ID}`));
  await expect(page.locator(".rawaj-message-workspace")).toHaveAttribute(
    "data-view",
    "conversation",
  );
  const dock = page.locator(".rawaj-mobile-dock");
  await expect(dock).toBeHidden();
  await expect(page.locator("[data-feedback-trigger]")).toBeHidden();
  const stream = page.locator(".rawaj-message-stream");
  await expect(stream).toBeVisible();
  const input = page.getByRole("textbox", { name: /اكتب رسالة|Write a message/i });
  const send = page.locator(".rawaj-message-composer__send");
  await expect(send).toBeVisible();
  await expect(send).toBeDisabled();
  await expect(page.getByRole("button", { name: /إرفاق صورة|Attach image/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /تسجيل رسالة صوتية|Record voice message/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /مشاركة الموقع|Share location/i })).toBeVisible();
  await expect(page.locator(".rawaj-message-composer__block-reason")).toHaveCount(0);
  await page.locator(".rawaj-message-offers-toggle").click();
  await expect(page.locator("#rawaj-conversation-offers")).toBeVisible();
  await page.locator(".rawaj-message-offers-toggle").click();
  await expect(page.locator("#rawaj-conversation-offers")).toHaveCount(0);
  await input.fill("Deterministic fixture draft — not sent");
  await expect(send).toBeEnabled();
  await expect(send).toHaveCSS("background-color", "rgb(16, 63, 66)");
  // Deterministic visualViewport shrink approximation; not real iOS keyboard acceptance.
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--app-viewport-height", "480px"),
  );
  await input.focus();
  const bounds = await page.evaluate(() => {
    const root = document.querySelector(".rawaj-message-workspace");
    const stream = document.querySelector(".rawaj-message-stream");
    const send = document.querySelector(".rawaj-message-composer__send");
    return {
      viewport: window.innerHeight,
      workspace: root?.getBoundingClientRect().toJSON(),
      stream: stream?.getBoundingClientRect().toJSON(),
      send: send?.getBoundingClientRect().toJSON(),
    };
  });
  expect(bounds.workspace).toBeTruthy();
  expect(bounds.stream).toBeTruthy();
  expect(bounds.send).toBeTruthy();
  expect(bounds.send!.bottom).toBeLessThanOrEqual(bounds.workspace!.bottom + 1);
  expect(bounds.stream!.bottom).toBeLessThanOrEqual(bounds.send!.top + 1);
  await page.screenshot({
    path: testInfo.outputPath("active-conversation-after.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: /حظر المستخدم|Block user/i }).click();
  const blockDialog = page.getByRole("dialog", { name: /تأكيد حظر المستخدم|Confirm block user/i });
  await expect(blockDialog).toBeVisible();
  await expect(blockDialog.getByLabel(/سبب الحظر|Block reason/i)).toBeVisible();
  await blockDialog.getByRole("button", { name: /إلغاء|Cancel/i }).click();
  await expect(blockDialog).toHaveCount(0);
  await page
    .getByRole("button", { name: /المحادثات|Conversations/i })
    .first()
    .click();
  await expect(page.locator(".rawaj-message-workspace")).toHaveAttribute("data-view", "list");
  await expect(dock).toBeVisible();
});
