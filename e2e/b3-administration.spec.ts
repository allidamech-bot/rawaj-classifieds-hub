import { expect, test, type Page } from "@playwright/test";

const adminRoutes = [
  "/admin",
  "/admin/pending",
  "/admin/listings",
  "/admin/data-quality",
  "/admin/reviews",
  "/admin/reports",
  "/admin/message-reports",
  "/admin/safety",
  "/admin/verifications",
  "/admin/users",
  "/admin/promotions",
  "/admin/ad-placements",
  "/admin/campaigns",
  "/admin/audit",
  "/admin/notifications",
  "/admin/owner-controls",
];

for (const path of adminRoutes) {
  test(`B3.4 ${path} keeps the signed-out gate and workspace identity`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("rawaj-language", "en"));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const main = page.locator("main.rawaj-admin-v3");
    await expect(main.getByRole("heading", { name: "Login required" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(main).toHaveCSS("color", "rgb(19, 39, 36)");
    await expect(page.getByRole("navigation", { name: "Admin navigation" })).toHaveCount(0);
  });
}

async function setFixtureRole(page: Page, role: "user" | "admin" | "owner", language = "en") {
  test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Requires isolated Firebase fixtures");
  await page.addInitScript((value) => {
    localStorage.setItem("rawaj-language", value);
    localStorage.setItem("rawaj:e2e:firebase-user", "{}");
  }, language);
  await page.route("**/api/profile", async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    const response = await route.fetch();
    const payload = await response.json();
    await route.fulfill({ response, json: { data: { ...payload.data, roles: [role] } } });
  });
  await page.route("**/v1/admin/**", async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      status: 503,
      json: {
        error: { code: "service_unavailable", message: "Isolated admin fixture unavailable" },
      },
    });
  });
}

test("B3.4 ordinary accounts remain blocked from direct admin access", async ({ page }) => {
  await setFixtureRole(page, "user");
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Not authorized" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin navigation" })).toHaveCount(0);
});

test("B3.4 administrators see the current workspace and owner access stays restricted", async ({
  page,
}) => {
  await setFixtureRole(page, "admin");
  await page.goto("/admin/reports");
  const nav = page.getByRole("navigation", { name: "Admin navigation" });
  await expect(nav).toBeVisible();
  await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute("href", "/admin/reports");
  await expect(nav.locator('a[href="/admin/owner-controls"]')).toHaveCount(0);
  await page.goto("/admin/owner-controls");
  await expect(
    page.getByRole("heading", { name: "You do not have access to this workspace" }),
  ).toBeVisible();
});

test("B3.4 owners retain access to their authorized workspace", async ({ page }) => {
  await setFixtureRole(page, "owner");
  await page.goto("/admin/owner-controls");
  const nav = page.getByRole("navigation", { name: "Admin navigation" });
  await expect(nav.locator('a[aria-current="page"]')).toHaveAttribute(
    "href",
    "/admin/owner-controls",
  );
});

test("B3.4 RTL administration navigation fits narrow and wide viewports", async ({ page }) => {
  await setFixtureRole(page, "admin", "ar");
  await page.goto("/admin/reports");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  const current = page
    .getByRole("navigation", { name: "تنقل الإدارة" })
    .locator('[aria-current="page"]');
  await expect(current).toHaveAttribute("href", "/admin/reports");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    );
    const currentControl = await current.boundingBox();
    expect(currentControl?.height).toBeGreaterThanOrEqual(44);
  }
});

test("B3.4 owners can open every documented workspace with isolated service errors", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await setFixtureRole(page, "owner");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of adminRoutes) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Admin navigation" });
    await expect(nav.locator('[aria-current="page"]'), path).toHaveAttribute("href", path);
    await expect(page.locator("main.rawaj-admin-v3")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      path,
    ).toBeLessThanOrEqual(391);
  }
});

test("B3.4 reporting sends the expected version and prevents a second decision during reload", async ({
  page,
}) => {
  await setFixtureRole(page, "admin");
  const version = "2026-11-15T00:00:00.000Z";
  const report = {
    id: "fixture-report",
    listingId: "fixture-listing",
    listingTitleSnapshot: "Fixture listing",
    reporterId: "fixture-user",
    reportType: "suspicious_listing",
    reason: "Fixture report awaiting a decision",
    status: "new",
    updatedAt: version,
  };
  let decisionCount = 0;
  let allowReload!: () => void;
  const reload = new Promise<void>((resolve) => {
    allowReload = resolve;
  });
  await page.route("**/v1/admin/listing-reports**", async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    if (route.request().method() === "PATCH") {
      expect(route.request().postDataJSON()).toMatchObject({
        expectedUpdatedAt: version,
        status: "resolved",
      });
      decisionCount += 1;
      await route.fulfill({ json: { data: { success: true } } });
    } else {
      expect(route.request().method()).toBe("GET");
      if (decisionCount) await reload;
      await route.fulfill({
        json: { data: [{ ...report, status: decisionCount ? "resolved" : "new" }] },
      });
    }
  });
  try {
    await page.goto("/admin/reports");
    const record = page.locator("article").filter({ hasText: report.reason });
    await record.getByRole("button", { name: "Resolved", exact: true }).click();
    await expect(page.getByText("Report updated.")).toBeVisible();
    const pendingButtons = record.getByRole("button", { name: "Updating" });
    await expect(pendingButtons).toHaveCount(3);
    for (const button of await pendingButtons.all()) {
      await expect(button).toBeDisabled();
    }
    expect(decisionCount).toBe(1);
    allowReload();
    await expect(record.getByRole("button", { name: "Resolved", exact: true })).toBeEnabled();
  } finally {
    allowReload();
  }
});

test("B3.4 private evidence stays behind the protected document action and can retry", async ({
  page,
}) => {
  await setFixtureRole(page, "admin");
  const recordId = "00000000-0000-4000-8000-000000000041";
  const documentPath = "fixture-private-evidence";
  let documentRequests = 0;
  await page.route("**/v1/admin/verifications", async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    await route.fulfill({
      json: {
        data: [
          {
            id: recordId,
            legalName: "Fixture reviewer request",
            documentPath,
            status: "pending_review",
          },
        ],
      },
    });
  });
  await page.route(`**/v1/admin/verifications/${recordId}/document`, async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    expect(route.request().headers().authorization).toBe("Bearer rawaj-e2e-firebase-token");
    documentRequests += 1;
    await route.fulfill({
      status: documentRequests === 1 ? 503 : 200,
      contentType: "application/pdf",
      body: "%PDF-1.4\nDeterministic test fixture",
    });
  });
  await page.goto("/admin/verifications");
  const open = page.getByRole("link", { name: "Open document" });
  await expect(open).toHaveCount(0);
  await page.getByRole("button", { name: "Load secure document" }).click();
  await expect(open).toHaveCount(0);
  await page.getByRole("button", { name: "Retry secure document" }).click();
  await expect(open).toHaveAttribute("href", /^blob:http:\/\/127\.0\.0\.1:/);
  await expect(page.locator(`[href*="${documentPath}"]`)).toHaveCount(0);
  expect(documentRequests).toBe(2);
});
