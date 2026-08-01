import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import vercelFunction from "../api/gateway.ts";
import worker from "../src/index.ts";
import {
  GATEWAY_HOSTS,
  GATEWAY_ORIGINS,
  MARKET_DIRECTORY,
  buildPreferenceCookie,
  isAllowedGatewayHost,
  marketDestination,
  marketFromCountry,
  normalizeMarketId,
  parseCookiePreference,
  preferenceCookieName,
  resolveMarketDecision,
} from "../src/gateway.ts";

const projectRoot = new URL("../", import.meta.url);

test("production gateway hosts are explicit and narrowly allowed", () => {
  assert.deepEqual(GATEWAY_HOSTS, {
    customer: "go.rawa-j.com",
    admin: "admin.rawa-j.com",
  });
  assert.deepEqual(GATEWAY_ORIGINS, {
    customer: "https://go.rawa-j.com",
    admin: "https://admin.rawa-j.com",
  });
  assert.equal(isAllowedGatewayHost("GO.RAWA-J.COM"), true);
  assert.equal(isAllowedGatewayHost("rawaj-market-gateway.vercel.app"), true);
  assert.equal(isAllowedGatewayHost("rawaj-market-gateway-a1b2c3-owner.vercel.app"), true);
  assert.equal(isAllowedGatewayHost("gateway.local"), true);
  assert.equal(isAllowedGatewayHost("evil.example"), false);
  assert.equal(isAllowedGatewayHost("another-project.vercel.app"), false);
});

function requestWithCountry(url, country, init) {
  const request = new Request(url, init);
  Object.defineProperty(request, "cf", {
    configurable: true,
    value: country ? { country } : undefined,
  });
  return request;
}

test("decision order honors explicit and stored choices before geography", () => {
  assert.deepEqual(resolveMarketDecision({ explicit: "SY", stored: "SA", country: "SA" }), {
    market: "SY",
    source: "explicit",
    mayAutoRedirect: true,
  });
  assert.deepEqual(resolveMarketDecision({ stored: "SA", country: "SY" }), {
    market: "SA",
    source: "stored",
    mayAutoRedirect: true,
  });
  assert.deepEqual(resolveMarketDecision({ country: "SY" }), {
    market: "SY",
    source: "geo",
    mayAutoRedirect: false,
  });
  assert.deepEqual(resolveMarketDecision({ country: "TR" }), {
    market: "SA",
    source: "fallback",
    mayAutoRedirect: false,
  });
  assert.equal(normalizeMarketId(" sa "), "SA");
  assert.equal(normalizeMarketId("TR"), null);
  assert.equal(marketFromCountry("SA"), "SA");
});

test("customer and admin cookies are separate and contain market codes only", () => {
  assert.notEqual(preferenceCookieName("customer"), preferenceCookieName("admin"));
  const customerCookie = buildPreferenceCookie("SA", "customer");
  const adminCookie = buildPreferenceCookie("SY", "admin");

  for (const cookie of [customerCookie, adminCookie]) {
    assert.match(cookie, /Domain=\.rawa-j\.com/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Secure/);
    assert.doesNotMatch(cookie, /email|token|session|user/i);
  }

  const cookieHeader = `${preferenceCookieName("customer")}=SA; ${preferenceCookieName("admin")}=SY`;
  assert.equal(parseCookiePreference(cookieHeader, "customer"), "SA");
  assert.equal(parseCookiePreference(cookieHeader, "admin"), "SY");
  assert.equal(
    parseCookiePreference(`${preferenceCookieName("customer")}=bad%ZZ`, "customer"),
    null,
  );
});

test("all redirect destinations are fixed RAWAJ allowlist entries", () => {
  assert.deepEqual(Object.keys(MARKET_DIRECTORY), ["SY", "SA"]);
  assert.equal(marketDestination("SY", "customer"), "https://rawa-j.com/");
  assert.equal(marketDestination("SA", "customer"), "https://sa.rawa-j.com/");
  assert.equal(marketDestination("SY", "admin"), "https://rawa-j.com/admin");
  assert.equal(marketDestination("SA", "admin"), "https://sa.rawa-j.com/admin");
});

test("geography suggests a customer market without forcing a redirect", async () => {
  const response = await worker.fetch(requestWithCountry("https://gateway.local/", "SA"));
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /اختر السوق الذي تريد تصفحه/);
  assert.match(html, /data-market="SY"/);
  assert.match(html, /data-market="SA"/);
  assert.match(html, /مقترح حسب موقعك/);
  assert.match(html, /لا ننقل البريد أو الجلسة/);
});

test("Vercel country header remains a non-binding suggestion", async () => {
  const response = await worker.fetch(
    new Request("https://rawaj-market-gateway.vercel.app/", {
      headers: { "x-vercel-ip-country": "SY" },
    }),
  );
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /مقترح حسب موقعك/);
  assert.equal(response.headers.get("Location"), null);
  assert.match(response.headers.get("Vary") ?? "", /X-Vercel-IP-Country/);
});

test("admin hostname renders one door with two isolated admin destinations", async () => {
  const response = await worker.fetch(new Request("https://admin.rawa-j.com/"));
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /أي سوق تريد إدارته؟/);
  assert.match(html, /كل قسم إدارة يتحقق من جلسته وصلاحياته بشكل مستقل/);
  assert.match(html, /\/go\/SY\?scope=admin/);
  assert.match(html, /\/go\/SA\?scope=admin/);
  assert.doesNotMatch(html, /جدول مشترك|بحث مشترك|جميع البيانات/);
});

