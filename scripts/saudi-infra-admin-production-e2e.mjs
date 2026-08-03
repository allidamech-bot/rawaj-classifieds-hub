import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SITE_URL = process.env.FINAL_SITE_URL ?? "https://sa.rawa-j.com";
const WORKER_URL = process.env.SITE_URL ?? "https://rawaj-saudi-web.allidamech.workers.dev";
const API_URL = process.env.API_URL ?? "https://rawaj-saudi-classifieds.allidamech.workers.dev";
const SYRIA_SITE_URL = process.env.SYRIA_SITE_URL ?? "https://rawa-j.com";
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY ?? "";
const D1_NAME = process.env.D1_NAME ?? "";
const WRANGLER_CONFIG = process.env.WRANGLER_CONFIG ?? "";
const SAUDI_APP_DIR = process.env.SAUDI_APP_DIR ?? "";

for (const [name, value] of Object.entries({
  FIREBASE_API_KEY,
  D1_NAME,
  WRANGLER_CONFIG,
  SAUDI_APP_DIR,
})) {
  if (!value) throw new Error(`${name} is required`);
}

const playwrightUrl = pathToFileURL(
  resolve(SAUDI_APP_DIR, "node_modules/playwright/index.mjs"),
).href;
const { chromium } = await import(playwrightUrl);
const workerDirectory = dirname(WRANGLER_CONFIG);
const stamp = `${Date.now()}-${process.env.GITHUB_RUN_ID ?? "local"}`;
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3l8AAAAASUVORK5CYII=",
  "base64",
);

const accounts = [];
const listingRecords = [];
let browser;

function safeId(value, label) {
  if (!/^[0-9a-fA-F-]{36}$/.test(value ?? "")) throw new Error(`${label} is not a UUID`);
  return value;
}

function sql(value) {
  return String(value).replaceAll("'", "''");
}

function runD1(command, label) {
  const result = spawnSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      D1_NAME,
      "--remote",
      "--config",
      WRANGLER_CONFIG,
      "--command",
      command,
    ],
    {
      cwd: workerDirectory,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `${label} failed: ${(result.stderr || result.stdout || "unknown").slice(0, 2000)}`,
    );
  }
}

async function request(origin, path, { method = "GET", token, body, headers = {} } = {}) {
  const response = await fetch(new URL(path, `${origin}/`), {
    method,
    headers: {
      accept: "application/json",
      "cache-control": "no-cache",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  console.log(`${method} ${new URL(path, `${origin}/`).pathname}: ${response.status}`);
  return { response, payload, text };
}

function expectStatus(result, expected, label) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(result.response.status)) {
    throw new Error(
      `${label} expected ${allowed.join("/")}, got ${result.response.status}: ${result.text.slice(0, 700)}`,
    );
  }
}

async function firebase(path, body, { expectOk = true } = {}) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${path}?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    },
  );
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  console.log(`Firebase ${path}: ${response.status}`);
  if (expectOk && !response.ok) throw new Error(`Firebase ${path} failed (${response.status})`);
  if (!expectOk && response.ok) throw new Error(`Firebase ${path} unexpectedly succeeded`);
  return { response, payload };
}

async function createAccount(label) {
  const email = `rawaj.saudi.${label}.${stamp}@example.com`;
  const password = `Ra!${Date.now()}${Math.random().toString(16).slice(2)}Z9`;
  const created = await firebase("accounts:signUp", {
    email,
    password,
    returnSecureToken: true,
  });
  const token = created.payload.idToken ?? "";
  const uid = created.payload.localId ?? "";
  if (!token || !uid) throw new Error(`Firebase ${label} account is incomplete`);

  const profile = await request(API_URL, "/api/profile", { token });
  expectStatus(profile, 200, `${label} profile bootstrap`);
  const profileId = safeId(profile.payload?.data?.id, `${label} profile id`);
  const account = { label, email, password, token, uid, profileId };
  accounts.push(account);
  return account;
}

