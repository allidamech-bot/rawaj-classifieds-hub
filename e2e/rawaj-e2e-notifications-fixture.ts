import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const RESET_HEADER = "x-rawaj-e2e-reset";
const RESET_PATH = "/__rawaj_e2e__/notifications/reset";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000041";
const ACCOUNT_NOTIFICATION_ID = "00000000-0000-4000-8000-000000000051";
const CONVERSATION_NOTIFICATION_ID = "00000000-0000-4000-8000-000000000052";
const REMINDER_NOTIFICATION_ID = "00000000-0000-4000-8000-000000000053";
const MARK_ONE_READ_AT = "2026-07-30T13:30:00.000Z";
const MARK_ALL_CUTOFF = "2026-07-30T14:00:00.000Z";

interface FixtureNotification {
  id: string;
  type: string;
  titleAr: string;
  titleEn: string | null;
  bodyAr: string | null;
  bodyEn: string | null;
  targetType:
    | "listing"
    | "conversation"
    | "seller"
    | "saved_search"
    | "owner_listing"
    | "support"
    | "verification"
    | "promotion"
    | null;
  targetId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface FixtureNotificationPreferences extends Record<string, unknown> {
  pushEnabled: boolean;
  messagesEnabled: boolean;
  priceChangesEnabled: boolean;
  savedSearchMatchesEnabled: boolean;
  listingStatusEnabled: boolean;
  reviewsEnabled: boolean;
  promotionsEnabled: boolean;
  updatedAt: string | null;
}

export function createRawajE2eNotificationsFixturePlugin(): Plugin {
  const notifications: FixtureNotification[] = [];
  let preferences = initialPreferences();

  function resetFixture(): void {
    notifications.splice(0, notifications.length, ...initialNotifications());
    preferences = initialPreferences();
  }

  resetFixture();

  return {
    name: "rawaj-e2e-notifications-fixture",
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

        const itemMatch = path.match(/^\/v1\/account\/notifications\/([^/]+)$/);
        const handled =
          path === "/v1/account/notifications" ||
          path === "/v1/account/notifications/unread-count" ||
          path === "/v1/account/notifications/read-all" ||
          path === "/v1/account/notification-preferences" ||
          Boolean(itemMatch);

        if (!handled) {
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

        if (path === "/v1/account/notification-preferences") {
          if (method === "GET") {
            sendJson(response, { data: preferences });
            return;
          }
          if (method === "PATCH") {
            const body = await readJsonBody(request);
            const key = typeof body.key === "string" ? body.key : "";
            const enabled = body.enabled === true;
            if (key && key in preferences && key !== "pushEnabled" && key !== "updatedAt") {
              preferences = {
                ...preferences,
                [key]: enabled,
                updatedAt: MARK_ONE_READ_AT,
              };
            }
            sendJson(response, { data: preferences });
            return;
          }
        }

        if (method === "GET" && path === "/v1/account/notifications") {
          sendJson(response, {
            data: {
              items: [...notifications],
              nextCursor: null,
              hasMore: false,
            },
          });
          return;
        }

        if (method === "GET" && path === "/v1/account/notifications/unread-count") {
          sendJson(response, { data: unreadCount(notifications) });
          return;
        }

        if (method === "POST" && path === "/v1/account/notifications/read-all") {
          await drainBody(request);
          let updatedCount = 0;
          for (const notification of notifications) {
            if (notification.readAt) continue;
            notification.readAt = MARK_ALL_CUTOFF;
            updatedCount += 1;
          }
          sendJson(response, {
            data: { cutoff: MARK_ALL_CUTOFF, updatedCount },
          });
          return;
        }

        if (itemMatch) {
          const notificationId = decodeURIComponent(itemMatch[1] ?? "");
          const notification = notifications.find((item) => item.id === notificationId) ?? null;

          if (method === "GET") {
            sendJson(response, { data: notification });
            return;
          }

          if (method === "PATCH") {
            await drainBody(request);
            if (!notification) {
              sendJson(
                response,
                { error: { code: "not_found", message: "Fixture notification was not found." } },
                404,
              );
              return;
            }
            if (!notification.readAt) notification.readAt = MARK_ONE_READ_AT;
            sendJson(response, { data: null });
            return;
          }
        }

        sendJson(
          response,
          { error: { code: "not_found", message: "Fixture notification route was not found." } },
          404,
        );
      });
    },
  };
}

function initialNotifications(): FixtureNotification[] {
  return [
    {
      id: ACCOUNT_NOTIFICATION_ID,
      type: "account.updated",
      titleAr: "تم تحديث إعدادات حسابك",
      titleEn: "Your account settings were updated",
      bodyAr: "يمكنك مراجعة إعدادات التواصل والخصوصية في أي وقت.",
      bodyEn: "You can review contact and privacy settings at any time.",
      targetType: null,
      targetId: null,
      readAt: null,
      createdAt: "2026-07-30T13:00:00.000Z",
    },
    {
      id: CONVERSATION_NOTIFICATION_ID,
      type: "message.received",
      titleAr: "لديك رسالة جديدة من سارة",
      titleEn: "You have a new message from Sara",
      bodyAr: "افتح المحادثة المرتبطة بإعلان السيارة التجريبية.",
      bodyEn: "Open the conversation linked to the test vehicle listing.",
      targetType: "conversation",
      targetId: CONVERSATION_ID,
      readAt: null,
      createdAt: "2026-07-30T12:55:00.000Z",
    },
    {
      id: REMINDER_NOTIFICATION_ID,
      type: "account.reminder",
      titleAr: "تذكير بإكمال معلومات الحساب",
      titleEn: "Complete your account information",
      bodyAr: "أضف معلوماتك الأساسية لتحسين تجربة البيع والشراء.",
      bodyEn: "Add your basic information to improve buying and selling.",
      targetType: null,
      targetId: null,
      readAt: null,
      createdAt: "2026-07-30T12:50:00.000Z",
    },
  ];
}

function initialPreferences(): FixtureNotificationPreferences {
  return {
    pushEnabled: false,
    messagesEnabled: true,
    priceChangesEnabled: true,
    savedSearchMatchesEnabled: true,
    listingStatusEnabled: true,
    reviewsEnabled: true,
    promotionsEnabled: true,
    updatedAt: null,
  };
}

function unreadCount(notifications: FixtureNotification[]): number {
  return notifications.reduce((count, notification) => count + (notification.readAt ? 0 : 1), 0);
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

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Request-Id", "00000000-0000-4000-8000-000000000098");
  response.end(JSON.stringify(payload));
}
