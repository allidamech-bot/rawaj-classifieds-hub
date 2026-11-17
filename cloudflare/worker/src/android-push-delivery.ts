// Android FCM HTTP v1 delivery. No provider credentials are stored in source.
type Fetcher = typeof fetch;
type Value = string | number | null;
interface Result<T = Record<string, unknown>> {
  success: boolean;
  results?: T[];
  meta?: { changes?: number };
}
interface Statement {
  bind(...values: Value[]): Statement;
  all<T = Record<string, unknown>>(): Promise<Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<Result>;
}
interface DeliveryDb {
  prepare(sql: string): Statement;
}
export interface AndroidPushEnv {
  DB: DeliveryDb;
  FIREBASE_PROJECT_ID?: string;
  FCM_SERVICE_ACCOUNT_JSON?: string;
  PUSH_TOKEN_ENCRYPTION_KEY?: string;
}
interface Job {
  device_id: string;
  user_id: string;
  token_hash: string;
  event_kind: "notification" | "message";
  event_id: string;
  attempts: number;
}
interface Destination {
  encrypted_token: string;
  conversation_id: string | null;
  locale: string | null;
}
interface Credentials {
  project_id: string;
  client_email: string;
  private_key: string;
}
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_ATTEMPTS = 5;
const MAX_JOBS = 20;

function credentials(env: AndroidPushEnv): Credentials | null {
  if (!env.FCM_SERVICE_ACCOUNT_JSON || !env.PUSH_TOKEN_ENCRYPTION_KEY) return null;
  try {
    const parsed = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON) as Partial<Credentials>;
    if (
      typeof parsed.project_id !== "string" ||
      !/^[a-z0-9][a-z0-9-]{3,62}$/.test(parsed.project_id) ||
      parsed.project_id !== env.FIREBASE_PROJECT_ID ||
      typeof parsed.client_email !== "string" ||
      !parsed.client_email.endsWith(".iam.gserviceaccount.com") ||
      typeof parsed.private_key !== "string" ||
      !parsed.private_key.includes("BEGIN PRIVATE KEY") ||
      env.PUSH_TOKEN_ENCRYPTION_KEY.length < 32
    )
      return null;
    return parsed as Credentials;
  } catch {
    return null;
  }
}

function encode64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
function decode64(text: string): Uint8Array<ArrayBuffer> {
  const normal = text.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(normal), (letter) => letter.charCodeAt(0));
}
function encodedJson(value: unknown): string {
  return encode64(new TextEncoder().encode(JSON.stringify(value)));
}

async function getAccessToken(account: Credentials, request: Fetcher): Promise<string> {
  const privateKeyBytes = decode64(
    account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const claim = [
    encodedJson({ alg: "RS256", typ: "JWT" }),
    encodedJson({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: TOKEN_URL,
      iat: now,
      exp: now + 300,
    }),
  ].join(".");
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(claim),
  );
  const response = await request(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: claim + "." + encode64(new Uint8Array(signature)),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("fcm_authorization_failed");
  const data = (await response.json()) as { access_token?: string };
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new Error("fcm_invalid_access_token");
  }
  return data.access_token;
}

async function decryptToken(payload: string, secret: string): Promise<string> {
  const bytes = decode64(payload);
  if (bytes.length < 29) throw new Error("invalid_token_ciphertext");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["decrypt"]);
  const token = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, 12) },
    key,
    bytes.slice(12),
  );
  return new TextDecoder().decode(token);
}

function jobKey(job: Job): Value[] {
  return [job.device_id, job.event_kind, job.event_id];
}

// Recheck ownership, token rotation, permission, notification category and
// unread state immediately before contacting FCM. Never send notification text.
async function destination(db: DeliveryDb, job: Job): Promise<Destination | null> {
  return db
    .prepare(
      `SELECT d.encrypted_token, d.locale, m.conversation_id
      FROM push_devices d
      JOIN public_profiles u ON u.id = d.user_id AND u.account_status = 'active'
      JOIN notification_preferences p ON p.user_id = d.user_id
      LEFT JOIN notifications n ON n.id = ? AND n.user_id = d.user_id
      LEFT JOIN conversation_messages m ON m.id = ?
      LEFT JOIN conversations c ON c.id = m.conversation_id
      WHERE d.id = ? AND d.user_id = ? AND d.token_hash = ?
        AND d.platform = 'android' AND d.active = 1 AND d.permission_status = 'granted'
        AND p.push_enabled = 1 AND (
          (? = 'message' AND m.id IS NOT NULL AND m.sender_id <> d.user_id
            AND m.deleted_at IS NULL AND m.read_at IS NULL AND c.status = 'active'
            AND d.user_id IN (c.buyer_id, c.seller_id) AND p.messages_enabled = 1)
          OR (? = 'notification' AND n.id IS NOT NULL AND n.read_at IS NULL
            AND CASE
              WHEN n.type GLOB 'offer.*' THEN p.messages_enabled
              WHEN n.type GLOB 'price.*' OR n.type = 'listing.price_changed' THEN p.price_changes_enabled
              WHEN n.type GLOB 'saved_search.*' THEN p.saved_search_matches_enabled
              WHEN n.type GLOB 'listing.*' THEN p.listing_status_enabled
              WHEN n.type GLOB 'review.*' THEN p.reviews_enabled
              WHEN n.type GLOB 'promotion.*' THEN p.promotions_enabled
              ELSE 0 END = 1)
        )`,
    )
    .bind(
      job.event_id,
      job.event_id,
      job.device_id,
      job.user_id,
      job.token_hash,
      job.event_kind,
      job.event_kind,
    )
    .first<Destination>();
}