function setPrivilegedRole(account, role) {
  const userId = safeId(account.profileId, `${account.label} profile id`);
  const statements = [
    `DELETE FROM user_roles WHERE user_id='${sql(userId)}' AND role IN ('moderator','admin','owner')`,
  ];
  if (role) {
    statements.push(
      `INSERT OR IGNORE INTO user_roles (user_id, role, created_at) VALUES ('${sql(userId)}','${sql(role)}',strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    );
  }
  runD1(`${statements.join("; ")};`, `set ${role ?? "user"} role`);
  console.log(`Role boundary prepared: ${role ?? "user"}`);
}

async function verifyRoleProfile(account, role) {
  const profile = await request(SITE_URL, "/api/profile", { token: account.token });
  expectStatus(profile, 200, `${role} profile read`);
  const roles = profile.payload?.data?.roles ?? [];
  if (!roles.includes("user")) throw new Error(`${role} profile lost the base user role`);
  if (role !== "user" && !roles.includes(role))
    throw new Error(`${role} role did not reach the profile API`);
  if (role === "user" && roles.some((item) => ["moderator", "admin", "owner"].includes(item))) {
    throw new Error("Ordinary account unexpectedly received an administrative role");
  }
}

async function verifyAdminBoundaries(account, role) {
  const matrix = {
    user: { metrics: 403, users: 403, audit: 403, pending: 403, listings: 403 },
    moderator: { metrics: 403, users: 403, audit: 403, pending: 200, listings: 200 },
    admin: { metrics: 200, users: 403, audit: 200, pending: 200, listings: 200 },
    owner: { metrics: 200, users: 200, audit: 200, pending: 200, listings: 200 },
  }[role];
  const paths = {
    metrics: "/v1/admin/metrics",
    users: "/v1/admin/users",
    audit: "/v1/admin/audit",
    pending: "/v1/admin/listings/pending",
    listings: "/v1/admin/listings",
  };
  for (const [key, path] of Object.entries(paths)) {
    const result = await request(SITE_URL, path, { token: account.token });
    expectStatus(result, matrix[key], `${role} ${key} boundary`);
  }
}

async function loginInBrowser(account) {
  const context = await browser.newContext({ locale: "ar-SA" });
  const page = await context.newPage();
  await page.goto(`${SITE_URL}/login?infraGate=${encodeURIComponent(stamp)}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page
    .locator('form[data-interactive="true"]')
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 30_000 });
  await page.waitForTimeout(1800);
  return { context, page };
}

