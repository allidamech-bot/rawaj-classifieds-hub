import {
  GATEWAY_HOSTS,
  GATEWAY_ORIGINS,
  MARKET_DIRECTORY,
  MARKET_IDS,
  buildPreferenceCookie,
  isAllowedGatewayHost,
  marketDestination,
  normalizeMarketId,
  normalizeScope,
  parseCookiePreference,
  resolveMarketDecision,
  type GatewayScope,
  type MarketDecision,
  type MarketId,
} from "./gateway.ts";

const SERVICE_NAME = "rawaj-market-gateway";

const baseSecurityHeaders = {
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

function responseHeaders(contentType: string): Headers {
  const headers = new Headers(baseSecurityHeaders);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Content-Type", contentType);
  headers.set("Vary", "Cookie, CF-IPCountry, X-Vercel-IP-Country");
  return headers;
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: responseHeaders("text/html; charset=utf-8"),
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders("application/json; charset=utf-8"),
  });
}

function redirectResponse(destination: string, cookie?: string): Response {
  const headers = responseHeaders("text/plain; charset=utf-8");
  headers.set("Location", destination);
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response("Redirecting to the selected RAWAJ market.", {
    status: 302,
    headers,
  });
}

function headSafe(response: Response, method: string): Response {
  if (method !== "HEAD") return response;
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function requestCountry(request: Request): string | null {
  const cloudflareCountry = request.cf?.country;
  if (typeof cloudflareCountry === "string") return cloudflareCountry;

  const vercelCountry = request.headers.get("x-vercel-ip-country");
  return typeof vercelCountry === "string" ? vercelCountry : null;
}

function scopeFromRequest(url: URL): GatewayScope {
  const hostname = url.hostname.toLowerCase();
  if (hostname === GATEWAY_HOSTS.admin) return "admin";
  if (hostname === GATEWAY_HOSTS.customer) return "customer";
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
    return "admin";
  return normalizeScope(url.searchParams.get("scope"));
}

function chooserHref(market: MarketId, scope: GatewayScope): string {
  return `/go/${market}?scope=${scope}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMarketCard(
  marketId: MarketId,
  scope: GatewayScope,
  decision: MarketDecision,
  storedMarket: MarketId | null,
): string {
  const market = MARKET_DIRECTORY[marketId];
  const suggested = decision.market === marketId && decision.source === "geo";
  const remembered = storedMarket === marketId;
  const status = suggested
    ? `<span class="badge suggestion">مقترح حسب موقعك · Suggested</span>`
    : remembered
      ? `<span class="badge remembered">اختيارك المحفوظ · Remembered</span>`
      : "";
  const actionAr =
    scope === "admin"
      ? `فتح إدارة ${market.nameAr}`
      : `فتح رواج ${market.nameAr}`;
  const actionEn =
    scope === "admin"
      ? `Open ${market.nameEn} admin`
      : `Open RAWAJ ${market.nameEn}`;

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

function renderGatewayPage(
  scope: GatewayScope,
  decision: MarketDecision,
  storedMarket: MarketId | null,
): string {
  const isAdmin = scope === "admin";
  const cards = MARKET_IDS.map((market) =>
    renderMarketCard(market, scope, decision, storedMarket),
  ).join("");
  const eyebrow = isAdmin ? "بوابة إدارة رواج" : "بوابة رواج";
  const eyebrowEn = isAdmin ? "RAWAJ Admin Gateway" : "RAWAJ Market Gateway";
  const title = isAdmin ? "أي سوق تريد إدارته؟" : "اختر السوق الذي تريد تصفحه";
  const titleEn = isAdmin
    ? "Choose the market to manage"
    : "Choose the market to browse";
  const summary = isAdmin
    ? "تدخل من باب واحد، ثم تنتقل إلى إدارة مستقلة لا تعرض إلا بيانات السوق المختار."
    : "اختر سوريا أو السعودية، وسيعرض لك رواج المدن والعملة والإعلانات والحسابات الخاصة بالسوق المختار فقط.";
  const summaryEn = isAdmin
    ? "Enter through one door, then continue to an isolated admin workspace for the selected market."
    : "Choose Syria or Saudi Arabia. RAWAJ will show only that market's locations, currency, listings, and accounts.";
  const privacy = isAdmin
    ? "كل قسم إدارة يتحقق من جلسته وصلاحياته بشكل مستقل. لا توجد لوحة تجمع بيانات السوقين."
    : "نحفظ رمز السوق فقط. لا ننقل البريد أو الجلسة أو المحادثات أو المفضلة بين سوريا والسعودية.";
  const privacyEn = isAdmin
    ? "Each admin workspace verifies its own session and permissions. No dashboard combines both markets."
    : "Only the market code is stored. Email, sessions, chats, and favorites never move between markets.";

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
      <a class="brand" href="/" aria-label="رواج — بوابة الأسواق">
        <span class="mark" aria-hidden="true">ر</span>
        <span><strong>رواج</strong><small lang="en">RAWAJ</small></span>
      </a>
      <span class="mode">${escapeHtml(eyebrow)} · <span lang="en">${escapeHtml(eyebrowEn)}</span></span>
    </header>
    <main>
      <section class="hero">
        <span class="eyebrow">${escapeHtml(eyebrow)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p class="title-en" lang="en">${escapeHtml(titleEn)}</p>
        <p class="summary">${escapeHtml(summary)}</p>
        <p class="summary-en" lang="en">${escapeHtml(summaryEn)}</p>
      </section>
      <section class="markets" aria-label="اختيار سوق رواج">${cards}</section>
      <section class="privacy">
        <span class="privacy-icon" aria-hidden="true">⌁</span>
        <p>${escapeHtml(privacy)}<span lang="en">${escapeHtml(privacyEn)}</span></p>
      </section>
    </main>
    <footer>رواج سوريا ورواج السعودية نظامان مستقلان خلف بوابة اختيار واحدة.<br><span lang="en">RAWAJ Syria and RAWAJ Saudi Arabia remain isolated systems behind one choice gateway.</span></footer>
  </div>
</body>
</html>`;
}

function handleGateway(request: Request): Response {
  const url = new URL(request.url);
  const scope = scopeFromRequest(url);
  const storedMarket = parseCookiePreference(
    request.headers.get("Cookie") ?? "",
    scope,
  );
  const decision = resolveMarketDecision({
    explicit: url.searchParams.get("market"),
    stored: storedMarket,
    country: requestCountry(request),
  });

  if (url.pathname === "/resolve" && decision.mayAutoRedirect) {
    const cookie =
      decision.source === "explicit"
        ? buildPreferenceCookie(decision.market, scope)
        : undefined;
    return redirectResponse(marketDestination(decision.market, scope), cookie);
  }

  return htmlResponse(renderGatewayPage(scope, decision, storedMarket));
}

function handleMarketChoice(url: URL): Response {
  const market = normalizeMarketId(url.pathname.split("/").filter(Boolean)[1]);
  if (!market) return jsonResponse({ error: "Unknown market" }, 404);
  const scope = scopeFromRequest(url);
  return redirectResponse(
    marketDestination(market, scope),
    buildPreferenceCookie(market, scope),
  );
}

function routeRequest(request: Request): Response {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") {
    const response = jsonResponse({ error: "Method not allowed" }, 405);
    response.headers.set("Allow", "GET, HEAD");
    return response;
  }

  if (!isAllowedGatewayHost(url.hostname)) {
    return jsonResponse({ error: "Misdirected request" }, 421);
  }

  if (
    url.hostname.toLowerCase() === GATEWAY_HOSTS.customer &&
    (url.pathname === "/admin" || url.pathname.startsWith("/admin/"))
  ) {
    return redirectResponse(`${GATEWAY_ORIGINS.admin}/`);
  }

  if (url.pathname === "/health") {
    return jsonResponse({
      ok: true,
      service: SERVICE_NAME,
      markets: MARKET_IDS,
    });
  }
  if (url.pathname.startsWith("/go/")) return handleMarketChoice(url);
  if (
    url.pathname === "/" ||
    url.pathname === "/admin" ||
    url.pathname === "/resolve"
  ) {
    return handleGateway(request);
  }
  return jsonResponse({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return headSafe(routeRequest(request), request.method);
    } catch (error) {
      const url = new URL(request.url);
      console.error(
        JSON.stringify({
          message: "gateway_request_failed",
          method: request.method,
          path: url.pathname,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      return headSafe(
        jsonResponse({ error: "Internal server error" }, 500),
        request.method,
      );
    }
  },
} satisfies ExportedHandler;