test("production hostname controls scope and cannot be overridden by query parameters", async () => {
  const customer = await worker.fetch(new Request("https://go.rawa-j.com/?scope=admin"));
  assert.match(await customer.text(), /اختر السوق الذي تريد تصفحه/);

  const admin = await worker.fetch(new Request("https://admin.rawa-j.com/?scope=customer"));
  assert.match(await admin.text(), /أي سوق تريد إدارته؟/);

  const customerChoice = await worker.fetch(new Request("https://go.rawa-j.com/go/SA?scope=admin"));
  assert.equal(customerChoice.headers.get("Location"), "https://sa.rawa-j.com/");

  const adminHandoff = await worker.fetch(new Request("https://go.rawa-j.com/admin"));
  assert.equal(adminHandoff.status, 302);
  assert.equal(adminHandoff.headers.get("Location"), GATEWAY_ORIGINS.admin + "/");
});

test("explicit and remembered choices redirect while setting only the scoped preference", async () => {
  const explicit = await worker.fetch(
    new Request("https://gateway.local/resolve?market=SY&scope=customer"),
  );
  assert.equal(explicit.status, 302);
  assert.equal(explicit.headers.get("Location"), "https://rawa-j.com/");
  assert.match(explicit.headers.get("Set-Cookie") ?? "", /preferredMarket/);
  assert.doesNotMatch(explicit.headers.get("Set-Cookie") ?? "", /preferredAdminMarket/);

  const remembered = await worker.fetch(
    new Request("https://gateway.local/resolve?scope=admin", {
      headers: { Cookie: `${preferenceCookieName("admin")}=SA` },
    }),
  );
  assert.equal(remembered.status, 302);
  assert.equal(remembered.headers.get("Location"), "https://sa.rawa-j.com/admin");
  assert.equal(remembered.headers.get("Set-Cookie"), null);
});

test("market choice endpoints reject open redirects and set safe response headers", async () => {
  const selected = await worker.fetch(
    new Request("https://gateway.local/go/SA?scope=customer&next=https://evil.example"),
  );
  assert.equal(selected.status, 302);
  assert.equal(selected.headers.get("Location"), "https://sa.rawa-j.com/");
  assert.match(selected.headers.get("Content-Security-Policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(selected.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.equal(selected.headers.get("X-Content-Type-Options"), "nosniff");

  const unknown = await worker.fetch(new Request("https://gateway.local/go/TR"));
  assert.equal(unknown.status, 404);
  const missing = await worker.fetch(new Request("https://gateway.local/unknown"));
  assert.equal(missing.status, 404);
  const disallowedMethod = await worker.fetch(
    new Request("https://gateway.local/", { method: "POST" }),
  );
  assert.equal(disallowedMethod.status, 405);
  assert.equal(disallowedMethod.headers.get("Allow"), "GET, HEAD");

  const unrecognizedHost = await worker.fetch(new Request("https://evil.example/"));
  assert.equal(unrecognizedHost.status, 421);
});

test("health and HEAD requests remain bounded and body-free", async () => {
  const health = await worker.fetch(new Request("https://gateway.local/health"));
  assert.deepEqual(await health.json(), {
    ok: true,
    service: "rawaj-market-gateway",
    markets: ["SY", "SA"],
  });

  const head = await worker.fetch(new Request("https://gateway.local/", { method: "HEAD" }));
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
});

test("Vercel adapter restores public routes before invoking the isolated gateway", async () => {
  const selected = await vercelFunction.fetch(
    new Request(
      "https://rawaj-market-gateway.vercel.app/api/gateway?__rawaj_path=/go/SA&scope=customer",
    ),
  );

  assert.equal(selected.status, 302);
  assert.equal(selected.headers.get("Location"), "https://sa.rawa-j.com/");
  assert.match(selected.headers.get("Set-Cookie") ?? "", /preferredMarket/);
});

test("release readiness records verified production evidence and outstanding admin blockers", async () => {
  const [readinessJson, packageJson, vercelConfigJson, wranglerConfig] = await Promise.all([
    readFile(new URL("config/launch-readiness.json", projectRoot), "utf8"),
    readFile(new URL("package.json", projectRoot), "utf8"),
    readFile(new URL("vercel.json", projectRoot), "utf8"),
    readFile(new URL("wrangler.jsonc", projectRoot), "utf8"),
  ]);
  const readiness = JSON.parse(readinessJson);
  const packageConfig = JSON.parse(packageJson);
  const vercelConfig = JSON.parse(vercelConfigJson);

  assert.equal(readiness.customer_gateway_host_approved, true);
  assert.equal(readiness.admin_gateway_host_approved, true);
  for (const key of [
    "vercel_gateway_project_created",
    "customer_vercel_domain_created",
    "syrian_destination_verified",
    "saudi_destination_verified",
  ]) {
    assert.equal(readiness[key], true, `${key} must reflect verified evidence`);
  }
  for (const key of ["admin_vercel_domain_created", "admin_destination_auth_verified"]) {
    assert.equal(readiness[key], false, `${key} must remain blocked`);
  }
  assert.equal(readiness.production_launch_approved, true);

  assert.equal(packageConfig.scripts.deploy, undefined);
  assert.equal(packageConfig.scripts["release:gate"], "node scripts/release-gate.mjs");
  assert.deepEqual(
    vercelConfig.rewrites.map(({ source }) => source),
    ["/", "/admin", "/resolve", "/go/:market", "/health"],
  );
  assert.doesNotMatch(wranglerConfig, /"routes?"\s*:/);
});
