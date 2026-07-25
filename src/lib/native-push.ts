import type { PluginListenerHandle } from "@capacitor/core";
import { disablePushDevice, registerPushDevice } from "@/lib/api/push-notifications";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { firebaseAuth } from "@/lib/firebase";
import { notificationOpenPath } from "@/lib/notification-target-path";
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
  locale: string,
  requestPermission = true,
): Promise<ClassifiedsResult<NativePushRegistration>> {
  const actorResult = await currentPushAccount();
  if (!actorResult.ok) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتفعيل الإشعارات الفورية." },
    };
  }
  const accountSnapshot = actorResult.data;

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
      if (deviceKey) await disableNativePush(false);
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

    await ensureNativePushListeners(accountSnapshot);
    const tokenResult = await waitForRegistrationToken(PushNotifications);
    if (!tokenResult.ok) return tokenResult;

    const currentActor = await currentPushAccount();
    if (!currentActor.ok) return currentActor;
    if (currentActor.data !== accountSnapshot) return stalePushAccountError();

    const registration = await registerPushDevice({
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
  disableChannel = true,
): Promise<ClassifiedsResult<boolean>> {
  const deviceKey = getOrCreatePushDeviceKey();
  const localCleanup = unregisterNativePushLocally();

  try {
    const result = await disablePushDevice(deviceKey, disableChannel);
    const locallyUnregistered = await localCleanup;
    if (result.ok || locallyUnregistered) return { ok: true, data: true };
    return result;
  } catch (error) {
    const locallyUnregistered = await localCleanup;
    if (locallyUnregistered) return { ok: true, data: true };
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "تعذر فصل هذا الجهاز عن الإشعارات الفورية.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function initializeNativePush(
  locale: string,
): Promise<ClassifiedsResult<NativePushRegistration>> {
  return enableNativePush(locale, false);
}

export async function resetNativePushSession(): Promise<void> {
  await clearNativePushListeners();
}

export async function clearLocalNativePushState(): Promise<void> {
  await unregisterNativePushLocally();
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PUSH_DEVICE_KEY_STORAGE);
  } catch {
    // Logout must still complete when browser storage is unavailable.
  }
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
        const data = event.notification.data;
        window.location.assign(notificationOpenPath(data?.notification_id));
      },
    );

    activeListenerHandles = [received, action];
    activeListenerUserId = userId;
  })().finally(() => {
    listenerSetup = null;
  });

  return listenerSetup;
}

async function unregisterNativePushLocally(): Promise<boolean> {
  let unregistered = false;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister();
    unregistered = true;
  } catch {
    // The authenticated RPC remains authoritative outside the native runtime.
  }
  await clearNativePushListeners();
  return unregistered;
}

async function clearNativePushListeners(): Promise<void> {
  const handles = activeListenerHandles;
  activeListenerHandles = [];
  activeListenerUserId = null;
  await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
}

async function currentPushAccount(): Promise<ClassifiedsResult<string>> {
  const userId = firebaseAuth.currentUser?.uid?.trim();
  return userId
    ? { ok: true, data: userId }
    : {
        ok: false,
        error: { code: "auth_required", message: "يجب تسجيل الدخول لإدارة الإشعارات الفورية." },
      };
}

function stalePushAccountError<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: "permission_denied",
      message: "تغيّر الحساب أثناء إعداد الإشعارات. أعد المحاولة من الحساب الحالي.",
    },
  };
}