async function finish(
  db: DeliveryDb,
  job: Job,
  lease: string,
  status: "sent" | "pending" | "cancelled" | "failed",
  next: string,
  error: string | null,
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE push_delivery_jobs SET status = ?, next_attempt_at = ?, last_error = ?, lease_id = NULL
      WHERE device_id = ? AND event_kind = ? AND event_id = ? AND lease_id = ?`,
    )
    .bind(status, next, error, ...jobKey(job), lease)
    .run();
  if (!result.success) throw new Error("push_delivery_state_write_failed");
}

// FCM may accept a request whose response is lost. Exactly-once remote
// delivery is not guaranteed; the Android tag replaces retries of the same event.
export async function deliverAndroidPush(
  env: AndroidPushEnv,
  timestamp: string,
  request: Fetcher = fetch,
): Promise<void> {
  const account = credentials(env);
  if (!account) return;
  const now = Date.parse(timestamp);
  if (!Number.isFinite(now)) throw new Error("invalid_push_delivery_time");
  const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const retention = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM push_delivery_jobs WHERE created_at < ?").bind(retention).run();
  await env.DB.prepare(
    `UPDATE push_delivery_jobs SET status = 'cancelled', lease_id = NULL, last_error = 'expired'
      WHERE status IN ('pending', 'sending') AND (created_at < ? OR attempts >= ?)
        AND next_attempt_at <= ?`,
  )
    .bind(cutoff, MAX_ATTEMPTS, timestamp)
    .run();

  const due = await env.DB.prepare(
    `SELECT device_id, user_id, token_hash, event_kind, event_id, attempts
      FROM push_delivery_jobs
      WHERE status IN ('pending', 'sending') AND next_attempt_at <= ?
        AND created_at >= ? AND attempts < ?
      ORDER BY next_attempt_at, created_at, device_id, event_id LIMIT ?`,
  )
    .bind(timestamp, cutoff, MAX_ATTEMPTS, MAX_JOBS)
    .all<Job>();
  if (!due.success) throw new Error("push_delivery_read_failed");
  if (!due.results?.length) return;
  const accessToken = await getAccessToken(account, request);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  for (const job of due.results) {
    const lease = crypto.randomUUID();
    const leaseUntil = new Date(now + 5 * 60 * 1000).toISOString();
    const claimed = await env.DB.prepare(
      `UPDATE push_delivery_jobs SET status = 'sending', lease_id = ?,
        next_attempt_at = ?, attempts = attempts + 1
        WHERE device_id = ? AND event_kind = ? AND event_id = ?
          AND status IN ('pending', 'sending') AND next_attempt_at <= ? AND attempts = ?`,
    )
      .bind(lease, leaseUntil, ...jobKey(job), timestamp, job.attempts)
      .run();
    if (!claimed.success || claimed.meta?.changes !== 1) continue;
    const retry = new Date(now + Math.min(60, 2 ** (job.attempts + 1)) * 60 * 1000).toISOString();
    try {
      const target = await destination(env.DB, job);
      if (!target) {
        await finish(env.DB, job, lease, "cancelled", timestamp, "destination_inactive");
        continue;
      }
      const token = await decryptToken(target.encrypted_token, env.PUSH_TOKEN_ENCRYPTION_KEY!);
      const english = target.locale?.toLowerCase().startsWith("en");
      const data =
        job.event_kind === "message" && target.conversation_id
          ? { conversation_id: target.conversation_id }
          : { notification_id: job.event_id };
      const response = await request(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            data,
            notification: {
              title: english ? "Rawaj" : "رواج",
              body: english ? "You have a new update." : "لديك تحديث جديد.",
            },
            android: {
              ttl: "3600s",
              priority: "HIGH",
              notification: {
                channel_id: "rawaj_activity",
                tag: `rawaj-${job.event_kind}-${job.event_id}`,
              },
            },
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        await finish(env.DB, job, lease, "sent", timestamp, null);
        continue;
      }
      const payload = (await response.json().catch(() => null)) as {
        error?: { details?: Array<{ errorCode?: string }> };
      } | null;
      const unregistered = payload?.error?.details?.some(
        (detail) => detail.errorCode === "UNREGISTERED",
      );
      if (unregistered) {
        await env.DB.prepare(
          "UPDATE push_devices SET active = 0 WHERE id = ? AND user_id = ? AND token_hash = ?",
        )
          .bind(job.device_id, job.user_id, job.token_hash)
          .run();
        await finish(env.DB, job, lease, "cancelled", timestamp, "token_unregistered");
      } else {
        await finish(
          env.DB,
          job,
          lease,
          job.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending",
          retry,
          `fcm_http_${response.status}`,
        );
      }
    } catch {
      await finish(
        env.DB,
        job,
        lease,
        job.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending",
        retry,
        "push_delivery_retryable_error",
      );
    }
  }
}
