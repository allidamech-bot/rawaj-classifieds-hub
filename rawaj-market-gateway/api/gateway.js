// src/gateway.ts
var GATEWAY_HOSTS = {
  customer: "go.rawa-j.com",
  admin: "admin.rawa-j.com"
};
var GATEWAY_ORIGINS = {
  customer: `https://${GATEWAY_HOSTS.customer}`,
  admin: `https://${GATEWAY_HOSTS.admin}`
};
var MARKET_DIRECTORY = {
  SY: {
    id: "SY",
    nameAr: "\u0633\u0648\u0631\u064A\u0627",
    nameEn: "Syria",
    descriptionAr: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u0645\u062F\u0646 \u0648\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0631\u0648\u0627\u062C \u0633\u0648\u0631\u064A\u0627",
    descriptionEn: "Listings, cities, and accounts for RAWAJ Syria",
    customerUrl: "https://rawa-j.com/",
    adminUrl: "https://rawa-j.com/admin"
  },
  SA: {
    id: "SA",
    nameAr: "\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
    nameEn: "Saudi Arabia",
    descriptionAr: "\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u0645\u0646\u0627\u0637\u0642 \u0648\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0631\u0648\u0627\u062C \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629",
    descriptionEn: "Listings, regions, and accounts for RAWAJ Saudi Arabia",
    customerUrl: "https://sa.rawa-j.com/",
    adminUrl: "https://sa.rawa-j.com/admin"
  }
};
var MARKET_IDS = Object.freeze(Object.keys(MARKET_DIRECTORY));
var CUSTOMER_COOKIE = "rawaj.preferredMarket.v1";
var ADMIN_COOKIE = "rawaj.preferredAdminMarket.v1";
var COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
function normalizeMarketId(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized === "SY" || normalized === "SA" ? normalized : null;
}
function normalizeScope(value) {
  return typeof value === "string" && value.trim().toLowerCase() === "admin" ? "admin" : "customer";
}
function preferenceCookieName(scope) {
  return scope === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE;
}
function parseCookiePreference(cookieHeader, scope) {
  const expectedName = preferenceCookieName(scope);
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== expectedName) continue;
    try {
      return normalizeMarketId(decodeURIComponent(part.slice(separator + 1).trim()));
    } catch {
      return null;
    }
  }
  return null;
}
function buildPreferenceCookie(market, scope) {
  return [
    `${preferenceCookieName(scope)}=${market}`,
    "Path=/",
    "Domain=.rawa-j.com",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    "Secure"
  ].join("; ");
}
function marketFromCountry(country) {
  if (typeof country !== "string") return null;
  const normalized = country.trim().toUpperCase();
  if (normalized === "SA") return "SA";
  if (normalized === "SY") return "SY";
  return null;
}
function resolveMarketDecision(input) {
  const explicit = normalizeMarketId(input.explicit);
  if (explicit) return { market: explicit, source: "explicit", mayAutoRedirect: true };
  const stored = normalizeMarketId(input.stored);
  if (stored) return { market: stored, source: "stored", mayAutoRedirect: true };
  const geo = marketFromCountry(input.country);
  if (geo) return { market: geo, source: "geo", mayAutoRedirect: false };
  return {
    market: input.fallback ?? "SA",
    source: "fallback",
    mayAutoRedirect: false
  };
}
function marketDestination(market, scope) {
  const definition = MARKET_DIRECTORY[market];
  return scope === "admin" ? definition.adminUrl : definition.customerUrl;
}
function isAllowedGatewayHost(hostname) {
  const normalized = hostname.trim().toLowerCase();
  const isVercelDeployment = normalized === "rawaj-market-gateway.vercel.app" || normalized.startsWith("rawaj-market-gateway-") && normalized.endsWith(".vercel.app");
  return normalized === GATEWAY_HOSTS.customer || normalized === GATEWAY_HOSTS.admin || isVercelDeployment || normalized === "gateway.local" || normalized === "localhost" || normalized === "127.0.0.1";
}

