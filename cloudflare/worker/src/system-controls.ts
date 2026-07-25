import {
  authenticate,
  corsHeaders,
  json,
  readJson,
  requireMutationAuth,
  type AuthEnv,
} from "./auth";

type Value = string | number | null;
interface Statement {
  bind(...values: Value[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
interface Database { prepare(query: string): Statement }

export interface SystemControlsEnv {
  DB: Database;
  API_ALLOWED_ORIGINS?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_AUTH_TEST_JWKS?: string;
  FIREBASE_JWKS_URL?: string;
}

const CONTROL_KEYS = [
  "freeze_new_listings",
  "freeze_new_messages",
  "freeze_promotions",
  "freeze_verifications",
  "maintenance_mode",
  "emergency_read_only",
] as const;

function asAuthEnv(env: SystemControlsEnv): AuthEnv { return env as unknown as AuthEnv }

export async function handleSystemControls(
  request: Request,
  env: SystemControlsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\b/, "/v1");
  if (path !== "/v1/admin/system-controls") return null;
  const cors = corsHeaders(request, asAuthEnv(env));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  if (request.method === "GET") {
    const auth = await authenticate(request, asAuthEnv(env));
    if (!auth) return unauthorized(cors);
    if (!auth.roles.includes("owner")) return forbidden(cors);
    return json(
      {
        data: CONTROL_KEYS.map((key) => ({
          key,
          enabled: false,
          reason: "",
          version: 1,
          updatedBy: "system-default",
          updatedAt: "",
        })),
      },
      200,
      cors,
    );
  }

  if (request.method === "POST" || request.method === "PATCH") {
    const auth = await requireMutationAuth(request, asAuthEnv(env), cors);
    if (auth instanceof Response) return auth;
    if (!auth.roles.includes("owner")) return forbidden(cors);
    const body = await readJson(request);
    if (!body.ok) return json({ error: body.error }, body.status, cors);
    return json(
      {
        error: {
          code: "setup_required",
          message: "System control persistence is not enabled in the current D1 schema.",
        },
      },
      503,
      cors,
    );
  }

  return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
}

function unauthorized(cors: Headers): Response {
  return json({ error: { code: "auth_required", message: "Authentication required." } }, 401, cors);
}
function forbidden(cors: Headers): Response {
  return json({ error: { code: "permission_denied", message: "Owner permission required." } }, 403, cors);
}
