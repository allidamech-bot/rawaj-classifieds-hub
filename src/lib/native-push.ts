import type { PluginListenerHandle } from "@capacitor/core";
import {
  disablePushDevice,
  registerPushDevice,
  type PushPermissionStatus,
  type PushPlatform,
} from "@/lib/api/push-notifications";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { firebaseAuth } from "@/lib/firebase";
import { notificationOpenPath } from "@/lib/notification-target-path";
import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";

const PUSH_DEVICE_KEY_STORAGE = "rawaj:native-push-device-key:v1";
const REGISTRATION_TIMEOUT_MS = 15_000;

let activeListenerUserId: string | null = null;
let activeListenerHandles: PluginListenerHandle[] = [];
let listenerSetup: Promise<void> | null = null;
let nativePushGeneration = 0;
let registrationSyncKey: string | null = null;
let registrationSync: Promise<ClassifiedsResult<string>> | null = null;
const lastTokenHashByUser = new Map<string, string>();

export interface NativePushCapability {
  available: boolean;
  platform: PushPlatform;
}

export interface NativePushRegistration {
  deviceKey: string;
  permissionStatus: PushPermissionStatus;
  registered: boolean;
}

interface PushRegistrationContext {
  userId: string;
  locale: string;
  platform: PushPlatform;
  generation: number;
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
      const permissionStatus: PushPermissionStatus =
        permission.receive === "denied" ? "denied" : "prompt";
      await invalidateNativePushSession();
      await disablePushDevice(deviceKey, false, permissionStatus);
      await unregisterNativePushLocally();
      return {
        ok: true,
        data: { deviceKey, permissionStatus, registered: false },
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

    const context = await ensureNativePushListeners(accountSnapshot, locale, capability.platform);
    const tokenResult = await waitForRegistrationToken(PushNotifications);
    if (!tokenResult.ok) return tokenResult;

    const registration = await syncRegistrationToken(tokenResult.data, context);
    if (!registration.ok) return registration;

    const currentActor = await currentPushAccount();
    if (!currentActor.ok) return currentActor;
    if (currentActor.data !== accountSnapshot || context.generation !== nativePushGeneration) {
      return stalePushAccountError();
    }

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
  permissionStatus?: PushPermissionStatus,
): Promise<ClassifiedsResult<boolean>> {
  const actor = await currentPushAccount();
  if (!actor.ok) return actor;
  const deviceKey = getOrCreatePushDeviceKey();
  await invalidateNativePushSession();

  try {
    const result = await disablePushDevice(deviceKey, disableChannel, permissionStatus);
    await unregisterNativePushLocally();
    return result;
  } catch (error) {
    await unregisterNativePushLocally();
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

export async function detachNativePushBeforeSignOut(): Promise<ClassifiedsResult<boolean>> {
  const actor = await currentPushAccount();
  if (!actor.ok) return actor;
  const deviceKey = getOrCreatePushDeviceKey();
  await invalidateNativePushSession();

  const result = await disablePushDevice(deviceKey, false);
  if (!result.ok) return result;

  await unregisterNativePushLocally();
  return { ok: true, data: true };
}

export async function initializeNativePush(
  locale: string,
): Promise<ClassifiedsResult<NativePushRegistration>> {
  return enableNativePush(locale, false);
}

export async function resetNativePushSession(): Promise<void> {
  await invalidateNativePushSession();
}

export async function clearLocalNativePushState(): Promise<void> {
  await invalidateNativePushSession();
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

async function ensureNativePushListeners(
  userId: string,
  locale: string,
  platform: PushPlatform,
): Promise<PushRegistrationContext> {
  if (listenerSetup) await listenerSetup;
  if (activeListenerUserId === userId && activeListenerHandles.length > 0) {
    return { userId, locale, platform, generation: nativePushGeneration };
  }

  const generation = ++nativePushGeneration;
  listenerSetup = (async () => {
    await clearNativePushListeners();
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const context = { userId, locale, platform, generation };

    const registration = await PushNotifications.addListener("registration", (token) => {
      void syncRegistrationToken(token.value, context);
    });
    const received = await PushNotifications.addListener("pushNotificationReceived", () => {
      if (generation !== nativePushGeneration) return;
      emitUnreadActivityChanged();
    });
    const action = await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (event) => {
        if (generation !== nativePushGeneration) return;
        emitUnreadActivityChanged();
        if (typeof window === "undefined") return;
        const data = event.notification.data;
        window.location.assign(notificationOpenPath(data?.notification_id));
      },
    );

    const handles = [registration, received, action];
    if (generation !== nativePushGeneration || firebaseAuth.currentUser?.uid !== userId) {
      await Promise.all(handles.map((handle) => handle.remove().catch(() => undefined)));
      return;
    }

    activeListenerHandles = handles;
    activeListenerUserId = userId;
  })().finally(() => {
    listenerSetup = null;
  });

  await listenerSetup;
  return { userId, locale, platform, generation };
}

async function syncRegistrationToken(
  rawToken: string | null | undefined,
  context: PushRegistrationContext,
): Promise<ClassifiedsResult<string>> {
  const token = rawToken?.trim();
  if (!token || token.length < 20 || token.length > 4096) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تسجيل رمز الإشعارات لهذا الجهاز." },
    };
  }

  const tokenHash = await sha256Hex(token);
  if (
    context.generation !== nativePushGeneration ||
    firebaseAuth.currentUser?.uid !== context.userId
  ) {
    return stalePushAccountError();
  }
  if (lastTokenHashByUser.get(context.userId) === tokenHash) {
    return { ok: true, data: tokenHash };
  }

  const syncKey = `${context.userId}:${tokenHash}`;
  if (registrationSync && registrationSyncKey === syncKey) return registrationSync;

  const request = (async (): Promise<ClassifiedsResult<string>> => {
    if (
      context.generation !== nativePushGeneration ||
      firebaseAuth.currentUser?.uid !== context.userId
    ) {
      return stalePushAccountError();
    }

    const result = await registerPushDevice({
      deviceKey: getOrCreatePushDeviceKey(),
      deviceToken: token,
      platform: context.platform,
      permissionStatus: "granted",
      appVersion: null,
      locale: context.locale,
    });
    if (!result.ok) return result;

    if (
      context.generation !== nativePushGeneration ||
      firebaseAuth.currentUser?.uid !== context.userId
    ) {
      return stalePushAccountError();
    }
    lastTokenHashByUser.set(context.userId, tokenHash);
    return result;
  })();

  registrationSyncKey = syncKey;
  registrationSync = request;
  try {
    return await request;
  } finally {
    if (registrationSync === request) {
      registrationSync = null;
      registrationSyncKey = null;
    }
  }
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

async function invalidateNativePushSession(): Promise<void> {
  nativePushGeneration += 1;
  registrationSync = null;
  registrationSyncKey = null;
  await clearNativePushListeners();
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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
