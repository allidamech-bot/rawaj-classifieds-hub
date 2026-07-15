import { getClient, mapError, rowBoolean, rowNullableString, rowString } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

export interface PushChannelStatus {
  pushEnabled: boolean;
  registered: boolean;
  permissionStatus: "granted" | "denied" | "prompt";
  platform: "android" | "ios" | "web";
  lastSeenAt: string | null;
}

export interface RegisterPushDevicePayload {
  deviceKey: string;
  deviceToken: string;
  platform: "android" | "ios" | "web";
  permissionStatus: "granted" | "denied" | "prompt";
  appVersion?: string | null;
  locale?: string | null;
}

export async function fetchPushChannelStatus(
  userId: string | null,
  deviceKey: string,
): Promise<ClassifiedsResult<PushChannelStatus>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض حالة الإشعارات الفورية." },
    };
  }

  const cleanDeviceKey = deviceKey.trim();
  if (!cleanDeviceKey) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد هذا الجهاز." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_get_push_channel_status_v1", {
    p_device_key: cleanDeviceKey,
  });
  if (error) return { ok: false, error: mapError(error) };

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) {
    return {
      ok: true,
      data: {
        pushEnabled: false,
        registered: false,
        permissionStatus: "prompt",
        platform: "android",
        lastSeenAt: null,
      },
    };
  }

  const permission = rowString(row, "permission_status", "prompt");
  const platform = rowString(row, "platform", "android");
  return {
    ok: true,
    data: {
      pushEnabled: rowBoolean(row, "push_enabled", false),
      registered: rowBoolean(row, "registered", false),
      permissionStatus: permission === "granted" || permission === "denied" ? permission : "prompt",
      platform: platform === "ios" || platform === "web" ? platform : "android",
      lastSeenAt: rowNullableString(row, "last_seen_at"),
    },
  };
}

export async function registerPushDevice(
  userId: string | null,
  payload: RegisterPushDevicePayload,
): Promise<ClassifiedsResult<string>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتفعيل الإشعارات الفورية." },
    };
  }

  const deviceKey = payload.deviceKey.trim();
  const deviceToken = payload.deviceToken.trim();
  if (deviceKey.length < 8 || deviceToken.length < 20) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تسجيل هذا الجهاز للإشعارات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_upsert_push_device_v1", {
    p_device_key: deviceKey,
    p_device_token: deviceToken,
    p_platform: payload.platform,
    p_permission_status: payload.permissionStatus,
    p_app_version: payload.appVersion?.trim() || null,
    p_locale: payload.locale?.trim() || null,
  });
  if (error) return { ok: false, error: mapError(error) };

  return { ok: true, data: typeof data === "string" ? data : "" };
}

export async function disablePushDevice(
  userId: string | null,
  deviceKey: string,
  disableChannel = true,
): Promise<ClassifiedsResult<boolean>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإيقاف الإشعارات الفورية." },
    };
  }

  const cleanDeviceKey = deviceKey.trim();
  if (!cleanDeviceKey) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد هذا الجهاز." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_disable_push_device_v1", {
    p_device_key: cleanDeviceKey,
    p_disable_channel: disableChannel,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: data === true };
}
