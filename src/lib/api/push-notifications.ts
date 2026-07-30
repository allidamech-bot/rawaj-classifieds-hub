import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export type PushPermissionStatus = "granted" | "denied" | "prompt";
export type PushPlatform = "android" | "ios" | "web";

export interface PushChannelStatus {
  pushEnabled: boolean;
  registered: boolean;
  permissionStatus: PushPermissionStatus;
  platform: PushPlatform;
  lastSeenAt: string | null;
}

export interface RegisterPushDevicePayload {
  deviceKey: string;
  deviceToken: string;
  platform: PushPlatform;
  permissionStatus: PushPermissionStatus;
  appVersion?: string | null;
  locale?: string | null;
}

export async function fetchPushChannelStatus(
  deviceKey: string,
): Promise<ClassifiedsResult<PushChannelStatus>> {
  const cleanDeviceKey = normalizeDeviceKey(deviceKey);
  if (!cleanDeviceKey) return validationError("تعذر تحديد هذا الجهاز.");
  const result = await cloudflareApiRequest<PushChannelStatus>(
    `/v1/account/push-devices/status?deviceKey=${encodeURIComponent(cleanDeviceKey)}`,
  );
  return result.ok ? { ok: true, data: normalizeStatus(result.data) } : apiFailure(result);
}

export async function registerPushDevice(
  payload: RegisterPushDevicePayload,
): Promise<ClassifiedsResult<string>> {
  const deviceKey = normalizeDeviceKey(payload.deviceKey);
  const deviceToken = payload.deviceToken.trim();
  if (!deviceKey || deviceToken.length < 20 || deviceToken.length > 4096) {
    return validationError("تعذر تسجيل هذا الجهاز للإشعارات.");
  }
  const result = await cloudflareApiRequest<string>("/v1/account/push-devices", {
    method: "POST",
    body: {
      deviceKey,
      deviceToken,
      platform: normalizePlatform(payload.platform),
      permissionStatus: normalizePermission(payload.permissionStatus),
      appVersion: payload.appVersion?.trim().slice(0, 80) || null,
      locale: payload.locale?.trim().slice(0, 20) || null,
    },
  });
  return result.ok ? { ok: true, data: result.data } : apiFailure(result);
}

export async function disablePushDevice(
  deviceKey: string,
  disableChannel = true,
  permissionStatus?: PushPermissionStatus,
): Promise<ClassifiedsResult<boolean>> {
  const cleanDeviceKey = normalizeDeviceKey(deviceKey);
  if (!cleanDeviceKey) return validationError("تعذر تحديد هذا الجهاز.");
  const query = new URLSearchParams({ disableChannel: String(disableChannel) });
  if (permissionStatus) query.set("permissionStatus", normalizePermission(permissionStatus));
  const result = await cloudflareApiRequest<boolean>(
    `/v1/account/push-devices/${encodeURIComponent(cleanDeviceKey)}?${query.toString()}`,
    { method: "DELETE" },
  );
  return result.ok ? { ok: true, data: result.data === true } : apiFailure(result);
}

function normalizeDeviceKey(value: string): string | null {
  const clean = value.trim();
  return clean.length >= 8 && clean.length <= 200 ? clean : null;
}
function normalizePlatform(value: string): PushPlatform {
  return value === "ios" || value === "web" ? value : "android";
}
function normalizePermission(value: string): PushPermissionStatus {
  return value === "granted" || value === "denied" ? value : "prompt";
}
function normalizeStatus(value: PushChannelStatus): PushChannelStatus {
  return {
    pushEnabled: Boolean(value.pushEnabled),
    registered: Boolean(value.registered),
    permissionStatus: normalizePermission(value.permissionStatus),
    platform: normalizePlatform(value.platform),
    lastSeenAt: typeof value.lastSeenAt === "string" ? value.lastSeenAt : null,
  };
}
function validationError<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}
function apiFailure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}
