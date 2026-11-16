import { expect, test } from "@playwright/test";

// Local E2E fixture only; this suite never signs into production.
for (const language of ["ar", "en"] as const) {
  test(`B1 home signed-in store label stays legible in ${language}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((locale) => {
      localStorage.setItem("rawaj-language", locale);
      localStorage.setItem(
        "rawaj:e2e:firebase-user",
        JSON.stringify({ email: "browser-smoke@rawa-j.test" }),
      );
    }, language);

    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status() ?? 200).toBe(200);
    await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
    const store = page.locator(".rawaj-app-header .rawaj-header-store");
    await expect(store).toBeVisible();
    const label = store.locator(".rawaj-header-store__label");
    await expect(label).toHaveText(language === "ar" ? "متجري" : "My store");
    const metrics = await label.evaluate((node) => {
      const text = node.getBoundingClientRect();
      const hitTarget = node.parentElement!.getBoundingClientRect();
      return {
        fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
        clipped:
          text.left < hitTarget.left - 1 ||
          text.right > hitTarget.right + 1 ||
          text.top < hitTarget.top - 1 ||
          text.bottom > hitTarget.bottom + 1,
        hitHeight: hitTarget.height,
        generatedLabel: getComputedStyle(node.parentElement!, "::after").content,
      };
    });
    expect(metrics.fontSize).toBeGreaterThanOrEqual(11);
    expect(metrics.clipped).toBe(false);
    expect(metrics.hitHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.generatedLabel).toBe("none");

    const hero = page.locator(".rawaj-signature-hero");
    const search = page.locator(".rawaj-signature-search");
    await expect(hero).toBeVisible();
    await expect(search).toBeVisible();
    const geometry = await page.evaluate(() => {
      const header = document.querySelector(".rawaj-app-header")!.getBoundingClientRect();
      const heading = document
        .querySelector(".rawaj-signature-hero__tagline")!
        .getBoundingClientRect();
      const form = document.querySelector(".rawaj-signature-search")!.getBoundingClientRect();
      const button = document
        .querySelector(".rawaj-signature-search button")!
        .getBoundingClientRect();
      return {
        headlineClear: heading.top >= header.bottom - 2,
        formWithinViewport: form.left >= -2 && form.right <= innerWidth + 2,
        buttonHeight: button.height,
        inputFontSize: Number.parseFloat(
          getComputedStyle(document.querySelector("#rawaj-signature-search-input")!).fontSize,
        ),
      };
    });
    expect(geometry.headlineClear).toBe(true);
    expect(geometry.formWithinViewport).toBe(true);
    expect(geometry.buttonHeight).toBeGreaterThanOrEqual(44);
    expect(geometry.inputFontSize).toBeGreaterThanOrEqual(16);
    await page.screenshot({
      path: testInfo.outputPath(`b1-home-header-${language}-390.png`),
      animations: "disabled",
    });
  });
}

test("B1 narrow guest home search stays usable at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('html[data-rawaj-hydrated="true"]')).toHaveCount(1);
  const input = page.locator("#rawaj-signature-search-input");
  await expect(input).toBeVisible();
  await input.fill("سيارة");
  await expect(input).toHaveValue("سيارة");
  const widths = await page.evaluate(() => ({
    window: innerWidth,
    document: document.documentElement.scrollWidth,
    search: document.querySelector(".rawaj-signature-search")!.getBoundingClientRect().width,
  }));
  expect(widths.document).toBeLessThanOrEqual(widths.window + 2);
  expect(widths.search).toBeGreaterThan(200);
});

for (const language of ["ar", "en"] as const) {
  test(`B1 guest header keeps the logo, wordmark and login legible in ${language}`, async ({
    page,
  }) => {
    await page.addInitScript((locale) => localStorage.setItem("rawaj-language", locale), language);

    for (const path of ["/", "/more"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");

      const header = page.locator(".rawaj-app-header");
      await expect(header).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(header).toHaveCSS("background-image", "none");
      await expect(header).toHaveCSS("border-bottom-width", "0px");
      const brand = header.locator(".rawaj-brand-lockup__wordmark");
      await expect(brand).toHaveText("رواج | Rawaj");
      await expect(brand).toHaveCSS("flex-direction", "row");
      await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
        "content",
        "رواج | Rawaj",
      );
      const loginLabel = language === "ar" ? "تسجيل الدخول" : "Log in";
      const login = header.getByRole("link", { name: loginLabel });
      const label = login.locator(".rawaj-header-login-cta__label");
      await expect(login).toHaveCSS("background-color", "rgb(255, 247, 231)");
      await expect(label).toHaveCSS("color", "rgb(16, 63, 66)");

      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(label).toBeVisible();
        const metrics = await header.evaluate((node) => {
          const mark = node.querySelector(".rawaj-brand-mark img")!.getBoundingClientRect();
          const name = node.querySelector(".rawaj-brand-lockup__name")!.getBoundingClientRect();
          const action = node.querySelector(".rawaj-header-login-cta")!.getBoundingClientRect();
          return {
            markWidth: mark.width,
            nameOnLeft: name.right <= mark.left + 1,
            hitHeight: action.height,
            fits: [mark, name, action].every((rect) => rect.left >= 0 && rect.right <= innerWidth),
            clear: action.right <= name.left || action.left >= mark.right,
          };
        });
        expect(metrics.markWidth).toBeGreaterThanOrEqual(44);
        expect(metrics.nameOnLeft).toBe(true);
        expect(metrics.hitHeight).toBeGreaterThanOrEqual(44);
        expect(metrics.fits).toBe(true);
        expect(metrics.clear).toBe(true);
      }
    }
  });

  test(`B1 signed-in account distinguishes logout in ${language}`, async ({ page }) => {
    test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Requires local Firebase fixtures");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((locale) => {
      localStorage.setItem("rawaj-language", locale);
      localStorage.setItem("rawaj:e2e:firebase-user", "{}");
    }, language);

    for (const path of ["/more", "/profile"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const logout = page.getByRole("button", {
        name: language === "ar" ? /تسجيل الخروج/ : /Log out/,
      });
      await expect(logout).toBeVisible();
      await expect(logout).toHaveCSS("background-color", "rgb(255, 241, 241)");
      const title = path === "/more" ? logout.locator(".text-destructive").last() : logout;
      await expect(title).toHaveCSS("color", "rgb(163, 38, 53)");
    }
  });
}

test("B1 compact mobile account fits a signed-in header and its shortcuts", async ({ page }) => {
  test.skip(process.env.RAWAJ_E2E_USE_FIXTURES !== "1", "Requires local Firebase fixtures");
  await page.addInitScript(() => localStorage.setItem("rawaj:e2e:firebase-user", "{}"));
  await page.goto("/more", { waitUntil: "domcontentloaded" });
  const header = page.locator(".rawaj-app-header");
  const store = header.locator(".rawaj-header-store");
  const hero = page.locator('.rawaj-trust-hero[data-mode="more"]');
  await expect(store).toBeVisible();
  await expect(hero).toBeVisible();

  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => {
      const card = document.querySelector(".rawaj-trust-hero")!;
      const hero = card.getBoundingClientRect();
      const cardStyle = getComputedStyle(card);
      const brand = document.querySelector(".rawaj-shell-header__brand")!.getBoundingClientRect();
      const actions = document
        .querySelector(".rawaj-shell-header__actions")!
        .getBoundingClientRect();
      return {
        accountHeight: hero.height,
        accountLayout: {
          display: cardStyle.display,
          padding: cardStyle.padding,
          gap: cardStyle.gap,
          children: Array.from(card.children, (child) => child.getBoundingClientRect().height),
        },
        documentWidth: document.documentElement.scrollWidth,
        actionsInViewport: actions.left >= 0 && actions.right <= innerWidth,
        headerOverlap:
          brand.left < actions.right &&
          brand.right > actions.left &&
          brand.top < actions.bottom &&
          brand.bottom > actions.top,
      };
    });
    const accountLayout = JSON.stringify(layout.accountLayout);
    expect(layout.accountHeight, accountLayout).toBeLessThanOrEqual(155);
    expect(layout.documentWidth).toBeLessThanOrEqual(width + 1);
    expect(layout.actionsInViewport).toBe(true);
    expect(layout.headerOverlap).toBe(false);
  }
});
