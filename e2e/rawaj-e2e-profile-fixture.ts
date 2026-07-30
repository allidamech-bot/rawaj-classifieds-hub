import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const FIXTURE_USER_ID = "00000000-0000-4000-8000-000000000020";
const RESET_HEADER = "x-rawaj-e2e-reset";
const RESET_PATH = "/__rawaj_e2e__/profile/reset";
const INITIAL_TIMESTAMP = "2026-07-30T12:00:00.000Z";
const UPDATED_TIMESTAMP = "2026-07-30T16:00:00.000Z";

interface FixtureProfile extends Record<string, unknown> {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  businessName: string | null;
  bio: string | null;
  governorate: string | null;
  cityArea: string | null;
  phone: string | null;
  whatsapp: string | null;
  preferredContactMethod: string | null;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  accountStatus: "active" | "suspended" | "deactivated";
  roles: string[];
  avatarUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export function createRawajE2eProfileFixturePlugin(): Plugin {
  let profile = initialProfile();

  function resetFixture(): void {
    profile = initialProfile();
  }

  return {
    name: "rawaj-e2e-profile-fixture",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const method = request.method ?? "GET";
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const path = url.pathname;

        if (method === "POST" && path === RESET_PATH) {
          await drainBody(request);
          if (request.headers[RESET_HEADER] !== "1") {
            sendJson(
              response,
              { error: { code: "permission_denied", message: "Fixture reset denied." } },
              403,
            );
            return;
          }
          resetFixture();
          sendJson(response, { data: { success: true } });
          return;
        }

        const handled =
          path === "/api/profile" || path === "/v1/profile" || path === "/v1/account/verifications";

        if (!handled) {
          next();
          return;
        }

        if (method === "OPTIONS") {
          sendEmpty(response, 204);
          return;
        }

        if (request.headers.authorization !== `Bearer ${FIXTURE_TOKEN}`) {
          sendJson(
            response,
            { error: { code: "auth_required", message: "Fixture authorization required." } },
            401,
          );
          return;
        }

        if (method === "GET" && path === "/api/profile") {
          sendJson(response, { data: profile });
          return;
        }

        if (method === "PATCH" && path === "/v1/profile") {
          const body = await readJsonBody(request);
          profile = {
            ...profile,
            firstName: nullableText(body.firstName),
            lastName: nullableText(body.lastName),
            displayName: nullableText(body.displayName),
            businessName: nullableText(body.businessName),
            bio: nullableText(body.bio),
            governorate: nullableText(body.governorate),
            cityArea: nullableText(body.cityArea),
            phone: nullableText(body.phone),
            whatsapp: nullableText(body.whatsapp),
            preferredContactMethod: nullableText(body.preferredContactMethod),
            updatedAt: UPDATED_TIMESTAMP,
          };
          sendJson(response, { data: profile });
          return;
        }

        if (method === "GET" && path === "/v1/account/verifications") {
          sendJson(response, { data: [] });
          return;
        }

        sendJson(
          response,
          { error: { code: "not_found", message: "Fixture profile route was not found." } },
          404,
        );
      });
    },
  };
}

function initialProfile(): FixtureProfile {
  return {
    id: FIXTURE_USER_ID,
    email: "browser-smoke@rawa-j.test",
    firstName: "مستخدم",
    lastName: "تجريبي",
    displayName: "مستخدم رواج التجريبي",
    businessName: null,
    bio: null,
    governorate: "دمشق",
    cityArea: null,
    phone: null,
    whatsapp: null,
    preferredContactMethod: "chat",
    verificationStatus: "unverified",
    accountStatus: "active",
    roles: ["user"],
    avatarUrl: null,
    coverUrl: null,
    createdAt: INITIAL_TIMESTAMP,
    updatedAt: INITIAL_TIMESTAMP,
  };
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readBody(request);
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function drainBody(request: IncomingMessage): Promise<void> {
  await readBody(request);
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendEmpty(response: ServerResponse, statusCode: number): void {
  response.statusCode = statusCode;
  setCorsHeaders(response);
  response.end();
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  response.statusCode = statusCode;
  setCorsHeaders(response);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Request-Id", "00000000-0000-4000-8000-000000000095");
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
}