// src/index.ts
var SERVICE_NAME = "rawaj-market-gateway";
var baseSecurityHeaders = {
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow"
};
function responseHeaders(contentType) {
  const headers = new Headers(baseSecurityHeaders);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Content-Type", contentType);
  headers.set("Vary", "Cookie, CF-IPCountry, X-Vercel-IP-Country");
  return headers;
}
function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: responseHeaders("text/html; charset=utf-8")
  });
}
function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders("application/json; charset=utf-8")
  });
}
function redirectResponse(destination, cookie) {
  const headers = responseHeaders("text/plain; charset=utf-8");
  headers.set("Location", destination);
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response("Redirecting to the selected RAWAJ market.", {
    status: 302,
    headers
  });
}
function headSafe(response, method) {
  if (method !== "HEAD") return response;
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
function requestCountry(request) {
  const cloudflareCountry = request.cf?.country;
  if (typeof cloudflareCountry === "string") return cloudflareCountry;
  const vercelCountry = request.headers.get("x-vercel-ip-country");
  return typeof vercelCountry === "string" ? vercelCountry : null;
}
function scopeFromRequest(url) {
  const hostname = url.hostname.toLowerCase();
  if (hostname === GATEWAY_HOSTS.admin) return "admin";
  if (hostname === GATEWAY_HOSTS.customer) return "customer";
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return "admin";
  return normalizeScope(url.searchParams.get("scope"));
}
function chooserHref(market, scope) {
  return `/go/${market}?scope=${scope}`;
}
function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function renderMarketCard(marketId, scope, decision, storedMarket) {
  const market = MARKET_DIRECTORY[marketId];
  const suggested = decision.market === marketId && decision.source === "geo";
  const remembered = storedMarket === marketId;
  const status = suggested ? `<span class="badge suggestion">\u0645\u0642\u062A\u0631\u062D \u062D\u0633\u0628 \u0645\u0648\u0642\u0639\u0643 \xB7 Suggested</span>` : remembered ? `<span class="badge remembered">\u0627\u062E\u062A\u064A\u0627\u0631\u0643 \u0627\u0644\u0645\u062D\u0641\u0648\u0638 \xB7 Remembered</span>` : "";
  const actionAr = scope === "admin" ? `\u0641\u062A\u062D \u0625\u062F\u0627\u0631\u0629 ${market.nameAr}` : `\u0641\u062A\u062D \u0631\u0648\u0627\u062C ${market.nameAr}`;
  const actionEn = scope === "admin" ? `Open ${market.nameEn} admin` : `Open RAWAJ ${market.nameEn}`;
  return `<article class="market-card market-${market.id.toLowerCase()}" data-market="${market.id}">
    <div class="card-top">
      <span class="country-code" aria-hidden="true">${market.id}</span>
      ${status}
    </div>
    <h2>${escapeHtml(market.nameAr)}</h2>
    <p class="market-name-en" lang="en">${escapeHtml(market.nameEn)}</p>
    <p class="description">${escapeHtml(market.descriptionAr)}</p>
    <p class="description-en" lang="en">${escapeHtml(market.descriptionEn)}</p>
    <a class="market-action" href="${chooserHref(market.id, scope)}">
      <span>${escapeHtml(actionAr)}</span>
      <small lang="en">${escapeHtml(actionEn)}</small>
    </a>
  </article>`;
}
function renderGatewayPage(scope, decision, storedMarket) {
  const isAdmin = scope === "admin";
  const cards = MARKET_IDS.map(
    (market) => renderMarketCard(market, scope, decision, storedMarket)
  ).join("");
  const eyebrow = isAdmin ? "\u0628\u0648\u0627\u0628\u0629 \u0625\u062F\u0627\u0631\u0629 \u0631\u0648\u0627\u062C" : "\u0628\u0648\u0627\u0628\u0629 \u0631\u0648\u0627\u062C";
  const eyebrowEn = isAdmin ? "RAWAJ Admin Gateway" : "RAWAJ Market Gateway";
  const title = isAdmin ? "\u0623\u064A \u0633\u0648\u0642 \u062A\u0631\u064A\u062F \u0625\u062F\u0627\u0631\u062A\u0647\u061F" : "\u0627\u062E\u062A\u0631 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0630\u064A \u062A\u0631\u064A\u062F \u062A\u0635\u0641\u062D\u0647";
  const titleEn = isAdmin ? "Choose the market to manage" : "Choose the market to browse";
  const summary = isAdmin ? "\u062A\u062F\u062E\u0644 \u0645\u0646 \u0628\u0627\u0628 \u0648\u0627\u062D\u062F\u060C \u062B\u0645 \u062A\u0646\u062A\u0642\u0644 \u0625\u0644\u0649 \u0625\u062F\u0627\u0631\u0629 \u0645\u0633\u062A\u0642\u0644\u0629 \u0644\u0627 \u062A\u0639\u0631\u0636 \u0625\u0644\u0627 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u062E\u062A\u0627\u0631." : "\u0627\u062E\u062A\u0631 \u0633\u0648\u0631\u064A\u0627 \u0623\u0648 \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629\u060C \u0648\u0633\u064A\u0639\u0631\u0636 \u0644\u0643 \u0631\u0648\u0627\u062C \u0627\u0644\u0645\u062F\u0646 \u0648\u0627\u0644\u0639\u0645\u0644\u0629 \u0648\u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u062E\u062A\u0627\u0631 \u0641\u0642\u0637.";
  const summaryEn = isAdmin ? "Enter through one door, then continue to an isolated admin workspace for the selected market." : "Choose Syria or Saudi Arabia. RAWAJ will show only that market's locations, currency, listings, and accounts.";
  const privacy = isAdmin ? "\u0643\u0644 \u0642\u0633\u0645 \u0625\u062F\u0627\u0631\u0629 \u064A\u062A\u062D\u0642\u0642 \u0645\u0646 \u062C\u0644\u0633\u062A\u0647 \u0648\u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0647 \u0628\u0634\u0643\u0644 \u0645\u0633\u062A\u0642\u0644. \u0644\u0627 \u062A\u0648\u062C\u062F \u0644\u0648\u062D\u0629 \u062A\u062C\u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u0648\u0642\u064A\u0646." : "\u0646\u062D\u0641\u0638 \u0631\u0645\u0632 \u0627\u0644\u0633\u0648\u0642 \u0641\u0642\u0637. \u0644\u0627 \u0646\u0646\u0642\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0623\u0648 \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0623\u0648 \u0627\u0644\u0645\u0641\u0636\u0644\u0629 \u0628\u064A\u0646 \u0633\u0648\u0631\u064A\u0627 \u0648\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629.";
  const privacyEn = isAdmin ? "Each admin workspace verifies its own session and permissions. No dashboard combines both markets." : "Only the market code is stored. Email, sessions, chats, and favorites never move between markets.";
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#17181d">
  <title>${escapeHtml(eyebrow)} | RAWAJ</title>
  <style>
    :root { color-scheme: dark; font-family: Cairo, "Segoe UI", Tahoma, Arial, sans-serif; background: #17181d; color: #f7f3ee; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; background: radial-gradient(circle at 15% 5%, rgba(108, 75, 201, .16), transparent 34rem), radial-gradient(circle at 90% 12%, rgba(236, 101, 61, .13), transparent 30rem), #17181d; }
    a { color: inherit; }
    .shell { width: min(1120px, calc(100% - 28px)); margin: 0 auto; padding: 24px 0 40px; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 62px; }
    .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    .mark { display: grid; width: 44px; height: 44px; place-items: center; border: 1px solid rgba(255,255,255,.09); border-radius: 15px; background: linear-gradient(145deg, rgba(255,255,255,.09), rgba(255,255,255,.025)); font-size: 24px; font-weight: 900; box-shadow: 0 16px 35px rgba(0,0,0,.22); }
    .brand strong, .brand small { display: block; }
    .brand strong { font-size: 15px; letter-spacing: .02em; }
    .brand small { margin-top: 2px; color: #aaa5b2; font-size: 10px; letter-spacing: .16em; }
    .mode { border: 1px solid rgba(255,255,255,.09); border-radius: 999px; padding: 8px 12px; background: rgba(255,255,255,.035); color: #cbc6d1; font-size: 11px; font-weight: 700; }
    main { overflow: hidden; margin-top: 24px; border: 1px solid rgba(255,255,255,.085); border-radius: 32px; background: rgba(30,31,37,.86); box-shadow: 0 30px 90px rgba(0,0,0,.28); backdrop-filter: blur(18px); }
    .hero { position: relative; isolation: isolate; padding: clamp(30px, 6vw, 68px); border-bottom: 1px solid rgba(255,255,255,.07); }
    .hero::before { position: absolute; inset: 0; z-index: -1; content: ""; background: linear-gradient(115deg, rgba(236,101,61,.075), transparent 38%, rgba(114,80,210,.09)); }
    .eyebrow { display: inline-flex; align-items: center; gap: 8px; border: 1px solid rgba(236,101,61,.22); border-radius: 999px; padding: 7px 11px; background: rgba(236,101,61,.08); color: #ff9f81; font-size: 11px; font-weight: 800; }
    .eyebrow::before { width: 7px; height: 7px; border-radius: 50%; background: #ed653d; content: ""; box-shadow: 0 0 0 5px rgba(237,101,61,.1); }
    h1 { max-width: 760px; margin: 20px 0 0; font-size: clamp(30px, 5vw, 56px); line-height: 1.22; letter-spacing: -.035em; }
    .title-en { margin: 8px 0 0; color: #a9a3b0; font-size: clamp(14px, 2vw, 19px); font-weight: 600; direction: ltr; text-align: right; }
    .summary { max-width: 780px; margin: 22px 0 0; color: #d2ccd6; font-size: 14px; line-height: 2; }
    .summary-en { max-width: 780px; margin: 4px 0 0; color: #8f8998; font-size: 11px; line-height: 1.8; direction: ltr; text-align: right; }
    .markets { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; padding: clamp(18px, 4vw, 40px); }
    .market-card { position: relative; overflow: hidden; min-width: 0; border: 1px solid rgba(255,255,255,.085); border-radius: 24px; padding: clamp(20px, 4vw, 30px); background: rgba(255,255,255,.028); transition: transform .2s ease, border-color .2s ease, background .2s ease; }
    .market-card::after { position: absolute; inset: auto -50px -70px auto; width: 190px; height: 190px; border-radius: 50%; content: ""; opacity: .13; filter: blur(6px); pointer-events: none; }
    .market-sy::after { background: #7a55cf; }
    .market-sa::after { background: #2f9c71; }
    .market-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,.17); background: rgba(255,255,255,.045); }
    .card-top { display: flex; min-height: 43px; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .country-code { display: grid; width: 43px; height: 43px; place-items: center; border: 1px solid rgba(255,255,255,.1); border-radius: 15px; background: rgba(255,255,255,.055); color: #fff; font-size: 12px; font-weight: 900; letter-spacing: .08em; }
    .badge { display: inline-flex; max-width: 74%; align-items: center; border-radius: 999px; padding: 6px 9px; font-size: 9px; font-weight: 800; line-height: 1.4; }
    .suggestion { background: rgba(47,156,113,.13); color: #79dfb4; }
    .remembered { background: rgba(122,85,207,.14); color: #b9a1ef; }
    h2 { margin: 22px 0 0; font-size: 26px; line-height: 1.3; }
    .market-name-en { margin: 2px 0 0; color: #9f99a7; font-size: 12px; font-weight: 700; direction: ltr; text-align: right; }
    .description { min-height: 28px; margin: 18px 0 0; color: #d2ccd6; font-size: 12px; line-height: 1.8; }
    .description-en { min-height: 34px; margin: 2px 0 0; color: #85808d; font-size: 10px; line-height: 1.7; direction: ltr; text-align: right; }
    .market-action { position: relative; z-index: 1; display: flex; min-height: 54px; align-items: center; justify-content: space-between; gap: 12px; margin-top: 22px; border-radius: 16px; padding: 10px 16px; background: #f4efe9; color: #1d1d22; text-decoration: none; transition: transform .16s ease, background .16s ease; }
    .market-action:hover { transform: translateY(-1px); background: #fff; }
    .market-action span { font-size: 12px; font-weight: 900; }
    .market-action small { color: #66616b; font-size: 9px; font-weight: 700; direction: ltr; }
    .privacy { display: flex; align-items: flex-start; gap: 12px; border-top: 1px solid rgba(255,255,255,.065); padding: 18px clamp(20px, 4vw, 40px); background: rgba(0,0,0,.13); }
    .privacy-icon { display: grid; width: 28px; height: 28px; flex: 0 0 auto; place-items: center; border-radius: 10px; background: rgba(255,255,255,.055); color: #ff9f81; font-size: 13px; }
    .privacy p { margin: 0; color: #a9a3af; font-size: 10px; line-height: 1.9; }
    .privacy p span { display: block; color: #77727f; font-size: 9px; direction: ltr; text-align: right; }
    footer { padding: 22px 4px 0; color: #77727f; text-align: center; font-size: 9px; line-height: 1.8; }
    @media (max-width: 700px) { .shell { width: min(100% - 18px, 1120px); padding-top: 10px; } header { padding: 0 4px; } .mode { max-width: 44%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } main { margin-top: 10px; border-radius: 24px; } .hero { padding: 28px 20px 30px; } .markets { grid-template-columns: 1fr; padding: 12px; } .market-card { border-radius: 20px; padding: 20px; } .description, .description-en { min-height: auto; } .privacy { padding: 16px; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; } }
    :focus-visible { outline: 3px solid #ff9f81; outline-offset: 3px; }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <a class="brand" href="/" aria-label="\u0631\u0648\u0627\u062C \u2014 \u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0623\u0633\u0648\u0627\u0642">
        <span class="mark" aria-hidden="true">\u0631</span>
        <span><strong>\u0631\u0648\u0627\u062C</strong><small lang="en">RAWAJ</small></span>
      </a>
      <span class="mode">${escapeHtml(eyebrow)} \xB7 <span lang="en">${escapeHtml(eyebrowEn)}</span></span>
    </header>
    <main>
      <section class="hero">
        <span class="eyebrow">${escapeHtml(eyebrow)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p class="title-en" lang="en">${escapeHtml(titleEn)}</p>
        <p class="summary">${escapeHtml(summary)}</p>
        <p class="summary-en" lang="en">${escapeHtml(summaryEn)}</p>
      </section>
      <section class="markets" aria-label="\u0627\u062E\u062A\u064A\u0627\u0631 \u0633\u0648\u0642 \u0631\u0648\u0627\u062C">${cards}</section>
      <section class="privacy">
        <span class="privacy-icon" aria-hidden="true">\u2301</span>
        <p>${escapeHtml(privacy)}<span lang="en">${escapeHtml(privacyEn)}</span></p>
      </section>
    </main>
    <footer>\u0631\u0648\u0627\u062C \u0633\u0648\u0631\u064A\u0627 \u0648\u0631\u0648\u0627\u062C \u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629 \u0646\u0638\u0627\u0645\u0627\u0646 \u0645\u0633\u062A\u0642\u0644\u0627\u0646 \u062E\u0644\u0641 \u0628\u0648\u0627\u0628\u0629 \u0627\u062E\u062A\u064A\u0627\u0631 \u0648\u0627\u062D\u062F\u0629.<br><span lang="en">RAWAJ Syria and RAWAJ Saudi Arabia remain isolated systems behind one choice gateway.</span></footer>
  </div>
</body>
</html>`;
}
function handleGateway(request) {
  const url = new URL(request.url);
  const scope = scopeFromRequest(url);
  const storedMarket = parseCookiePreference(request.headers.get("Cookie") ?? "", scope);
  const decision = resolveMarketDecision({
    explicit: url.searchParams.get("market"),
    stored: storedMarket,
    country: requestCountry(request)
  });
  if (url.pathname === "/resolve" && decision.mayAutoRedirect) {
    const cookie = decision.source === "explicit" ? buildPreferenceCookie(decision.market, scope) : void 0;
    return redirectResponse(marketDestination(decision.market, scope), cookie);
  }
  return htmlResponse(renderGatewayPage(scope, decision, storedMarket));
}
function handleMarketChoice(url) {
  const market = normalizeMarketId(url.pathname.split("/").filter(Boolean)[1]);
  if (!market) return jsonResponse({ error: "Unknown market" }, 404);
  const scope = scopeFromRequest(url);
  return redirectResponse(marketDestination(market, scope), buildPreferenceCookie(market, scope));
}
function routeRequest(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") {
    const response = jsonResponse({ error: "Method not allowed" }, 405);
    response.headers.set("Allow", "GET, HEAD");
    return response;
  }
  if (!isAllowedGatewayHost(url.hostname)) {
    return jsonResponse({ error: "Misdirected request" }, 421);
  }
  if (url.hostname.toLowerCase() === GATEWAY_HOSTS.customer && (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
    return redirectResponse(`${GATEWAY_ORIGINS.admin}/`);
  }
  if (url.pathname === "/health") {
    return jsonResponse({
      ok: true,
      service: SERVICE_NAME,
      markets: MARKET_IDS
    });
  }
  if (url.pathname.startsWith("/go/")) return handleMarketChoice(url);
  if (url.pathname === "/" || url.pathname === "/admin" || url.pathname === "/resolve") {
    return handleGateway(request);
  }
  return jsonResponse({ error: "Not found" }, 404);
}
var index_default = {
  async fetch(request) {
    try {
      return headSafe(routeRequest(request), request.method);
    } catch (error) {
      const url = new URL(request.url);
      console.error(
        JSON.stringify({
          message: "gateway_request_failed",
          method: request.method,
          path: url.pathname,
          error: error instanceof Error ? error.message : "Unknown error"
        })
      );
      return headSafe(jsonResponse({ error: "Internal server error" }, 500), request.method);
    }
  }
};

// src/vercel-handler.ts
var INTERNAL_PATH_PARAMETER = "__rawaj_path";
function restorePublicUrl(request) {
  const url = new URL(request.url);
  const publicPath = url.searchParams.get(INTERNAL_PATH_PARAMETER);
  if (publicPath) {
    url.pathname = publicPath.startsWith("/") ? publicPath : `/${publicPath}`;
  }
  url.searchParams.delete(INTERNAL_PATH_PARAMETER);
  return new Request(url, request);
}
function handleWebRequest(request) {
  return index_default.fetch(restorePublicUrl(request));
}
function requestOrigin(request) {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "https";
  return `${protocol}://${request.headers.host || "rawaj-market-gateway.vercel.app"}`;
}
function requestHeaders(request) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== void 0) {
      headers.set(name, value);
    }
  }
  return headers;
}
async function handler(request, response) {
  const method = request.method || "GET";
  const webRequest = new Request(new URL(request.url || "/", requestOrigin(request)), {
    method,
    headers: requestHeaders(request)
  });
  const webResponse = await handleWebRequest(webRequest);
  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  if (method === "HEAD" || webResponse.body === null) {
    response.end();
    return;
  }
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}
export {
  handler as default,
  handleWebRequest
};
