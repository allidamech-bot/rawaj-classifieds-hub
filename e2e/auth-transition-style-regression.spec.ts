import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
}

function buildSyntheticGoogleOAuthSession() {
  const now = Math.floor(Date.now() / 1000);
  const userId = "00000000-0000-4000-8000-000000000001";
  const encodePart = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const accessToken = `${encodePart({ alg: "ES256", typ: "JWT" })}.${encodePart({
    iss: "https://dpymopdckflnpmowhlyq.supabase.co/auth/v1",
    sub: userId,
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
    email: "oauth-regression@example.com",
    role: "authenticated",
    aal: "aal1",
    amr: [{ method: "oauth", timestamp: now }],
    session_id: "00000000-0000-4000-8000-000000000002",
    is_anonymous: false,
  })}.synthetic-signature`;
  const createdAt = new Date(now * 1000).toISOString();
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "oauth-regression@example.com",
    email_confirmed_at: createdAt,
    phone: "",
    confirmed_at: createdAt,
    last_sign_in_at: createdAt,
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: { full_name: "OAuth Regression" },
    identities: [],
    created_at: createdAt,
    updated_at: createdAt,
    is_anonymous: false,
  };

  return {
    accessToken,
    refreshToken: "synthetic-google-oauth-refresh-token",
    session: {
      access_token: accessToken,
      refresh_token: "synthetic-google-oauth-refresh-token",
      expires_in: 3600,
      expires_at: now + 3600,
      token_type: "bearer",
      user,
    },
    user,
  };
}

test("category atlas styles are already present while the login route is active", async ({
  page,
}) => {
  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await waitForHydration(page);

  const state = await page.evaluate(() => {
    const root = document.createElement("div");
    root.className = "rawaj-categories-v2";
    const hero = document.createElement("section");
    hero.className = "rawaj-categories-v2__hero";
    const card = document.createElement("article");
    card.className = "rawaj-category-directory-card";
    root.append(hero, card);
    document.body.append(root);

    const result = {
      heroBackground: getComputedStyle(hero).backgroundImage,
      heroRadius: Number.parseFloat(getComputedStyle(hero).borderRadius),
      cardRadius: Number.parseFloat(getComputedStyle(card).borderRadius),
      cardBorderStyle: getComputedStyle(card).borderStyle,
    };
    root.remove();
    return result;
  });

  expect(state.heroBackground).toContain("linear-gradient");
  expect(state.heroRadius).toBeGreaterThan(16);
  expect(state.cardRadius).toBeGreaterThan(16);
  expect(state.cardBorderStyle).not.toBe("none");
});

test("mobile chat isolation styles are already present while the login route is active", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only chat layout contract");

  const response = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(500);
  await waitForHydration(page);

  const state = await page.evaluate(() => {
    const workspace = document.createElement("div");
    workspace.className = "rawaj-message-workspace";
    workspace.dataset.view = "list";
    const sidebar = document.createElement("aside");
    sidebar.className = "rawaj-conversation-sidebar";
    const panel = document.createElement("section");
    panel.className = "rawaj-message-panel";
    workspace.append(sidebar, panel);
    document.body.append(workspace);

    const result = {
      sidebar: getComputedStyle(sidebar).display,
      panel: getComputedStyle(panel).display,
      height: workspace.getBoundingClientRect().height,
    };
    workspace.remove();
    return result;
  });

  expect(state.sidebar).not.toBe("none");
  expect(state.panel).toBe("none");
  expect(state.height).toBeLessThan(200);
});

test("Google OAuth implicit hash callback initializes completion state before using the stored session", async ({
  page,
}) => {
  const { accessToken, refreshToken, session, user } = buildSyntheticGoogleOAuthSession();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(
    ({ storedSession }) => {
      window.localStorage.setItem(
        "sb-dpymopdckflnpmowhlyq-auth-token",
        JSON.stringify(storedSession),
      );
    },
    { storedSession: session },
  );

  await page.route("**/auth/v1/user", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
  });

  const hash = new URLSearchParams({
    access_token: accessToken,
    expires_at: String(session.expires_at),
    expires_in: "3600",
    refresh_token: refreshToken,
    token_type: "bearer",
  });
  const response = await page.goto(`/auth/callback?returnTo=%2Fmore#${hash.toString()}`, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status() ?? 200).toBeLessThan(500);

  await expect(page.getByRole("heading", { name: "تم تسجيل الدخول" })).toBeVisible();
  expect(pageErrors.filter((message) => /before initialization/i.test(message))).toEqual([]);
});
