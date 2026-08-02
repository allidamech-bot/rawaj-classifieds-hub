import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const SITE_URL = process.env.FINAL_SITE_URL ?? "https://sa.rawa-j.com";
const WORKER_URL = process.env.SITE_URL ?? "https://rawaj-saudi-web.allidamech.workers.dev";
const API_URL = process.env.API_URL ?? "https://rawaj-saudi-classifieds.allidamech.workers.dev";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY ?? "";
const SAUDI_APP_DIR = process.env.SAUDI_APP_DIR ?? "";

if (!FIREBASE_API_KEY) throw new Error("FIREBASE_API_KEY is required");
if (!SAUDI_APP_DIR) throw new Error("SAUDI_APP_DIR is required");

const playwrightUrl = pathToFileURL(
  resolve(SAUDI_APP_DIR, "node_modules/playwright/index.mjs"),
).href;
const { chromium } = await import(playwrightUrl);

const stamp = Date.now();
const email = `rawaj.saudi.release.${stamp}@example.com`;
const password = `Ra!${stamp}Stable9`;
const expectedDisplayName = `Saudi Release ${stamp}`;
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl9jXkAAAAASUVORK5CYII=",
  "base64",
);

let firebaseUid = "";
let firebaseIdToken = "";
let applicationProfileId = "";
let avatarAssetUrl = "";
let browser;

await mkdir("artifacts", { recursive: true });

async function firebaseRequest(path, body) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  console.log(`Firebase ${path}: ${response.status}`);
  if (!response.ok) {
    throw new Error(`Firebase ${path} failed (${response.status}): ${text.slice(0, 1000)}`);
  }
  return payload;
}

async function jsonRequest(origin, path, { method = "GET", token = null, body = undefined } = {}) {
  const response = await fetch(new URL(path, `${origin}/`), {
    method,
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  console.log(`${method} ${origin}${path}: ${response.status}`);
  return { response, payload, text };
}

function assertStatus(result, expected, label) {
  if (result.response.status !== expected) {
    throw new Error(
      `${label} expected ${expected}, got ${result.response.status}: ${result.text.slice(0, 1000)}`,
    );
  }
}

async function verifyPublicInfrastructure(origin) {
  const health = await jsonRequest(origin, "/v1/health");
  assertStatus(health, 200, `${origin} health`);
  if (health.payload?.data?.database !== "ready") {
    throw new Error(`${origin} D1 is not ready`);
  }

  const references = await jsonRequest(origin, "/v1/references");
  assertStatus(references, 200, `${origin} references`);
  const data = references.payload?.data;
  if (
    data?.categories?.length !== 12 ||
    data?.taxonomyNodes?.length !== 117 ||
    data?.governorates?.length !== 13
  ) {
    throw new Error(`${origin} reference counts are incorrect`);
  }
}

async function verifyPrivateApiAndStorage() {
  const directProfile = await jsonRequest(API_URL, "/api/profile", { token: firebaseIdToken });
  assertStatus(directProfile, 200, "Direct profile bootstrap");
  applicationProfileId = directProfile.payload?.data?.id ?? "";
  if (!applicationProfileId) throw new Error("Application profile id was not created");
  await writeFile("/tmp/rawaj-saudi-auth-profile-id", applicationProfileId, "utf8");

  for (const origin of [WORKER_URL, SITE_URL]) {
    const sameOriginProfile = await jsonRequest(origin, "/api/profile", { token: firebaseIdToken });
    assertStatus(sameOriginProfile, 200, `${origin} authenticated gateway`);
    if (sameOriginProfile.payload?.data?.id !== applicationProfileId) {
      throw new Error(`${origin} returned the wrong application profile`);
    }
  }

  const updated = await jsonRequest(SITE_URL, "/api/profile", {
    method: "PATCH",
    token: firebaseIdToken,
    body: {
      firstName: "Saudi",
      lastName: "Release",
      displayName: expectedDisplayName,
      businessName: "RAWAJ Stability Test",
      bio: "Disposable Firebase and Cloudflare production verification.",
      governorate: "الرياض",
      cityArea: "الرياض",
      phone: "+966500000001",
      whatsapp: "+966500000001",
      preferredContactMethod: "chat",
    },
  });
  assertStatus(updated, 200, "Same-origin profile update");
  if (updated.payload?.data?.displayName !== expectedDisplayName) {
    throw new Error("D1 profile update did not persist");
  }

  const preferences = await jsonRequest(SITE_URL, "/v1/account/notification-preferences", {
    token: firebaseIdToken,
  });
  assertStatus(preferences, 200, "Notification preferences read");

  const preferenceUpdate = await jsonRequest(SITE_URL, "/v1/account/notification-preferences", {
    method: "PATCH",
    token: firebaseIdToken,
    body: { key: "messagesEnabled", enabled: false },
  });
  assertStatus(preferenceUpdate, 200, "Notification preferences update");
  if (preferenceUpdate.payload?.data?.messagesEnabled !== false) {
    throw new Error("Notification preference was not persisted in D1");
  }

  const form = new FormData();
  form.set("kind", "avatar");
  form.set("file", new File([pngBytes], "release-avatar.png", { type: "image/png" }));
  const upload = await fetch(new URL("/api/profile/media", SITE_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${firebaseIdToken}` },
    body: form,
  });
  const uploadText = await upload.text();
  const uploadPayload = uploadText ? JSON.parse(uploadText) : null;
  console.log(`POST ${SITE_URL}/api/profile/media: ${upload.status}`);
  if (upload.status !== 201 || !uploadPayload?.data?.url) {
    throw new Error(`R2 avatar upload failed (${upload.status}): ${uploadText.slice(0, 1000)}`);
  }
  avatarAssetUrl = new URL(uploadPayload.data.url, SITE_URL).toString();

  const media = await fetch(avatarAssetUrl);
  if (media.status !== 200 || !media.headers.get("content-type")?.startsWith("image/png")) {
    throw new Error(`R2 avatar read failed (${media.status})`);
  }

  const remove = await jsonRequest(SITE_URL, "/api/profile/media/avatar", {
    method: "DELETE",
    token: firebaseIdToken,
  });
  assertStatus(remove, 200, "R2 avatar removal");
  const removedMedia = await fetch(avatarAssetUrl);
  if (removedMedia.status !== 404) {
    throw new Error(`Removed R2 avatar remained accessible (${removedMedia.status})`);
  }
  avatarAssetUrl = "";
}

async function waitForInteractiveLogin(page) {
  await page.goto(`${SITE_URL}/login?releaseGate=${stamp}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page
    .locator('form[data-interactive="true"]')
    .waitFor({ state: "visible", timeout: 30_000 });
}

async function verifyBrowserEmailSession() {
  const context = await browser.newContext({ locale: "ar-SA" });
  const page = await context.newPage();
  const authResponses = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText ?? "unknown" });
  });
  page.on("response", async (response) => {
    if (/identitytoolkit|securetoken|\/api\/profile/.test(response.url())) {
      authResponses.push({ url: response.url(), status: response.status() });
    }
  });

  await waitForInteractiveLogin(page);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
  await page.waitForTimeout(1500);

  if (
    !authResponses.some(
      (item) => item.url.includes("accounts:signInWithPassword") && item.status === 200,
    )
  ) {
    throw new Error("Browser email login did not complete through Firebase");
  }
  if (!authResponses.some((item) => item.url.includes("/api/profile") && item.status === 200)) {
    throw new Error("Browser profile bootstrap did not pass through the Cloudflare gateway");
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  if (new URL(page.url()).pathname === "/login") {
    throw new Error("Firebase browser session did not persist across reload");
  }
  if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(" | ")}`);
  const meaningfulFailures = failedRequests.filter(
    (item) => !item.url.includes("/v1/system-status") && !item.url.includes("favicon"),
  );
  if (meaningfulFailures.length) {
    throw new Error(`Browser request failures: ${JSON.stringify(meaningfulFailures)}`);
  }

  await page.screenshot({ path: "artifacts/saudi-auth-session.png", fullPage: true });
  await context.close();
}

async function verifyPasswordReset() {
  const context = await browser.newContext({ locale: "ar-SA" });
  const page = await context.newPage();
  const resetResponses = [];
  page.on("response", (response) => {
    if (response.url().includes("accounts:sendOobCode")) {
      resetResponses.push(response.status());
    }
  });

  await page.goto(`${SITE_URL}/login?mode=forgot&releaseGate=${stamp}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page
    .locator('form[data-interactive="true"]')
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('form button[type="submit"]').click();
  await page.waitForTimeout(3000);
  const body = await page.locator("body").innerText();
  if (!resetResponses.includes(200)) throw new Error("Firebase password reset request failed");
  if (!body.includes("ستصلك") && !body.includes("receive")) {
    throw new Error("Password reset success state was not displayed");
  }
  await context.close();
}

