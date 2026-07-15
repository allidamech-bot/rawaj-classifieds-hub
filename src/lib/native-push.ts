import type { PluginListenerHandle } from "@capacitor/core";
import { disablePushDevice, registerPushDevice } from "@/lib/api/push-notifications";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";

const PUSH_DEVICE_KEY_STORAGE = "rawaj:native-push-device-key:v1";
const REGISTRATION_TIMEOUT_MS = 15_000;

let activeListenerUserId: string | null = null;
let activeListenerHandles: PluginListenerHandle[] = [];
let listenerSetup: Promise<void> | null = null;

export interface NativePushCapability {
  available: boolean;
  platform: "android" | "ios" | "web";
}

export interface NativePushRegistration {
  deviceKey: string;
  permissionStatus: "granted" | "denied" | "prompt";
  registered: boolean;
}

export function getOrCreatePushDeviceKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(PUSH_DEVICE_KEY_STORAGE)?.trim();
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `rawaj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(PUSH_DEVICE_KEY_STORAGE, generated);
    return generated;
  } catch {
    return `rawaj-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export async function getNativePushCapability(): Promise<NativePushCapability> {
  if (typeof window === "undefined") return { available: false, platform: "web" };
  try {
    const { Capacitor } = await import("@capacitor/core");
    const platform = Capacitor.getPlatform();
    return {
      available: Capacitor.isNativePlatform() && (platform === "android" || platform === "ios"),
      platform: platform === "android" || platform === "ios" ? platform : "web",
    };
  } catch {
    return { available: false, platform: "web" };
  }
}

export async function enableNativePush(
  userId: string | null,
  locale: string,
  requestPermission = true,
): Promise<ClassifiedsResult<NativePushRegistration>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتفعيل الإشعارات الفورية." },
    };
  }

  const capability = await getNativePushCapability();
  if (!capability.available) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "الإشعارات الفورية متاحة من تطبيق رواج على الهاتف فقط.",
      },
    };
  }

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === "prompt" && requestPermission) {
      permission = await PushNotifications.requestPermissions();
    }

    const deviceKey = getOrCreatePushDeviceKey();
    if (permission.receive !== "granted") {
      if (deviceKey) await disablePushDevice(userId, deviceKey, true);
      return {
        ok: true,
        data: {
          deviceKey,
          permissionStatus: permission.receive === "denied" ? "denied" : "prompt",
          registered: false,
        },
      };
    }

    if (capability.platform === "android") {
      await PushNotifications.createChannel({
        id: "rawaj_activity",
        name: "تنبيهات رواج",
        description: "الرسائل ونتائج البحث وتحديثات الحساب",
        importance: 4,
        vibration: true,
      });
    }

    await ensureNativePushListeners(userId);
    const tokenResult = await waitForRegistrationToken(PushNotifications);
    if (!tokenResult.ok) return tokenResult;

    const registration = await registerPushDevice(userId, {
      deviceKey,
      deviceToken: tokenResult.data,
      platform: capability.platform,
      permissionStatus: "granted",
      appVersion: null,
      locale,
    });
    if (!registration.ok) return registration;

    return {
      ok: true,
      data: { deviceKey, permissionStatus: "granted", registered: true },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "setup_required",
        message: "تعذر تهيئة الإشعارات الفورية على هذا الجهاز.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function disableNativePush(
  userId: string | null,
  disableChannel = true,
): Promise<ClassifiedsResult<boolean>> {
  const deviceKey = getOrCreatePushDeviceKey();
  const result = await disablePushDevice(userId, deviceKey, disableChannel);
  if (result.ok) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.unregister();
    } catch {
      // Database unlink remains authoritative when the native plugin is unavailable.
    }
    await clearNativePushListeners();
  }
  return result;
}

export async function initializeNativePush(
  userId: string | null,
  locale: string,
): Promise<ClassifiedsResult<NativePushRegistration>> {
  return enableNativePush(userId, locale, false);
}

async function waitForRegistrationToken(
  PushNotifications: typeof import("@capacitor/push-notifications").PushNotifications,
): Promise<ClassifiedsResult<string>> {
  let registrationHandle: PluginListenerHandle | null = null;
  let errorHandle: PluginListenerHandle | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  return new Promise<ClassifiedsResult<string>>((resolve) => {
    let finished = false;
    const finish = (result: ClassifiedsResult<string>) => {
      if (finished) return;
      finished = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      void registrationHandle?.remove();
      void errorHandle?.remove();
      resolve(result);
    };

    void (async () => {
      registrationHandle = await PushNotifications.addListener("registration", (token) => {
        const value = token.value?.trim();
        if (!value) {
          finish({
            ok: false,
            error: { code: "unknown", message: "لم يُرجع الهاتف رمز الإشعارات." },
          });
          return;
        }
        finish({ ok: true, data: value });
      });

      errorHandle = await PushNotifications.addListener("registrationError", (error) => {
        finish({
          ok: false,
          error: {
            code: "unknown",
            message: "فشل تسجيل الهاتف للإشعارات الفورية.",
            details: JSON.stringify(error),
          },
        });
      });

      timeoutHandle = setTimeout(() => {
        finish({
          ok: false,
          error: { code: "unknown", message: "انتهت مهلة تسجيل الإشعارات على الهاتف." },
        });
      }, REGISTRATION_TIMEOUT_MS);

      await PushNotifications.register();
    })().catch((error) => {
      finish({
        ok: false,
        error: {
          code: "unknown",
          message: "فشل بدء تسجيل الإشعارات الفورية.",
          details: error instanceof Error ? error.message : String(error),
        },
      });
    });
  });
}

async function ensureNativePushListeners(userId: string): Promise<void> {
  if (activeListenerUserId === userId && activeListenerHandles.length > 0) return;
  if (listenerSetup) return listenerSetup;

  listenerSetup = (async () => {
    await clearNativePushListeners();
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const received = await PushNotifications.addListener("pushNotificationReceived", () => {
      emitUnreadActivityChanged();
    });
    const action = await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (event) => {
        emitUnreadActivityChanged();
        if (typeof window === "undefined") return;
        window.location.assign(resolvePushTarget(event.notification.data));
      },
    );

    activeListenerHandles = [received, action];
    activeListenerUserId = userId;
  })().finally(() => {
    listenerSetup = null;
  });

  return listenerSetup;
}

async function clearNativePushListeners(): Promise<void> {
  const handles = activeListenerHandles;
  activeListenerHandles = [];
  activeListenerUserId = null;
  await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
}

function resolvePushTarget(data: Record<string, unknown> | undefined): string {
  const targetType = typeof data?.target_type === "string" ? data.target_type : "";
  const targetId = typeof data?.target_id === "string" ? data.target_id : "";

  if (targetType === "listing" && targetId) return `/listings/${encodeURIComponent(targetId)}`;
  if (targetType === "saved_search") return "/saved-searches";
  if ((targetType === "conversation" || targetType === "chat") && targetId) {
    return `/chats?conversation=${encodeURIComponent(targetId)}`;
  }
  return "/notifications";
}
