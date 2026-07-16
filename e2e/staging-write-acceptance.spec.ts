import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const writeAcceptanceEnabled = process.env.RAWAJ_STAGING_WRITE_ACCEPTANCE === "1";

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const stagingProjectRef = process.env.RAWAJ_STAGING_PROJECT_REF ?? "";

const userACredentials = credentials("RAWAJ_STAGING_USER_A");
const userBCredentials = credentials("RAWAJ_STAGING_USER_B");
const userCCredentials = credentials("RAWAJ_STAGING_USER_C");
const moderatorCredentials = credentials("RAWAJ_STAGING_MODERATOR");

interface Credentials {
  email: string;
  password: string;
}

interface AuthenticatedActor {
  client: SupabaseClient;
  userId: string;
}

interface TaxonomyRow {
  id: string;
  parent_id: string | null;
  name_ar: string;
  is_leaf: boolean;
  is_active: boolean;
  legacy_category_id: string | null;
}

interface CategoryRow {
  id: string;
  slug: string;
  name_ar: string;
  placeholder: string | null;
}

interface LocationRow {
  id: string;
  name_ar: string;
  legacy_governorate_id: string | null;
  legacy_district_ar: string | null;
}

interface ListingRow {
  id: string;
  owner_id: string;
  title: string;
  status: string;
  updated_at: string;
}

const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const originalTitle = `اختبار رحلة رواج ${runId}`;
const approvedTitle = `اختبار رحلة رواج محدث ${runId}`;
const description =
  "إعلان آلي مخصص لاختبار رحلة الإنشاء والرفع والمراجعة والرفض وإعادة الإرسال دون استخدام بيانات حقيقية.";
const savedSearchName = `بحث اختبار ${runId}`;
const supportSubject = `طلب دعم اختبار ${runId}`;
const supportMessage =
  "هذا طلب دعم آلي للتحقق من أن المستخدم يستطيع إنشاء الطلب وقراءته ضمن حسابه فقط.";
const chatMessage = `رسالة اختبار رواج ${runId}`;
const accountDeletionSubject = "طلب حذف حساب رواج";

let serviceClient: SupabaseClient;
let userA: AuthenticatedActor;
let userB: AuthenticatedActor;
let userC: AuthenticatedActor;
let moderator: AuthenticatedActor;
let listingId: string | null = null;
let conversationId: string | null = null;
let savedSearchId: string | null = null;
let supportRequestId: string | null = null;
let accountDeletionRequestId: string | null = null;
let createdAccountDeletionRequest = false;
let ephemeralAuthUserId: string | null = null;