async function verifyGoogleProvider() {
  const context = await browser.newContext({ locale: "ar-SA" });
  const page = await context.newPage();
  await waitForInteractiveLogin(page);

  const popupPromise = page.waitForEvent("popup", { timeout: 15_000 });
  await page.getByRole("button", { name: /Google/i }).click();
  const popup = await popupPromise;
  await popup.waitForURL((url) => url.hostname.includes("accounts.google.com"), {
    timeout: 20_000,
  });
  console.log(`Google OAuth popup reached ${popup.url()}`);
  await popup.close();
  await context.close();
}

try {
  await verifyPublicInfrastructure(API_URL);
  await verifyPublicInfrastructure(WORKER_URL);
  await verifyPublicInfrastructure(SITE_URL);

  const created = await firebaseRequest("accounts:signUp", {
    email,
    password,
    returnSecureToken: true,
  });
  firebaseUid = created.localId ?? "";
  firebaseIdToken = created.idToken ?? "";
  if (!firebaseUid || !firebaseIdToken)
    throw new Error("Firebase did not return a disposable identity");
  await writeFile("/tmp/rawaj-saudi-auth-firebase-uid", firebaseUid, "utf8");

  await verifyPrivateApiAndStorage();

  browser = await chromium.launch({ headless: true });
  await verifyBrowserEmailSession();
  await verifyPasswordReset();
  await verifyGoogleProvider();

  await writeFile(
    "artifacts/saudi-firebase-cloudflare-production-e2e.json",
    JSON.stringify(
      {
        siteUrl: SITE_URL,
        workerUrl: WORKER_URL,
        apiUrl: API_URL,
        firebaseUid,
        applicationProfileId,
        checks: [
          "Firebase signup",
          "Firebase email login",
          "persisted browser session",
          "password reset",
          "Google OAuth popup",
          "direct and same-origin authenticated profile",
          "D1 profile update",
          "notification preferences",
          "R2 upload/read/delete",
          "public health and references",
        ],
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log("SAUDI FIREBASE CLOUDFLARE PASS: all production dependency checks succeeded.");
} finally {
  if (browser) await browser.close().catch(() => undefined);
  if (avatarAssetUrl && firebaseIdToken) {
    await fetch(new URL("/api/profile/media/avatar", SITE_URL), {
      method: "DELETE",
      headers: { authorization: `Bearer ${firebaseIdToken}` },
    }).catch(() => undefined);
  }
  if (firebaseIdToken) {
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: firebaseIdToken }),
      },
    ).catch(() => undefined);
  }
}
