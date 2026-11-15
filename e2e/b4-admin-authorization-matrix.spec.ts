import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Derive the boundary from TanStack's generated inventory, not a hand-maintained list.
const routeTree = readFileSync(new URL("../src/routeTree.gen.ts", import.meta.url), "utf8");
const section = routeTree.match(/interface FileRoutesByFullPath \{([\s\S]*?)\n\}/)?.[1];
if (!section) throw new Error("TanStack FileRoutesByFullPath was not generated.");
const adminRoutes = [
  ...new Set(
    [...section.matchAll(/'((?:\/admin)(?:\/[^']*)?)':/g)]
      .map((match) => match[1])
      .filter((path) => path !== "/admin/"),
  ),
].sort();
if (adminRoutes.length < 16) {
  throw new Error("Unexpected admin route inventory: " + adminRoutes.join(", "));
}

const fixtureOnly = process.env.RAWAJ_E2E_USE_FIXTURES !== "1" || Boolean(process.env.E2E_BASE_URL);
const guestDenial = /^(تسجيل الدخول مطلوب|Login required)$/;
const memberDenial = /^(غير مخوّل|Not authorized)$/;

async function navigateAndDeny(page: Page, path: string, expectedTitle: RegExp) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200, path + " HTTP status").toBeLessThan(500);
  await expect(page.locator("html")).toHaveAttribute("data-rawaj-hydrated", "true");
  expect(new URL(page.url()).pathname.replace(/\/$/, "")).toBe(path);
  await expect(page.locator("main.rawaj-admin-v3 h2")).toHaveText(expectedTitle);
  await expect(page.locator('main a[href^="/admin/"]')).toHaveCount(0);
  await expect(
    page.locator("main button").filter({ hasText: /approve|delete|ban|تعليق|حذف|موافقة/i }),
  ).toHaveCount(0);
}

test.describe("B4 independent admin functional authorization matrix", () => {
  test.skip(
    fixtureOnly,
    "Requires local isolated Firebase/API fixtures. Never run against production.",
  );
  test.setTimeout(240_000);

  for (const language of ["ar", "en"] as const) {
    test(
      "guest cannot open any generated admin route - " + language,
      async ({ page }, testInfo) => {
        await page.addInitScript((value) => {
          window.localStorage.setItem("rawaj-language", value);
          window.localStorage.removeItem("rawaj:e2e:firebase-user");
        }, language);
        const remoteProtectedRequests: string[] = [];
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (
            /^\/(?:v1\/admin|api\/admin)(?:\/|$)/.test(url.pathname) &&
            !["localhost", "127.0.0.1"].includes(url.hostname)
          ) {
            remoteProtectedRequests.push(request.method() + " " + request.url());
          }
        });
        for (const path of adminRoutes)
          await test.step(path, () => navigateAndDeny(page, path, guestDenial));
        expect(remoteProtectedRequests).toEqual([]);
        await testInfo.attach("generated-admin-inventory.json", {
          body: JSON.stringify({ identity: "guest", language, routes: adminRoutes }, null, 2),
          contentType: "application/json",
        });
      },
    );

    test(
      "signed-in non-admin cannot open any generated admin route - " + language,
      async ({ page }, testInfo) => {
        await page.addInitScript((value) => {
          window.localStorage.setItem("rawaj-language", value);
          window.localStorage.setItem("rawaj:e2e:firebase-user", "{}");
        }, language);
        const administrativeRequests: string[] = [];
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (/^\/(?:v1\/admin|api\/admin)(?:\/|$)/.test(url.pathname)) {
            administrativeRequests.push(request.method() + " " + url.pathname);
          }
        });
        for (const path of adminRoutes)
          await test.step(path, () => navigateAndDeny(page, path, memberDenial));
        expect(
          administrativeRequests,
          "A regular member must never request admin API data",
        ).toEqual([]);
        await testInfo.attach("generated-admin-inventory.json", {
          body: JSON.stringify(
            { identity: "fixture-non-admin", language, routes: adminRoutes },
            null,
            2,
          ),
          contentType: "application/json",
        });
      },
    );
  }
});