async function verifyBrowserAdminBlocked(account) {
  const { context, page } = await loginInBrowser(account);
  await page.goto(`${SITE_URL}/admin?infraGate=${encodeURIComponent(stamp)}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(2200);
  const body = await page.locator("body").innerText();
  if (!/غير مخوّل|Not authorized/i.test(body)) {
    throw new Error("Ordinary browser session was not blocked from the Saudi admin surface");
  }
  await context.close();
}

async function verifyBrowserOwnerAndLogout(account) {
  const { context, page } = await loginInBrowser(account);
  await page.goto(`${SITE_URL}/admin?infraGate=${encodeURIComponent(stamp)}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(2600);
  const adminBody = await page.locator("body").innerText();
  if (/غير مخوّل|Not authorized|تسجيل الدخول مطلوب|Login required/i.test(adminBody)) {
    throw new Error("Owner browser session could not enter the Saudi admin surface");
  }
  if (!/مركز القيادة|Command center/i.test(adminBody)) {
    throw new Error("Saudi admin navigation did not render for the owner account");
  }

  await page.goto(`${SITE_URL}/profile?infraGate=${encodeURIComponent(stamp)}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  const logout = page.getByRole("button", { name: /^(?:خروج|تسجيل الخروج|Log out)$/i });
  await logout.waitFor({ state: "visible", timeout: 20_000 });
  await logout.click();
  await page.waitForTimeout(2000);
  await page.goto(`${SITE_URL}/admin?afterLogout=${encodeURIComponent(stamp)}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await page.waitForTimeout(1500);
  const signedOutBody = await page.locator("body").innerText();
  if (!/تسجيل الدخول مطلوب|Login required/i.test(signedOutBody)) {
    throw new Error("Admin surface remained available after browser logout");
  }
  await context.close();
}

function fieldValue(field) {
  const options = Array.isArray(field?.options) ? field.options : [];
  const firstOption = options[0]?.key ?? options[0]?.value ?? null;
  const validation =
    field?.validation && typeof field.validation === "object" ? field.validation : {};
  const type = String(field?.fieldType ?? "text").toLowerCase();
  if (type.includes("multi") || type.includes("checkbox")) return [firstOption ?? "other"];
  if (firstOption !== null) return firstOption;
  if (type.includes("bool") || type.includes("switch")) return true;
  if (type.includes("number") || type.includes("integer") || type.includes("decimal")) {
    return Number.isFinite(validation.min) ? validation.min : 1;
  }
  if (type.includes("year")) return 2024;
  if (type.includes("date")) return "2026-01-01";
  return "اختبار مكتمل";
}

async function chooseTaxonomy() {
  const references = await request(SITE_URL, "/v1/references");
  expectStatus(references, 200, "Saudi references");
  const data = references.payload?.data ?? {};
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const governorates = Array.isArray(data.governorates) ? data.governorates : [];
  const subcategories = Array.isArray(data.subcategories) ? data.subcategories : [];
  const nodes = Array.isArray(data.taxonomyNodes) ? data.taxonomyNodes : [];
  if (!categories.length || !governorates.length || !nodes.length) {
    throw new Error("Saudi taxonomy references are incomplete");
  }

  const leaves = nodes.filter((node) => node.isLeaf === true || node.is_leaf === 1);
  let fallback = null;
  for (const leaf of leaves) {
    const nodeId = leaf.id;
    if (!nodeId) continue;
    const schema = await request(SITE_URL, `/v1/taxonomy/leaf/${encodeURIComponent(nodeId)}`);
    if (schema.response.status !== 200 || schema.payload?.data?.found !== true) continue;
    const fields = Array.isArray(schema.payload?.data?.fields) ? schema.payload.data.fields : [];
    const required = fields.filter((field) => field.required === true);
    const legacyCategoryId = leaf.legacyCategoryId ?? leaf.legacy_category_id ?? null;
    const category = categories.find((item) => item.id === legacyCategoryId) ?? categories[0];
    const legacySubcategoryId = leaf.legacySubcategoryId ?? leaf.legacy_subcategory_id ?? null;
    const subcategory = subcategories.find(
      (item) => item.id === legacySubcategoryId && item.categoryId === category.id,
    );
    const candidate = {
      nodeId,
      categoryId: category.id,
      subcategoryId: subcategory?.id ?? null,
      governorateId: governorates[0].id,
      details: Object.fromEntries(required.map((field) => [field.key, fieldValue(field)])),
    };
    if (required.length === 0) return candidate;
    fallback ??= candidate;
  }
  if (!fallback) throw new Error("No active Saudi taxonomy leaf could be used by the release gate");
  return fallback;
}

function listingPayload(taxonomy, title, submit) {
  return {
    categoryId: taxonomy.categoryId,
    subcategoryId: taxonomy.subcategoryId,
    governorateId: taxonomy.governorateId,
    title,
    description: "إعلان سعودي مؤقت ومتكامل للتحقق من الإرسال والمراجعة والنشر والفصل بين الأسواق.",
    price: 1250,
    priceType: "fixed",
    condition: "used",
    districtAr: null,
    contactName: "اختبار آلي",
    contactOptions: { chat: true },
    details: taxonomy.details,
    submit,
  };
}

async function createSubmittedListing(seller, taxonomy, suffix) {
  const title = `اختبار إغلاق السعودية ${suffix} ${stamp}`;
  const draft = await request(SITE_URL, "/v1/listings", {
    method: "POST",
    token: seller.token,
    body: listingPayload(taxonomy, title, false),
  });
  expectStatus(draft, [200, 201], `${suffix} draft creation`);
  const listingId = safeId(draft.payload?.data?.id, `${suffix} listing id`);
  listingRecords.push({ id: listingId, seller, mediaAssetId: "" });

  const assignment = await request(SITE_URL, `/v1/listings/${listingId}/taxonomy`, {
    method: "PUT",
    token: seller.token,
    body: { taxonomyNodeId: taxonomy.nodeId },
  });
  expectStatus(assignment, 200, `${suffix} taxonomy assignment`);

  const form = new FormData();
  form.set("file", new File([pngBytes], `${suffix}.png`, { type: "image/png" }));
  form.set("altAr", "صورة اختبار سعودية مؤقتة");
  const uploadResponse = await fetch(new URL(`/v1/listings/${listingId}/images`, SITE_URL), {
    method: "POST",
    headers: { authorization: `Bearer ${seller.token}`, accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  const uploadText = await uploadResponse.text();
  const uploadPayload = uploadText ? JSON.parse(uploadText) : null;
  console.log(`POST /v1/listings/${listingId}/images: ${uploadResponse.status}`);
  if (![200, 201].includes(uploadResponse.status) || !uploadPayload?.data?.mediaAssetId) {
    throw new Error(`${suffix} R2 listing image upload failed (${uploadResponse.status})`);
  }
  listingRecords.at(-1).mediaAssetId = uploadPayload.data.mediaAssetId;

  const submitted = await request(SITE_URL, `/v1/listings/${listingId}`, {
    method: "PATCH",
    token: seller.token,
    body: listingPayload(taxonomy, title, true),
  });
  expectStatus(submitted, 200, `${suffix} listing submission`);
  if (submitted.payload?.data?.status !== "pending_review") {
    throw new Error(`${suffix} listing did not enter pending_review`);
  }

  const ownerRead = await request(SITE_URL, `/api/listings/${listingId}`, { token: seller.token });
  expectStatus(ownerRead, 200, `${suffix} owner read`);
  if (ownerRead.payload?.data?.listing?.status !== "pending_review") {
    throw new Error(`${suffix} owner inventory did not persist pending_review`);
  }

  const preApproval = await request(SITE_URL, `/v1/listings/${listingId}`);
  expectStatus(preApproval, 404, `${suffix} pre-approval public privacy`);
  const syria = await request(SYRIA_SITE_URL, `/v1/listings/${listingId}`);
  if (syria.response.status === 200) throw new Error("Saudi listing leaked into the Syrian market");

  return {
    id: listingId,
    title,
    updatedAt: submitted.payload.data.updatedAt,
    mediaAssetId: uploadPayload.data.mediaAssetId,
  };
}

async function moderate(admin, listing, action, reason = null) {
  const body = {
    listingId: listing.id,
    action,
    expectedUpdatedAt: listing.updatedAt,
    ...(reason ? { reason } : {}),
  };
  const result = await request(SITE_URL, "/v1/admin/listings/moderate", {
    method: "POST",
    token: admin.token,
    body,
  });
  expectStatus(result, 200, `${action} listing`);
  return result;
}

async function verifyListingJourney(seller, admin) {
  const taxonomy = await chooseTaxonomy();
  const approved = await createSubmittedListing(seller, taxonomy, "قبول");

  setPrivilegedRole(admin, "moderator");
  await verifyRoleProfile(admin, "moderator");
  await verifyAdminBoundaries(admin, "moderator");
  const pending = await request(SITE_URL, "/v1/admin/listings/pending", { token: admin.token });
  if (!pending.payload?.data?.some?.((item) => item.id === approved.id)) {
    throw new Error("Submitted Saudi listing did not appear in the moderation queue");
  }

  await moderate(admin, approved, "approve");
  const publicDetail = await request(SITE_URL, `/v1/listings/${approved.id}`);
  expectStatus(publicDetail, 200, "approved Saudi public listing");
  const publicListing = publicDetail.payload?.data?.listing ?? publicDetail.payload?.data;
  if (publicListing?.status !== "approved" || publicListing?.currency !== "SAR") {
    throw new Error("Approved Saudi listing did not retain approved/SAR state");
  }

  const publicList = await request(
    SITE_URL,
    `/v1/listings?q=${encodeURIComponent(approved.title)}&pageSize=10`,
  );
  expectStatus(publicList, 200, "approved Saudi public inventory");
  const items = publicList.payload?.data?.items ?? publicList.payload?.data ?? [];
  if (!Array.isArray(items) || !items.some((item) => item.id === approved.id)) {
    throw new Error("Approved Saudi listing did not appear in public inventory");
  }

  const media = await fetch(
    new URL(`/v1/media/assets/${encodeURIComponent(approved.mediaAssetId)}`, SITE_URL),
    { signal: AbortSignal.timeout(45_000) },
  );
  if (media.status !== 200 || !media.headers.get("content-type")?.startsWith("image/png")) {
    throw new Error(`Approved Saudi R2 image is unavailable (${media.status})`);
  }
  const syriaApproved = await request(SYRIA_SITE_URL, `/v1/listings/${approved.id}`);
  if (syriaApproved.response.status === 200)
    throw new Error("Approved Saudi listing leaked into Syria");

  const rejected = await createSubmittedListing(seller, taxonomy, "رفض");
  await moderate(admin, rejected, "reject", "رفض آلي مؤقت للتحقق من مسار الإدارة");
  const rejectedOwner = await request(SITE_URL, `/api/listings/${rejected.id}`, {
    token: seller.token,
  });
  expectStatus(rejectedOwner, 200, "rejected owner listing read");
  if (rejectedOwner.payload?.data?.listing?.status !== "rejected") {
    throw new Error("Rejected Saudi listing did not persist rejected state");
  }
  const rejectedPublic = await request(SITE_URL, `/v1/listings/${rejected.id}`);
  expectStatus(rejectedPublic, 404, "rejected listing public privacy");

  setPrivilegedRole(admin, "admin");
  await verifyRoleProfile(admin, "admin");
  await verifyAdminBoundaries(admin, "admin");
  const audit = await request(SITE_URL, "/v1/admin/audit?limit=100", { token: admin.token });
  const actions = (audit.payload?.data ?? []).map((item) => item.action);
  if (!actions.includes("listing_approve") || !actions.includes("listing_reject")) {
    throw new Error("Saudi moderation audit trail is incomplete");
  }

  setPrivilegedRole(admin, "owner");
  await verifyRoleProfile(admin, "owner");
  await verifyAdminBoundaries(admin, "owner");
  await verifyBrowserOwnerAndLogout(admin);

  for (const record of listingRecords) {
    const removed = await request(SITE_URL, `/v1/listings/${record.id}`, {
      method: "DELETE",
      token: record.seller.token,
    });
    expectStatus(removed, 200, "temporary listing deletion");
  }
  const deletedMedia = await fetch(
    new URL(`/v1/media/assets/${encodeURIComponent(approved.mediaAssetId)}`, SITE_URL),
    { signal: AbortSignal.timeout(45_000) },
  );
  if (deletedMedia.status !== 404) {
    throw new Error(`Deleted Saudi listing media remained available (${deletedMedia.status})`);
  }
  listingRecords.length = 0;
}

async function verifyFirebaseFailures(account) {
  await firebase(
    "accounts:signInWithPassword",
    { email: account.email, password: `${account.password}-wrong`, returnSecureToken: true },
    { expectOk: false },
  );
  await firebase(
    "accounts:signUp",
    { email: account.email, password: account.password, returnSecureToken: true },
    { expectOk: false },
  );
  const missing = await request(SITE_URL, "/api/profile");
  expectStatus(missing, 401, "missing Firebase token rejection");
  const invalid = await request(SITE_URL, "/api/profile", { token: "invalid.token.value" });
  expectStatus(invalid, 401, "invalid Firebase token rejection");
}

async function cleanup() {
  for (const record of listingRecords) {
    await request(SITE_URL, `/v1/listings/${record.id}`, {
      method: "DELETE",
      token: record.seller.token,
    }).catch(() => undefined);
  }
  listingRecords.length = 0;

  const profileIds = accounts.map((account) => account.profileId).filter(Boolean);
  if (profileIds.length) {
    const inList = profileIds.map((id) => `'${sql(safeId(id, "cleanup profile id"))}'`).join(",");
    runD1(
      `PRAGMA foreign_keys=OFF; DELETE FROM listing_moderation_actions WHERE actor_id IN (${inList}); DELETE FROM audit_logs WHERE actor_id IN (${inList}); DELETE FROM user_roles WHERE user_id IN (${inList}); DELETE FROM public_profiles WHERE id IN (${inList}); DELETE FROM auth_users WHERE id IN (${inList}); PRAGMA foreign_keys=ON;`,
      "D1 disposable identity cleanup",
    );
  }

  for (const account of accounts) {
    await firebase("accounts:delete", { idToken: account.token }).catch(() => undefined);
  }
  accounts.length = 0;
}

try {
  const infrastructure = await Promise.all([
    request(API_URL, "/v1/health"),
    request(WORKER_URL, "/v1/health"),
    request(SITE_URL, "/v1/health"),
  ]);
  infrastructure.forEach((result, index) => {
    expectStatus(result, 200, `infrastructure health ${index + 1}`);
    if (result.payload?.data?.database !== "ready") throw new Error("Saudi D1 is not ready");
  });

  const admin = await createAccount("admin");
  const seller = await createAccount("seller");
  await verifyFirebaseFailures(seller);

  setPrivilegedRole(admin, null);
  await verifyRoleProfile(admin, "user");
  await verifyAdminBoundaries(admin, "user");

  browser = await chromium.launch({ headless: true });
  await verifyBrowserAdminBlocked(admin);
  await verifyListingJourney(seller, admin);

  console.log(
    "SAUDI INFRA ADMIN PASS: Firebase failures/logout, role boundaries, admin UI/APIs, full listing moderation, D1/R2 cleanup and Syria isolation succeeded.",
  );
} finally {
  if (browser) await browser.close().catch(() => undefined);
  await cleanup().catch((error) => {
    console.error(`Cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
  });
}
