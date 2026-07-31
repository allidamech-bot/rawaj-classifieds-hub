import { corsHeaders, json, requireMutationAuth, type AuthEnv } from "./auth";

type Value = string | number | null;
interface Result {
  success: boolean;
}
interface Statement {
  bind(...values: Value[]): Statement;
  run(): Promise<Result>;
}
interface Database {
  prepare(query: string): Statement;
}

export interface PushDeviceSessionEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
}

const PERMISSION_STATUSES = new Set(["granted", "denied", "prompt"]);

export async function handlePushDeviceSession(
  request: Request,
  env: PushDeviceSessionEnv,
): Promise<Response | null> {
  if (request.method !== "DELETE") return null;
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/v1\/account\/push-devices\/([^/]+)$/);
  if (!match) return null;

  const cors = corsHeaders(request, env as unknown as AuthEnv);
  const auth = await requireMutationAuth(request, env as unknown as AuthEnv, cors);
  if (auth instanceof Response) return auth;

  const deviceKey = decodeURIComponent(match[1] ?? "").trim();
  if (deviceKey.length < 8 || deviceKey.length > 200) {
    return validation(cors, "Invalid device key.");
  }

  const rawPermissionStatus = url.searchParams.get("permissionStatus");
  if (rawPermissionStatus !== null && !PERMISSION_STATUSES.has(rawPermissionStatus)) {
    return validation(cors, "Invalid push permission status.");
  }
  const permissionStatus = rawPermissionStatus;
  const disableChannel = url.searchParams.get("disableChannel") !== "false";
  const deviceKeyHash = await sha256Hex(deviceKey);
  const timestamp = new Date().toISOString();

  const result = await env.DB.prepare(
    `UPDATE push_devices SET active = 0,
      permission_status = COALESCE(?, permission_status),
      last_seen_at = ?, updated_at = ?
      WHERE user_id = ? AND device_key_hash = ?`,
  )
    .bind(permissionStatus, timestamp, timestamp, auth.userId, deviceKeyHash)
    .run();
  if (!result.success) return databaseError(cors);

  if (disableChannel) {
    const preference = await env.DB.prepare(
      `INSERT INTO notification_preferences
        (user_id, push_enabled, messages_enabled, listing_updates_enabled, marketing_enabled, updated_at)
       VALUES (?, 0, 1, 1, 0, ?)
       ON CONFLICT(user_id) DO UPDATE SET push_enabled = 0, updated_at = excluded.updated_at`,
    )
      .bind(auth.userId, timestamp)
      .run();
    if (!preference.success) return databaseError(cors);
  }

  return json({ data: true }, 200, cors);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validation(cors: Headers, message: string): Response {
  return json({ error: { code: "validation_error", message } }, 400, cors);
}

function databaseError(cors: Headers): Response {
  return json(
    { error: { code: "database_unavailable", message: "Data service unavailable." } },
    503,
    cors,
  );
}