test.describe.serial("RAWAJ staging write acceptance", () => {
  test.skip(
    !writeAcceptanceEnabled,
    "Destructive write acceptance runs only with RAWAJ_STAGING_WRITE_ACCEPTANCE=1",
  );

  test.beforeAll(async () => {
    assertStagingEnvironment();

    serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    [userA, userB, userC, moderator] = await Promise.all([
      signInActor(userACredentials),
      signInActor(userBCredentials),
      signInActor(userCCredentials),
      signInActor(moderatorCredentials),
    ]);

    expect(new Set([userA.userId, userB.userId, userC.userId, moderator.userId]).size).toBe(4);

    const { data: moderatorRoles, error: moderatorRolesError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", moderator.userId);
    expect(moderatorRolesError).toBeNull();
    expect(
      (moderatorRoles ?? []).some((row) =>
        ["owner", "admin", "moderator"].includes(String(row.role)),
      ),
    ).toBe(true);
  });

  test.afterAll(async () => {
    await cleanupAcceptanceRecords();
    await Promise.allSettled([
      userA?.client.auth.signOut(),
      userB?.client.auth.signOut(),
      userC?.client.auth.signOut(),
      moderator?.client.auth.signOut(),
    ]);
  });

  test("signup and password-recovery endpoints accept an isolated staging identity", async () => {
    const [localPart, domain] = splitEmail(userACredentials.email);
    const ephemeralEmail = `${localPart}+rawaj-e2e-${runId}@${domain}`;
    const ephemeralPassword = `Rawaj!${randomUUID()}aA1`;
    const publicClient = createPublicClient();

    const signup = await publicClient.auth.signUp({
      email: ephemeralEmail,
      password: ephemeralPassword,
    });
    expect(signup.error).toBeNull();
    expect(signup.data.user?.id).toBeTruthy();
    ephemeralAuthUserId = signup.data.user?.id ?? null;

    const recovery = await publicClient.auth.resetPasswordForEmail(ephemeralEmail, {
      redirectTo: "http://127.0.0.1:4173/reset-password",
    });
    expect(recovery.error).toBeNull();
  });

  test("seller creates a photographed listing through the UI and submits it for review", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const fixture = await resolveListingFixture();

    await loginThroughUi(page, userACredentials, "/add-listing");
    await expect(page.getByText(/استوديو الإعلان|Listing studio/).first()).toBeVisible();
    await expect(page.getByText(/جارٍ تحميل بيانات النشر|Loading posting data/)).toHaveCount(0, {
      timeout: 30_000,
    });

    const taxonomySelector = page.locator('[data-listing-taxonomy-selector="true"]');
    await expect(taxonomySelector).toBeVisible();
    for (const node of fixture.taxonomyPath) {
      await taxonomySelector
        .getByRole("button", { name: new RegExp(`^${escapeRegex(node.name_ar)}`) })
        .click();
    }
    await expect(
      taxonomySelector.getByText(/تم اختيار التصنيف النهائي|Final category selected/),
    ).toBeVisible();

    await page.getByLabel(/ماذا تبيع|What are you selling/).fill(originalTitle);
    await page.getByRole("button", { name: /متابعة|Continue/ }).click();

    await page.getByLabel(/الوصف|Description/).fill(description);
    await page.locator('input[type="file"]').setInputFiles({
      name: `rawaj-acceptance-${runId}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.getByRole("button", { name: /متابعة|Continue/ }).click();

    await page.getByLabel(/^السعر$|^Price$/).fill("125000");
    const locationSearch = page.getByPlaceholder(/ابحث باسم المكان|Search location/);
    await locationSearch.fill(fixture.location.name_ar);
    await page
      .getByRole("button", {
        name: new RegExp(`^${escapeRegex(fixture.location.name_ar)}`),
      })
      .first()
      .click();

    await page.getByRole("button", { name: /إرسال للمراجعة|Submit for review/ }).click();
    await expect(
      page.getByText(/تم إرسال الإعلان للمراجعة|Listing sent for review/),
    ).toBeVisible({ timeout: 60_000 });

    const listing = await waitForListingStatus(originalTitle, "pending_review");
    listingId = listing.id;
    expect(listing.owner_id).toBe(userA.userId);

    const { data: images, error: imagesError } = await serviceClient
      .from("listing_images")
      .select("id,storage_path")
      .eq("listing_id", listing.id);
    expect(imagesError).toBeNull();
    expect(images?.length).toBeGreaterThan(0);
  });

  test("moderator rejection is audited and a different user cannot read or edit the rejected listing", async () => {
    const pending = await requireListing();
    await reviewListing(pending, "rejected", `رفض آلي للاختبار ${runId}`);

    const rejected = await waitForListingStatus(originalTitle, "rejected");
    await expectModerationEvidence(rejected.id, "rejected");

    const privateRead = await userB.client.from("listings").select("id").eq("id", rejected.id);
    expect(privateRead.error).toBeNull();
    expect(privateRead.data).toEqual([]);

    const foreignUpdate = await userB.client.rpc("rawaj_owner_update_listing_v3", {
      p_listing_id: rejected.id,
      p_patch: { title: `تعديل غير مصرح ${runId}` },
      p_expected_updated_at: rejected.updated_at,
    });
    expect(foreignUpdate.error).not.toBeNull();
  });

  test("owner edits the rejected listing, resubmits it, and moderator approves it atomically", async () => {
    const rejected = await requireListing();
    expect(rejected.status).toBe("rejected");

    const update = await userA.client.rpc("rawaj_owner_update_listing_v3", {
      p_listing_id: rejected.id,
      p_patch: { title: approvedTitle },
      p_expected_updated_at: rejected.updated_at,
    });
    expect(update.error).toBeNull();

    const submit = await userA.client.rpc("rawaj_submit_listing_for_review", {
      p_listing_id: rejected.id,
    });
    expect(submit.error).toBeNull();

    const resubmitted = await waitForListingStatus(approvedTitle, "pending_review");
    await reviewListing(resubmitted, "approved", `موافقة آلية للاختبار ${runId}`);

    const approved = await waitForListingStatus(approvedTitle, "approved");
    await expectModerationEvidence(approved.id, "approved");
  });

  test("approved listing is public and supports favorites and saved searches", async ({ page }) => {
    const approved = await requireListing();
    expect(approved.status).toBe("approved");

    await page.goto(`/listings/${approved.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(approvedTitle).first()).toBeVisible();

    const favorite = await userB.client.rpc("rawaj_set_favorite_v1", {
      p_listing_id: approved.id,
      p_favorited: true,
    });
    expect(favorite.error).toBeNull();
    expect(favorite.data).toBe(true);

    const { data: favoriteRow, error: favoriteError } = await userB.client
      .from("favorites")
      .select("user_id,listing_id")
      .eq("user_id", userB.userId)
      .eq("listing_id", approved.id)
      .single();
    expect(favoriteError).toBeNull();
    expect(favoriteRow?.listing_id).toBe(approved.id);

    const { data: savedSearch, error: savedSearchError } = await userB.client
      .from("saved_searches")
      .insert({
        user_id: userB.userId,
        name_ar: savedSearchName,
        filters: { query: approvedTitle, categoryId: null },
        alert_frequency: "daily",
      })
      .select("id,user_id,name_ar")
      .single();
    expect(savedSearchError).toBeNull();
    expect(savedSearch?.user_id).toBe(userB.userId);
    savedSearchId = savedSearch?.id ?? null;
  });

  test("participants receive live messages while a non-participant receives nothing", async () => {
    test.setTimeout(90_000);
    const approved = await requireListing();

    const start = await userB.client.rpc("rawaj_start_listing_conversation", {
      p_listing_id: approved.id,
    });
    expect(start.error).toBeNull();
    conversationId = String(start.data);
    expect(conversationId).not.toBe("");

    let nonParticipantEventCount = 0;
    const participantEvent = deferred<Record<string, unknown>>();
    const participantChannel = userA.client
      .channel(`acceptance-participant-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => participantEvent.resolve(payload.new as Record<string, unknown>),
      );
    const nonParticipantChannel = userC.client
      .channel(`acceptance-non-participant-${runId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          nonParticipantEventCount += 1;
        },
      );

    try {
      await Promise.all([
        subscribeChannel(participantChannel),
        subscribeChannel(nonParticipantChannel),
      ]);

      const send = await userB.client.rpc("rawaj_send_conversation_message_v2", {
        p_conversation_id: conversationId,
        p_client_request_id: randomUUID(),
        p_body: chatMessage,
      });
      expect(send.error).toBeNull();

      const liveRow = await withTimeout(participantEvent.promise, 8_000, "participant Realtime event");
      expect(liveRow.body).toBe(chatMessage);
      await delay(1_500);
      expect(nonParticipantEventCount).toBe(0);

      const participantRead = await userA.client
        .from("conversation_messages")
        .select("body")
        .eq("conversation_id", conversationId)
        .eq("body", chatMessage)
        .single();
      expect(participantRead.error).toBeNull();

      const nonParticipantRead = await userC.client
        .from("conversation_messages")
        .select("id")
        .eq("conversation_id", conversationId);
      expect(nonParticipantRead.error).toBeNull();
      expect(nonParticipantRead.data).toEqual([]);
    } finally {
      await Promise.allSettled([
        userA.client.removeChannel(participantChannel),
        userC.client.removeChannel(nonParticipantChannel),
      ]);
    }
  });

  test("support and account-deletion requests remain owned by the requesting account", async () => {
    const { data: supportRequest, error: supportError } = await userB.client
      .from("support_requests")
      .insert({
        user_id: userB.userId,
        type: "technical",
        subject: supportSubject,
        message: supportMessage,
        status: "new",
      })
      .select("id,user_id,subject")
      .single();
    expect(supportError).toBeNull();
    expect(supportRequest?.user_id).toBe(userB.userId);
    supportRequestId = supportRequest?.id ?? null;

    const otherAccountRead = await userC.client
      .from("support_requests")
      .select("id")
      .eq("id", supportRequestId ?? "");
    expect(otherAccountRead.error).toBeNull();
    expect(otherAccountRead.data).toEqual([]);

    const existingDeletionRequest = await userB.client
      .from("support_requests")
      .select("id,user_id")
      .eq("user_id", userB.userId)
      .eq("subject", accountDeletionSubject)
      .in("status", ["new", "under_review"])
      .limit(1)
      .maybeSingle();
    expect(existingDeletionRequest.error).toBeNull();

    if (existingDeletionRequest.data) {
      accountDeletionRequestId = existingDeletionRequest.data.id;
    } else {
      const createdDeletionRequest = await userB.client
        .from("support_requests")
        .insert({
          user_id: userB.userId,
          type: "other",
          subject: accountDeletionSubject,
          message:
            "أطلب حذف حسابي وبياناته الشخصية من منصة رواج. هذا طلب آلي ضمن بيئة الاختبار فقط.",
          status: "new",
        })
        .select("id,user_id")
        .single();
      expect(createdDeletionRequest.error).toBeNull();
      accountDeletionRequestId = createdDeletionRequest.data?.id ?? null;
      createdAccountDeletionRequest = true;
    }

    expect(accountDeletionRequestId).toBeTruthy();
  });
});

function credentials(prefix: string): Credentials {
  return {
    email: process.env[`${prefix}_EMAIL`] ?? "",
    password: process.env[`${prefix}_PASSWORD`] ?? "",
  };
}

function assertStagingEnvironment() {
  const requiredValues: Record<string, string> = {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    RAWAJ_STAGING_PROJECT_REF: stagingProjectRef,
    RAWAJ_STAGING_USER_A_EMAIL: userACredentials.email,
    RAWAJ_STAGING_USER_A_PASSWORD: userACredentials.password,
    RAWAJ_STAGING_USER_B_EMAIL: userBCredentials.email,
    RAWAJ_STAGING_USER_B_PASSWORD: userBCredentials.password,
    RAWAJ_STAGING_USER_C_EMAIL: userCCredentials.email,
    RAWAJ_STAGING_USER_C_PASSWORD: userCCredentials.password,
    RAWAJ_STAGING_MODERATOR_EMAIL: moderatorCredentials.email,
    RAWAJ_STAGING_MODERATOR_PASSWORD: moderatorCredentials.password,
  };

  for (const [name, value] of Object.entries(requiredValues)) {
    expect(value, `${name} is required`).not.toBe("");
  }

  expect(supabaseUrl).toBe(`https://${stagingProjectRef}.supabase.co`);
  expect(supabaseUrl).not.toContain("rawa-j.com");
}

function createPublicClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signInActor(actorCredentials: Credentials): Promise<AuthenticatedActor> {
  const client = createPublicClient();
  const { data, error } = await client.auth.signInWithPassword(actorCredentials);
  expect(error).toBeNull();
  expect(data.user?.id).toBeTruthy();
  return { client, userId: data.user!.id };
}

async function loginThroughUi(page: Page, actorCredentials: Credentials, returnTo: string) {
  await page.goto(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.locator('input[type="email"]').fill(actorCredentials.email);
  await page.locator('input[autocomplete="current-password"]').fill(actorCredentials.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await page.goto(returnTo, { waitUntil: "domcontentloaded" });
}

async function resolveListingFixture() {
  const [categoriesResult, taxonomyResult, locationResult] = await Promise.all([
    serviceClient
      .from("categories")
      .select("id,slug,name_ar,placeholder")
      .eq("is_active", true)
      .order("sort_order"),
    serviceClient
      .from("taxonomy_nodes")
      .select("id,parent_id,name_ar,is_leaf,is_active,legacy_category_id")
      .eq("is_active", true)
      .order("depth")
      .order("sort_order"),
    serviceClient
      .from("location_nodes")
      .select("id,name_ar,legacy_governorate_id,legacy_district_ar")
      .eq("country_code", "SY")
      .eq("is_active", true)
      .not("legacy_governorate_id", "is", null)
      .not("legacy_district_ar", "is", null)
      .order("depth", { ascending: false })
      .limit(100),
  ]);

  expect(categoriesResult.error).toBeNull();
  expect(taxonomyResult.error).toBeNull();
  expect(locationResult.error).toBeNull();

  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const taxonomy = (taxonomyResult.data ?? []) as TaxonomyRow[];
  const locations = (locationResult.data ?? []) as LocationRow[];
  const generalCategoryIds = new Set(
    categories
      .filter((category) => !isSpecialCategory(category))
      .map((category) => category.id),
  );
  const leaf = taxonomy.find(
    (node) =>
      node.is_leaf &&
      node.is_active &&
      Boolean(node.legacy_category_id) &&
      generalCategoryIds.has(node.legacy_category_id!),
  );
  expect(leaf, "A general active taxonomy leaf is required in staging").toBeTruthy();

  const byId = new Map(taxonomy.map((node) => [node.id, node]));
  const taxonomyPath: TaxonomyRow[] = [];
  let current: TaxonomyRow | undefined = leaf;
  while (current) {
    taxonomyPath.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  const location = locations.find((node) => node.name_ar.trim().length >= 2);
  expect(location, "An active canonical Syrian location is required in staging").toBeTruthy();

  return { taxonomyPath, location: location! };
}

function isSpecialCategory(category: CategoryRow) {
  const haystack = [category.id, category.slug, category.name_ar, category.placeholder]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return [
    "real",
    "estate",
    "عقار",
    "car",
    "vehicle",
    "auto",
    "سيار",
    "مركب",
    "job",
    "وظائف",
    "وظيفة",
    "عمل",
    "service",
    "خدمات",
    "خدمة",
    "phone",
    "mobile",
    "electronics",
    "الكترون",
    "إلكترون",
    "موبايل",
    "جوال",
  ].some((token) => haystack.includes(token));
}

async function waitForListingStatus(title: string, status: string): Promise<ListingRow> {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const { data, error } = await serviceClient
      .from("listings")
      .select("id,owner_id,title,status,updated_at")
      .eq("owner_id", userA.userId)
      .eq("title", title)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as ListingRow;
    await delay(500);
  }
  throw new Error(`Listing ${title} did not reach ${status}`);
}

async function requireListing(): Promise<ListingRow> {
  expect(listingId, "Listing must be created by the previous journey").toBeTruthy();
  const { data, error } = await serviceClient
    .from("listings")
    .select("id,owner_id,title,status,updated_at")
    .eq("id", listingId!)
    .single();
  expect(error).toBeNull();
  return data as ListingRow;
}

async function reviewListing(listing: ListingRow, decision: "approved" | "rejected", reason: string) {
  const result = await moderator.client.rpc("rawaj_review_listing_decision", {
    p_listing_id: listing.id,
    p_decision: decision,
    p_reason: reason,
    p_expected_updated_at: listing.updated_at,
  });
  expect(result.error).toBeNull();
}

async function expectModerationEvidence(id: string, status: "approved" | "rejected") {
  const [actionResult, auditResult] = await Promise.all([
    serviceClient
      .from("listing_moderation_actions")
      .select("listing_id,next_status,actor_id")
      .eq("listing_id", id)
      .eq("next_status", status)
      .eq("actor_id", moderator.userId)
      .limit(1)
      .maybeSingle(),
    serviceClient
      .from("audit_logs")
      .select("target_id,action,actor_id")
      .eq("target_id", id)
      .eq("action", `listing.moderation.${status === "approved" ? "approve" : "reject"}`)
      .eq("actor_id", moderator.userId)
      .limit(1)
      .maybeSingle(),
  ]);

  expect(actionResult.error).toBeNull();
  expect(actionResult.data).not.toBeNull();
  expect(auditResult.error).toBeNull();
  expect(auditResult.data).not.toBeNull();
}

async function subscribeChannel(channel: ReturnType<SupabaseClient["channel"]>) {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Realtime subscription timed out")), 10_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timeout);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timeout);
        reject(new Error(`Realtime subscription failed: ${status}`));
      }
    });
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  return Promise.race([
    promise,
    delay(timeoutMs).then(() => {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }),
  ]);
}

async function cleanupAcceptanceRecords() {
  if (!serviceClient) return;

  if (conversationId) {
    await serviceClient.from("conversation_messages").delete().eq("conversation_id", conversationId);
    await serviceClient.from("conversations").delete().eq("id", conversationId);
  }

  if (listingId) {
    const imageResult = await serviceClient
      .from("listing_images")
      .select("storage_path")
      .eq("listing_id", listingId);
    const storagePaths = (imageResult.data ?? [])
      .map((row) => String(row.storage_path ?? ""))
      .filter(Boolean);
    if (storagePaths.length > 0) {
      await serviceClient.storage.from("listing-images").remove(storagePaths);
    }

    await serviceClient.from("favorites").delete().eq("listing_id", listingId);
    await serviceClient.from("listing_images").delete().eq("listing_id", listingId);
    await serviceClient.from("listing_moderation_actions").delete().eq("listing_id", listingId);
    await serviceClient.from("audit_logs").delete().eq("target_id", listingId);
    await serviceClient.from("notifications").delete().eq("entity_id", listingId);
    await serviceClient.from("listings").delete().eq("id", listingId);
  }

  if (savedSearchId) await serviceClient.from("saved_searches").delete().eq("id", savedSearchId);
  if (supportRequestId)
    await serviceClient.from("support_requests").delete().eq("id", supportRequestId);
  if (createdAccountDeletionRequest && accountDeletionRequestId) {
    await serviceClient.from("support_requests").delete().eq("id", accountDeletionRequestId);
  }
  if (ephemeralAuthUserId) {
    await serviceClient.auth.admin.deleteUser(ephemeralAuthUserId);
  }
}

function splitEmail(email: string): [string, string] {
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || separator === email.length - 1) {
    throw new Error("Staging user A email must be a valid address");
  }
  return [email.slice(0, separator), email.slice(separator + 1)];
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
