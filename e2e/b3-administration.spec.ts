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
    const header = page.locator(".rawaj-shell-header--workspace");
    await expect(header).toHaveCSS("background-color", "rgb(7, 56, 54)");
    await expect(header).toHaveCSS("background-image", "none");
    await expect(header.locator(".rawaj-shell-header__title h1")).toHaveCSS(
      "color",
      "rgb(249, 240, 228)",
    );
    const gate = main.locator(".rawaj-admin-gate");
    await expect(gate).toHaveCSS("background-color", "rgb(255, 250, 243)");
    await expect(gate).toHaveCSS("background-image", "none");
    const action = gate.getByRole("link", { name: "Log in" });
    await expect(action).toHaveCSS("background-color", "rgb(7, 56, 54)");
    await expect(action).toHaveCSS("background-image", "none");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#073836");
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
}, testInfo) => {
  test.setTimeout(120_000);
  await setFixtureRole(page, "owner");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of adminRoutes) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const nav = page.getByRole("navigation", { name: "Admin navigation" });
    await expect(nav.locator('[aria-current="page"]'), path).toHaveAttribute("href", path);
    await expect(page.locator("main.rawaj-admin-v3")).toBeVisible();
    await expect(page.locator(".rawaj-app-shell")).toHaveCSS(
      "background-color",
      "rgb(249, 240, 228)",
    );
    await expect(page.locator(".rawaj-app-shell")).toHaveCSS("background-image", "none");
    await expect(page.locator(".rawaj-admin-nav-shell")).toHaveCSS("background-image", "none");
    await expect(page.locator(".rawaj-admin-access-notice")).toHaveCSS("background-image", "none");
    await expect(nav.locator('[aria-current="page"]')).toHaveCSS(
      "background-color",
      "rgb(7, 56, 54)",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      path,
    ).toBeLessThanOrEqual(391);
    if (
      ["/admin", "/admin/listings", "/admin/users", "/admin/ad-placements", "/admin/owner-controls"].includes(
        path,
      )
    ) {
      await page.screenshot({
        path: testInfo.outputPath(`owner-admin-${path.slice(1).replaceAll("/", "-")}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
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

test("B3.4 destructive placement actions require a labelled confirmation and reason", async ({
  page,
}) => {
  await setFixtureRole(page, "owner");
  const fixture = {
    id: "fixture-placement",
    name: "Fixture placement",
    placementPage: "home",
    imageUrl: "/favicon.svg",
    destinationUrl: "https://example.invalid/",
    status: "draft",
    priority: 1,
    targetMobile: true,
    targetDesktop: true,
    version: 3,
  };
  await page.route("**/v1/admin/ad-placements", async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: { data: [fixture] } });
  });
  await page.goto("/admin/ad-placements");
  const remove = page.getByRole("button", { name: "Delete", exact: true });
  await remove.click();
  const dialog = page.getByRole("dialog", { name: "Delete ad placement" });
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const confirm = dialog.getByRole("button", { name: "Delete permanently" });
  await expect(cancel).toBeFocused();
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Deletion reason (for audit)").fill("Fixture cleanup");
  await expect(confirm).toBeEnabled();
  await cancel.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(remove).toBeVisible();
});

test("B3.4 account restrictions submit exactly one audited change", async ({ page }) => {
  await setFixtureRole(page, "admin");
  const user = {
    id: "fixture-restricted-user",
    email: "restricted@example.invalid",
    displayName: "Fixture Restriction Candidate",
    accountStatus: "active",
    verificationStatus: "unverified",
    createdAt: "2026-11-15T00:00:00.000Z",
    roles: ["user"],
    listingCount: 1,
    reportsSubmitted: 0,
    reportsReceived: 0,
    activeRestrictions: [],
  };
  let restrictionWrites = 0;
  await page.route("**/v1/admin/users", async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: { data: [user] } });
  });
  await page.route("**/v1/admin/users/restrictions", async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      userId: user.id,
      restrictionType: "messaging",
      reason: "Isolated restriction acceptance",
    });
    restrictionWrites += 1;
    await route.fulfill({ json: { data: "fixture-restriction-id" } });
  });
  await page.goto("/admin/users");
  await page.getByRole("button", { name: /Fixture Restriction Candidate/ }).click();
  await page
    .getByPlaceholder("Enter a clear reason for the audit trail.")
    .fill("Isolated restriction acceptance");
  await page.getByRole("combobox", { name: "Restriction type" }).selectOption("messaging");
  const apply = page.getByRole("button", { name: "Apply restriction" });
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.getByText("Action completed and audited.")).toBeVisible();
  expect(restrictionWrites).toBe(1);
});

test("B3.4 owner campaign status requires a reason and optimistic version", async ({ page }) => {
  await setFixtureRole(page, "owner");
  const campaign = {
    id: "fixture-campaign",
    name: "Fixture Acceptance Campaign",
    status: "draft",
    startsAt: null,
    endsAt: null,
    targetPages: [],
    targetCategoryIds: [],
    version: 3,
    createdAt: "2026-11-15T00:00:00.000Z",
    updatedAt: "2026-11-15T00:00:00.000Z",
    creativeCount: 0,
    impressions: 100,
    clicks: 5,
    ctr: 5,
  };
  let changed = false;
  let statusWrites = 0;
  await page.route("**/v1/admin/campaigns", async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      json: {
        data: [{ ...campaign, status: changed ? "active" : "draft", version: changed ? 4 : 3 }],
      },
    });
  });
  await page.route("**/v1/admin/campaigns/fixture-campaign/status", async (route) => {
    expect(new URL(route.request().url()).hostname).toBe("127.0.0.1");
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toMatchObject({
      id: campaign.id,
      status: "active",
      expectedVersion: 3,
      reason: "Isolated campaign acceptance",
    });
    statusWrites += 1;
    changed = true;
    await route.fulfill({
      json: { data: { id: campaign.id, version: 4, updatedAt: campaign.updatedAt } },
    });
  });
  await page.goto("/admin/campaigns");
  const activate = page.getByRole("button", { name: "Activate", exact: true });
  await expect(activate).toBeVisible();
  await activate.click();
  await expect(page.getByText("Enter a clear reason for the status change.")).toBeVisible();
  expect(statusWrites).toBe(0);
  await page.getByPlaceholder("Status change reason").fill("Isolated campaign acceptance");
  await activate.click();
  await expect(page.getByText("Campaign status changed and audited.")).toBeVisible();
  expect(statusWrites).toBe(1);
});

test("B3.4 audit filters only the bounded history the backend actually returns", async ({
  page,
}) => {
  await setFixtureRole(page, "admin");
  let auditReads = 0;
  await page.route("**/v1/admin/audit?*", async (route) => {
    const url = new URL(route.request().url());
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.searchParams.get("limit")).toBe("100");
    expect(url.searchParams.has("offset")).toBe(false);
    expect(url.searchParams.has("actionPrefix")).toBe(false);
    expect(route.request().method()).toBe("GET");
    auditReads += 1;
    await route.fulfill({
      json: {
        data: [
          {
            id: "fixture-audit-user",
            actorId: "fixture-admin",
            actorRole: "admin",
            action: "user.restricted",
            targetTable: "users",
            targetId: "fixture-user",
            metadata: { reason: "Isolated audit" },
            createdAt: "2026-11-15T01:00:00.000Z",
          },
          {
            id: "fixture-audit-notification",
            actorId: "fixture-admin",
            actorRole: "admin",
            action: "notification.sent",
            targetTable: "notifications",
            targetId: "fixture-notification",
            metadata: {},
            createdAt: "2026-11-15T01:01:00.000Z",
          },
        ],
      },
    });
  });
  await page.goto("/admin/audit");
  await expect(page.getByText("user.restricted")).toBeVisible();
  await expect(page.getByText("notification.sent")).toBeVisible();
  // The E2E dev server may run mount effects twice under React StrictMode.
  // Assert that a client-side filter makes no additional backend request.
  const initialAuditReads = auditReads;
  expect(initialAuditReads).toBeGreaterThanOrEqual(1);
  expect(initialAuditReads).toBeLessThanOrEqual(2);
  await page.locator("main.rawaj-admin-v3 select").selectOption("user.");
  await expect(page.getByText("user.restricted")).toBeVisible();
  await expect(page.getByText("notification.sent")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
  expect(auditReads).toBe(initialAuditReads);
});
