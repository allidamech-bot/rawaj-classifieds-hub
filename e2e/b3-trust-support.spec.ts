import { expect, test } from "@playwright/test";
import { expectRenderedLayout } from "./layout-audit";

const routes = ["/support", "/safety", "/verification", "/privacy", "/terms", "/prohibited"];

for (const language of ["ar", "en"] as const) {
  for (const path of routes) {
    test(`B3.3 ${path} gives ${language} readers the approved trust palette`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("rawaj-language", value), language);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("dir", language === "ar" ? "rtl" : "ltr");
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".rawaj-app-shell")).toHaveAttribute(
        "data-design-palette",
        "ivory",
      );
      if (path === "/support") {
        // Support now has a standalone light heading rather than the retired trust hero.
        await expect(page.locator("main.rawaj-support-v2 h1")).toHaveCSS(
          "color",
          "rgb(19, 39, 36)",
        );
      }
      if (path === "/safety") {
        const hero = page.locator("main .rawaj-trust-hero");
        await expect(hero).toHaveCSS("background-color", "rgb(7, 56, 54)");
        await expect(hero.locator("h1")).toHaveCSS("color", "rgb(249, 240, 228)");
      }
      for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width + 1,
        );
      }
    });
  }
}

test.describe("authenticated trust requests", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Requires isolated Firebase fixtures");
    await page.addInitScript(() => {
      localStorage.setItem("rawaj-language", "en");
      localStorage.setItem("rawaj:e2e:firebase-user", "{}");
    });
  });

  test("support retries the history read and shows a submitted request", async ({ page }) => {
    let reads = 0;
    let submissions = 0;
    const subject = "Fixture support request";
    const message = "A deterministic description for the local support fixture.";
    await page.route("**/v1/account/support-requests**", async (route) => {
      expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
      if (route.request().method() === "POST") {
        submissions += 1;
        expect(route.request().postDataJSON()).toMatchObject({ subject, message });
        await route.fulfill({
          status: 201,
          json: { data: { id: "support-fixture", subject, message, status: "new" } },
        });
      } else if (++reads === 1) {
        await route.fulfill({
          status: 503,
          json: { error: { code: "unavailable", message: "History temporarily unavailable" } },
        });
      } else {
        await route.fulfill({ json: { data: [] } });
      }
    });
    await page.goto("/support");
    await expect(page.getByRole("alert")).toHaveText("History temporarily unavailable");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("No stored support requests yet.")).toBeVisible();
    const submit = page.getByRole("button", { name: "Submit request" });
    await submit.click();
    expect(submissions).toBe(0);
    await page.getByLabel("Subject").fill(subject);
    await page.getByLabel("Message", { exact: true }).fill(message);
    await submit.click();
    await expect(
      page.getByRole("status").filter({ hasText: "Support request submitted for review." }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: subject })).toBeVisible();
    expect(submissions).toBe(1);
  });

  test("listing report preserves its existing action and confirmation", async ({ page }) => {
    let reports = 0;
    await page.route("**/v1/listings/e2e-listing-featured/reports", async (route) => {
      expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toMatchObject({ reportType: "suspicious_listing" });
      reports += 1;
      await route.fulfill({
        status: 201,
        json: { data: { id: "fixture-report", duplicate: false } },
      });
    });
    await page.goto("/listings/e2e-listing-featured");
    await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
    const reportButton = page.getByRole("button", { name: "Report listing" });
    await reportButton.focus();
    await expect(reportButton).toBeFocused();
    await reportButton.press("Enter");
    await expect(page.getByText("Report sent for review.")).toBeVisible();
    expect(reports).toBe(1);
  });

  test("verification sends fixture evidence only to the private request endpoint", async ({
    page,
    browserName,
  }, testInfo) => {
    let submissions = 0;
    const filename = "fixture-identity.pdf";
    const record = {
      id: "verification-fixture",
      requestType: "personal",
      documentType: "national_id",
      legalName: "Fixture User",
      status: "pending_review",
      createdAt: "2026-11-15T00:00:00.000Z",
    };
    await page.route("**/v1/account/verifications", async (route) => {
      expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
      if (route.request().method() === "POST") {
        submissions += 1;
        expect(route.request().postData()).toContain(filename);
        await route.fulfill({ status: 201, json: { data: record } });
      } else {
        await route.fulfill({ json: { data: submissions ? [record] : [] } });
      }
    });
    await page.goto("/verification");
    const submit = page.getByRole("button", { name: "Submit verification request" });
    await expect(submit).toBeDisabled();
    if (browserName === "chromium") {
      await expectRenderedLayout(page, {
        label: `B3.3:${testInfo.project.name}:authenticated-verification`,
        mobile: testInfo.project.name.startsWith("mobile"),
      });
    }
    await page.getByLabel("Legal name exactly as shown on the document").fill("Fixture User");
    await page.getByLabel("Document type").selectOption("national_id");
    await page.locator('input[type="file"]').setInputFiles({
      name: filename,
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nDeterministic test fixture"),
    });
    await page.getByRole("checkbox").check();
    await submit.click();
    await expect(page.getByRole("button", { name: "Request under review" })).toBeDisabled();
    expect(submissions).toBe(1);
    await expect(page.locator("main a").filter({ hasText: filename })).toHaveCount(0);
  });
});
