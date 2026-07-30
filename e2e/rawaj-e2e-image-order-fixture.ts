import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const FIXTURE_TIMESTAMP = "2026-07-30T12:00:10.000Z";
const FIXTURE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'%3E%3Crect width='640' height='480' fill='%23242a30'/%3E%3C/svg%3E";

export function createRawajE2eImageOrderFixturePlugin(): Plugin {
  return {
    name: "rawaj-e2e-image-order-fixture",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const method = request.method ?? "GET";
        const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        const match = path.match(/^\/v1\/listings\/([^/]+)\/images$/);
        if (method !== "PATCH" || !match) {
          next();
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

        const listingId = decodeURIComponent(match[1] ?? "");
        const body = await readJsonBody(request);
        const imageIds = Array.isArray(body.imageIds)
          ? body.imageIds.filter((value): value is string => typeof value === "string" && value.length > 0)
          : [];
        if (!listingId || imageIds.length === 0 || new Set(imageIds).size !== imageIds.length) {
          sendJson(
            response,
            { error: { code: "validation_error", message: "Invalid fixture image order." } },
            400,
          );
          return;
        }

        sendJson(response, {
          data: imageIds.map((id, sortOrder) => ({
            id,
            listingId,
            storagePath: null,
            publicUrl: FIXTURE_IMAGE,
            signedUrlExpiresIn: null,
            altAr: "صورة إعلان تجريبية",
            sortOrder,
            createdAt: FIXTURE_TIMESTAMP,
          })),
        });
      });
    },
  };
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Request-Id", "00000000-0000-4000-8000-000000000098");
  response.end(JSON.stringify(payload));
}
