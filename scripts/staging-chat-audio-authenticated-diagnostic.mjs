import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = [
  "RAWAJ_STAGING_PROJECT_REF",
  "RAWAJ_PRODUCTION_PROJECT_REF",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RAWAJ_STAGING_USER_A_EMAIL",
  "RAWAJ_STAGING_USER_A_PASSWORD",
  "RAWAJ_STAGING_USER_B_EMAIL",
  "RAWAJ_STAGING_USER_B_PASSWORD",
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required staging secret: ${name}`);
}

if (process.env.RAWAJ_STAGING_PROJECT_REF === process.env.RAWAJ_PRODUCTION_PROJECT_REF) {
  throw new Error("Authenticated audio diagnostics must never run against RAWAJ Production.");
}

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const service = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = randomUUID();
let listingId = null;
let conversationId = null;
let uploadedPath = null;
let messageId = null;

try {
  const [{ data: category, error: categoryError }, { data: governorate, error: governorateError }] =
    await Promise.all([
      service.from("categories").select("id").eq("is_active", true).limit(1).single(),
      service.from("governorates").select("id").eq("is_active", true).limit(1).single(),
    ]);
  if (categoryError || !category?.id) throw categoryError ?? new Error("No staging category.");
  if (governorateError || !governorate?.id)
    throw governorateError ?? new Error("No staging governorate.");

  const appModule = await import("../src/lib/supabase.ts");
  const messaging = await import("../src/lib/api/messaging.ts");
  const appClient = appModule.supabase;
  if (!appClient) throw new Error("Application Supabase client is unavailable.");

  const sellerClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const sellerAuth = await sellerClient.auth.signInWithPassword({
    email: process.env.RAWAJ_STAGING_USER_A_EMAIL,
    password: process.env.RAWAJ_STAGING_USER_A_PASSWORD,
  });
  if (sellerAuth.error || !sellerAuth.data.user?.id)
    throw sellerAuth.error ?? new Error("Could not authenticate staging seller.");

  const buyerAuth = await appClient.auth.signInWithPassword({
    email: process.env.RAWAJ_STAGING_USER_B_EMAIL,
    password: process.env.RAWAJ_STAGING_USER_B_PASSWORD,
  });
  if (buyerAuth.error || !buyerAuth.data.user?.id)
    throw buyerAuth.error ?? new Error("Could not authenticate staging buyer.");

  const listingInsert = await service
    .from("listings")
    .insert({
      owner_id: sellerAuth.data.user.id,
      category_id: category.id,
      governorate_id: governorate.id,
      title: `اختبار صوت رواج ${runId.slice(0, 8)}`,
      description: "إعلان مؤقت لاختبار رفع وإرسال التسجيل الصوتي ثم حذفه آليًا.",
      price: 1,
      currency: "SYP",
      price_type: "fixed",
      listing_condition: "used",
      status: "approved",
      district_ar: "اختبار آلي",
      contact_options: { message: true, phone: false, whatsapp: false },
      details: { diagnostic: true },
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (listingInsert.error || !listingInsert.data?.id)
    throw listingInsert.error ?? new Error("Could not create staging diagnostic listing.");
  listingId = listingInsert.data.id;

  const start = await appClient.rpc("rawaj_start_listing_conversation", {
    p_listing_id: listingId,
  });
  if (start.error || !start.data) throw start.error ?? new Error("Could not start conversation.");
  conversationId = String(start.data);

  const requestId = randomUUID();
  const audioBytes = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x42, 0xf7, 0x81, 0x01,
    0x42, 0xf2, 0x81, 0x04, 0x42, 0xf3, 0x81, 0x08,
  ]);
  const file = new File([audioBytes], `voice-${requestId}.webm`, {
    type: "audio/webm;codecs=opus",
  });

  const validation = messaging.validateChatAudio(file, 1_250);
  if (!validation.ok) throw new Error(`Client validation failed: ${validation.error.message}`);

  const upload = await messaging.uploadChatAudio({
    conversationId,
    requestId,
    file,
    durationMs: 1_250,
  });
  if (!upload.ok) {
    throw new Error(
      `Audio upload failed [${upload.error.code}/${upload.error.operation ?? "unknown"}]: ${upload.error.message} :: ${upload.error.details ?? ""}`,
    );
  }
  uploadedPath = upload.data.path;

  const send = await messaging.sendConversationMessage({
    conversationId,
    requestId,
    body: "",
    attachment: upload.data,
  });
  if (!send.ok) {
    throw new Error(
      `Audio message send failed [${send.error.code}/${send.error.operation ?? "unknown"}]: ${send.error.message} :: ${send.error.details ?? ""}`,
    );
  }
  messageId = send.data.id;

  if (send.data.attachmentKind !== "audio") {
    throw new Error(`Unexpected attachment kind: ${send.data.attachmentKind}`);
  }
  if (send.data.attachmentMimeType !== "audio/webm") {
    throw new Error(`Unexpected attachment MIME: ${send.data.attachmentMimeType}`);
  }
  if (send.data.attachmentDurationMs !== 1_250) {
    throw new Error(`Unexpected attachment duration: ${send.data.attachmentDurationMs}`);
  }

  const signedUrl = await messaging.createChatAudioSignedUrl(uploadedPath);
  if (!signedUrl) throw new Error("Could not create a signed playback URL after sending.");
  const playback = await fetch(signedUrl);
  if (!playback.ok) throw new Error(`Signed playback request failed: HTTP ${playback.status}`);
  const playbackBytes = new Uint8Array(await playback.arrayBuffer());
  if (playbackBytes.byteLength !== audioBytes.byteLength) {
    throw new Error(
      `Playback byte count mismatch: expected ${audioBytes.byteLength}, got ${playbackBytes.byteLength}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        stage: "staging",
        mimeInput: file.type,
        mimeStored: upload.data.mimeType,
        bytes: file.size,
        durationMs: upload.data.durationMs,
        rpc: "rawaj_send_conversation_message_v4",
        playback: "signed-url-ok",
      },
      null,
      2,
    ),
  );
} finally {
  if (messageId) await service.from("conversation_messages").delete().eq("id", messageId);
  if (uploadedPath) await service.storage.from("conversation-audio").remove([uploadedPath]);
  if (conversationId) await service.from("conversations").delete().eq("id", conversationId);
  if (listingId) await service.from("listings").delete().eq("id", listingId);
}
