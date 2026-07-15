import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

interface PushDelivery {
  delivery_id: string;
  notification_id: string;
  notification_type: string;
  device_id: string;
  device_token: string;
  title_ar: string;
  body_ar: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  attempt_count: number;
}

interface GoogleAccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const config = readConfig();
    const providedCronSecret = (request.headers.get("x-cron-secret") ?? "").trim();
    const configuredCronSecret = config.cronSecret.trim();
    if (!timingSafeEqual(providedCronSecret, configuredCronSecret)) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-rawaj-worker": "send-push-notifications-v1" } },
    });

    const flushResult = await client.rpc("rawaj_flush_due_saved_search_alerts_v2", {
      p_user_limit: 100,
    });
    if (flushResult.error) throw flushResult.error;

    const claimResult = await client.rpc("rawaj_claim_push_deliveries_v1", {
      p_batch_size: 100,
    });
    if (claimResult.error) throw claimResult.error;

    const deliveries = (claimResult.data ?? []) as PushDelivery[];
    if (deliveries.length === 0) {
      return jsonResponse({
        ok: true,
        flushed: firstRow(flushResult.data),
        claimed: 0,
        sent: 0,
        retried: 0,
        disabledDevices: 0,
      });
    }

    const accessToken = await createGoogleAccessToken(config);
    let sent = 0;
    let retried = 0;
    let disabledDevices = 0;

    for (const delivery of deliveries) {
      const outcome = await sendFcmMessage(config.firebaseProjectId, accessToken, delivery);
      const markResult = await client.rpc("rawaj_mark_push_delivery_v1", {
        p_delivery_id: delivery.delivery_id,
        p_success: outcome.ok,
        p_error: outcome.error,
        p_disable_device: outcome.disableDevice,
      });

      if (markResult.error) {
        console.error("Could not mark push delivery", {
          deliveryId: delivery.delivery_id,
          error: markResult.error.message,
        });
        continue;
      }

      if (outcome.ok) sent += 1;
      else retried += 1;
      if (outcome.disableDevice) disabledDevices += 1;
    }

    return jsonResponse({
      ok: true,
      flushed: firstRow(flushResult.data),
      claimed: deliveries.length,
      sent,
      retried,
      disabledDevices,
    });
  } catch (error) {
    console.error("Push delivery worker failed", error);
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown push delivery worker error",
      },
      500,
    );
  }
});

function readConfig() {
  const supabaseUrl = requiredSecret("SUPABASE_URL");
  const serviceRoleKey = requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = requiredSecret("PUSH_CRON_SECRET");
  const firebaseProjectId = requiredSecret("FIREBASE_PROJECT_ID");
  const firebaseClientEmail = requiredSecret("FIREBASE_CLIENT_EMAIL");
  const firebasePrivateKey = requiredSecret("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  return {
    supabaseUrl,
    serviceRoleKey,
    cronSecret,
    firebaseProjectId,
    firebaseClientEmail,
    firebasePrivateKey,
  };
}

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

async function createGoogleAccessToken(config: ReturnType<typeof readConfig>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(
    JSON.stringify({
      iss: config.firebaseClientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3_300,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(config.firebasePrivateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64UrlEncode(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = (await response.json()) as GoogleAccessTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description || payload.error || "Could not obtain FCM access token",
    );
  }
  return payload.access_token;
}

async function sendFcmMessage(
  projectId: string,
  accessToken: string,
  delivery: PushDelivery,
): Promise<{ ok: boolean; error: string | null; disableDevice: boolean }> {
  try {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: delivery.device_token,
            notification: {
              title: delivery.title_ar,
              body: safePushBody(delivery),
            },
            data: {
              notification_id: delivery.notification_id,
              target_type: delivery.target_type ?? "notifications",
              target_id: delivery.target_id ?? "",
              metadata: JSON.stringify(delivery.metadata ?? {}),
            },
            android: {
              priority: "high",
              notification: {
                channel_id: "rawaj_activity",
                sound: "default",
                default_vibrate_timings: true,
                icon: "rawaj_launcher",
              },
            },
          },
        }),
      },
    );

    if (response.ok) return { ok: true, error: null, disableDevice: false };

    const errorText = await response.text();
    const disableDevice = isPermanentTokenError(response.status, errorText);
    return {
      ok: false,
      error: `FCM ${response.status}: ${errorText.slice(0, 800)}`,
      disableDevice,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      disableDevice: false,
    };
  }
}

function safePushBody(delivery: PushDelivery): string {
  const type = delivery.notification_type.toLowerCase();
  if (type.includes("message") || type.includes("conversation")) {
    return "لديك رسالة جديدة على رواج";
  }
  if (type === "saved_search_match") return "توجد نتائج جديدة تطابق أحد بحوثك المحفوظة";
  if (type.includes("price")) return "تغيّر سعر إعلان تتابعه على رواج";
  if (type.includes("review")) return "لديك تحديث جديد متعلق بالتقييمات";
  if (type.includes("promotion")) return "لديك تحديث جديد متعلق بالترويج";
  if (
    type.includes("listing") ||
    type === "approved" ||
    type === "rejected" ||
    type === "expired"
  ) {
    return "لديك تحديث جديد على أحد إعلاناتك";
  }
  return "لديك تحديث جديد في رواج";
}

function isPermanentTokenError(status: number, body: string): boolean {
  const normalized = body.toUpperCase();
  return (
    normalized.includes("UNREGISTERED") ||
    normalized.includes("SENDER_ID_MISMATCH") ||
    (status === 404 && normalized.includes("NOT_FOUND"))
  );
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function base64UrlEncode(value: string | ArrayBuffer): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return mismatch === 0;
}

function firstRow(value: unknown): unknown {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}
