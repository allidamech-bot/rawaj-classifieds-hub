import type { UserProfile } from "@/lib/auth-types";
import { requireCloudflarePublicApiBaseUrl } from "@/lib/public-data/config";

export interface CloudflareSession {
  user: { id: string; email: string; emailConfirmed: boolean };
  profile: { id: string; displayName: string | null; roles: string[] };
  csrfToken: string;
}

type Envelope<T> = { data?: T; error?: { code?: string; message?: string } };

let csrfToken = "";

export function cloudflareApiUrl(path: string): string {
  const base = requireCloudflarePublicApiBaseUrl();
  return base.ok ? new URL(path, `${base.data}/`).toString() : path;
}

export async function cloudflareApiRequest<T>(
  path: string,
  init: { method?: string; body?: Record<string, unknown> | FormData } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; code: string }> {
  const base = requireCloudflarePublicApiBaseUrl();
  if (!base.ok) return { ok: false, error: base.error.message, code: base.error.code };
  const isForm = init.body instanceof FormData;
  try {
    const response = await fetch(new URL(path, `${base.data}/`), {
      method: init.method ?? "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(!isForm && init.body ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: isForm ? (init.body as FormData) : init.body ? JSON.stringify(init.body) : undefined,
    });
    const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
    if (!response.ok || payload?.data === undefined) {
      return {
        ok: false,
        error: payload?.error?.message ?? "تعذر إكمال العملية.",
        code: payload?.error?.code ?? "unknown",
      };
    }
    return { ok: true, data: payload.data };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالخدمة.", code: "network_error" };
  }
}

export async function authSession(): Promise<CloudflareSession | null> {
  const result = await authRequest<{ session: CloudflareSession | null }>(
    "/v1/auth/session",
    "GET",
  );
  if (!result.ok) throw new Error(result.error);
  csrfToken = result.data.session?.csrfToken ?? "";
  return result.data.session;
}

export async function authLogin(email: string, password: string) {
  return authMutation("/v1/auth/login", { email, password });
}

export async function authSignup(email: string, password: string, displayName: string) {
  return authMutation("/v1/auth/signup", { email, password, displayName });
}

export async function authLogout() {
  return authMutation("/v1/auth/logout", {});
}

export async function authRequestPasswordReset(email: string) {
  return authMutation("/v1/auth/password-reset/request", { email });
}

export async function authConfirmPasswordReset(token: string, password: string) {
  return authMutation("/v1/auth/password-reset/confirm", { token, password });
}

export async function authChangePassword(currentPassword: string, password: string) {
  return authMutation("/v1/auth/password/change", { currentPassword, password });
}

async function authMutation(path: string, body: Record<string, unknown>) {
  const result = await authRequest<{
    session?: CloudflareSession;
    accepted?: boolean;
    developmentToken?: string;
    success?: boolean;
  }>(path, "POST", body);
  if (result.ok && result.data.session) csrfToken = result.data.session.csrfToken;
  return result;
}

async function authRequest<T>(
  path: string,
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string; code: string }> {
  const base = requireCloudflarePublicApiBaseUrl();
  if (!base.ok) return { ok: false, error: base.error.message, code: base.error.code };
  try {
    const response = await fetch(new URL(path, `${base.data}/`), {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
    if (!response.ok || payload?.data === undefined) {
      return {
        ok: false,
        error: payload?.error?.message ?? "تعذر إكمال العملية.",
        code: payload?.error?.code ?? "unknown",
      };
    }
    return { ok: true, data: payload.data };
  } catch {
    return { ok: false, error: "تعذر الاتصال بخدمة الحسابات.", code: "network_error" };
  }
}

export function sessionToProfile(session: CloudflareSession): UserProfile {
  const roles = session.profile.roles.filter((role) =>
    ["owner", "admin", "moderator", "seller", "user"].includes(role),
  ) as UserProfile["roles"];
  const normalizedRoles: UserProfile["roles"] = roles.length ? roles : ["user"];
  const role =
    (["owner", "admin", "moderator", "seller", "user"] as const).find((item) =>
      normalizedRoles.includes(item),
    ) ?? "user";
  return {
    id: session.user.id,
    email: session.user.email,
    firstName: null,
    lastName: null,
    displayName: session.profile.displayName,
    role,
    roles: normalizedRoles,
    accountStatus: "active",
    verificationStatus: "unverified",
    governorate: null,
    cityArea: null,
    bio: null,
    businessName: null,
    phone: null,
    whatsapp: null,
    preferredContactMethod: null,
    avatarPath: null,
    avatarUrl: null,
    coverPath: null,
    coverUrl: null,
    createdAt: null,
    updatedAt: null,
  };
}

export async function loadCloudflareUserProfile(session: CloudflareSession): Promise<UserProfile> {
  const baseProfile = sessionToProfile(session);
  const result = await cloudflareApiRequest<{
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
    verificationStatus: UserProfile["verificationStatus"];
    accountStatus: UserProfile["accountStatus"];
    createdAt: string | null;
    updatedAt: string | null;
  }>("/api/profile");
  return result.ok ? { ...baseProfile, ...result.data } : baseProfile;
}
