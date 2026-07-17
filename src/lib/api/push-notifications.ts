import {
  getAuthenticatedUserId,
  getClient,
  mapError,
  rowBoolean,
  rowNullableString,
  rowString,
} from "@/lib/api/shared";
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
  deviceKey: string,
): Promise<ClassifiedsResult<PushChannelStatus>> {
  const cleanDeviceKey = normalizeDeviceKey(deviceKey);
  if (!cleanDeviceKey) return validationError("تعذر تحديد هذا الجهاز.");

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { data, error } = await clientResult.data.rpc("rawaj_get_push_channel_status_v1", {
    p_device_key: cleanDeviceKey,
  });
  if (error) return { ok: false, error: mapError(error) };

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) return { ok: true, data: emptyPushStatus() };
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
  payload: RegisterPushDevicePayload,
): Promise<ClassifiedsResult<string>> {
  const deviceKey = normalizeDeviceKey(payload.deviceKey);
  const deviceToken = payload.deviceToken.trim();
  if (!deviceKey || deviceToken.length < 20 || deviceToken.length > 4096) {
    return validationError("تعذر تسجيل هذا الجهاز للإشعارات.");
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { data, error } = await clientResult.data.rpc("rawaj_upsert_push_device_v1", {
    p_device_key: deviceKey,
    p_device_token: deviceToken,
    p_platform: normalizePlatform(payload.platform),
    p_permission_status: normalizePermission(payload.permissionStatus),
    p_app_version: payload.appVersion?.trim().slice(0, 80) || null,
    p_locale: payload.locale?.trim().slice(0, 20) || null,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: typeof data === "string" ? data : "" };
}

export async function disablePushDevice(
  deviceKey: string,
  disableChannel = true,
): Promise<ClassifiedsResult<boolean>> {
  const cleanDeviceKey = normalizeDeviceKey(deviceKey);
  if (!cleanDeviceKey) return validationError("تعذر تحديد هذا الجهاز.");

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { data, error } = await clientResult.data.rpc("rawaj_disable_push_device_v1", {
    p_device_key: cleanDeviceKey,
    p_disable_channel: disableChannel,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: data === true };
}

function normalizeDeviceKey(value: string): string | null {
  const clean = value.trim();
  return clean.length >= 8 && clean.length <= 200 ? clean : null;
}

function normalizePlatform(value: string): "android" | "ios" | "web" {
  return value === "ios" || value === "web" ? value : "android";
}

function normalizePermission(value: string): "granted" | "denied" | "prompt" {
  return value === "granted" || value === "denied" ? value : "prompt";
}

function emptyPushStatus(): PushChannelStatus {
  return {
    pushEnabled: false,
    registered: false,
    permissionStatus: "prompt",
    platform: "android",
    lastSeenAt: null,
  };
}

function validationError<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}
