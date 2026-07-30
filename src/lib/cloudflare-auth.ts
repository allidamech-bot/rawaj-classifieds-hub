import type { UserProfile } from "@/lib/auth-types";
import type { AuthUser } from "@/lib/auth-context";
import type { User as FirebaseUser } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { requireCloudflarePublicApiBaseUrl } from "@/lib/public-data/config";

type Envelope<T> = { data?: T; error?: { code?: string; message?: string } };
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code: string };
const forcedTokenRefreshes = new Map<string, Promise<string>>();

function isCurrentFirebaseUser(user: FirebaseUser): boolean {
  return firebaseAuth.currentUser?.uid === user.uid;
}

async function getFreshFirebaseToken(user: FirebaseUser): Promise<string> {
  const existing = forcedTokenRefreshes.get(user.uid);
  if (existing) return existing;

  const refresh = user.getIdToken(true);
  forcedTokenRefreshes.set(user.uid, refresh);
  try {
    return await refresh;
  } finally {
    if (forcedTokenRefreshes.get(user.uid) === refresh) {
      forcedTokenRefreshes.delete(user.uid);
    }
  }
}

export function cloudflareApiUrl(path: string): string {
  const base = requireCloudflarePublicApiBaseUrl();
  return base.ok ? new URL(path, `${base.data}/`).toString() : path;
}

export async function cloudflareAuthorizedFetch(
  path: string,
  init: { method?: string; body?: BodyInit | null; headers?: Record<string, string> } = {},
): Promise<Response | null> {
  const base = requireCloudflarePublicApiBaseUrl();
  if (!base.ok) return null;
  const currentUser = firebaseAuth.currentUser;
  let initialToken: string | null = null;
  try {
    initialToken = currentUser ? await currentUser.getIdToken() : null;
  } catch {
    return null;
  }
  const first = await sendAuthorizedFetch(base.data, path, init, initialToken);
  if (first?.status !== 401 || !currentUser || !isCurrentFirebaseUser(currentUser)) return first;
  try {
    const refreshedToken = await getFreshFirebaseToken(currentUser);
    if (!isCurrentFirebaseUser(currentUser)) return first;
    return await sendAuthorizedFetch(base.data, path, init, refreshedToken);
  } catch {
    return first;
  }
}

async function sendAuthorizedFetch(
  base: string,
  path: string,
  init: { method?: string; body?: BodyInit | null; headers?: Record<string, string> },
  accessToken: string | null,
): Promise<Response | null> {
  try {
    return await fetch(new URL(path, `${base}/`), {
      method: init.method ?? "GET",
      credentials: "omit",
      headers: {
        Accept: "*/*",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init.headers ?? {}),
      },
      body: init.body ?? undefined,
    });
  } catch {
    return null;
  }
}

export async function cloudflareApiRequest<T>(
  path: string,
  init: { method?: string; body?: Record<string, unknown> | FormData } = {},
): Promise<ApiResult<T>> {
  const base = requireCloudflarePublicApiBaseUrl();
  if (!base.ok) return { ok: false, error: base.error.message, code: base.error.code };

  const currentUser = firebaseAuth.currentUser;
  let initialToken: string | null = null;
  try {
    initialToken = currentUser ? await currentUser.getIdToken() : null;
  } catch {
    return {
      ok: false,
      error: "تعذر تحديث جلسة تسجيل الدخول. حاول مرة أخرى.",
      code: "auth_token_unavailable",
    };
  }
  const first = await sendRequest<T>(base.data, path, init, initialToken);
  if (first.response.status !== 401 || !currentUser || !isCurrentFirebaseUser(currentUser)) {
    return first.result;
  }

  try {
    const refreshedToken = await getFreshFirebaseToken(currentUser);
    if (!isCurrentFirebaseUser(currentUser)) return first.result;
    return (await sendRequest<T>(base.data, path, init, refreshedToken)).result;
  } catch {
    return {
      ok: false,
      error: "تعذر تحديث جلسة تسجيل الدخول. حاول مرة أخرى.",
      code: "auth_token_unavailable",
    };
  }
}

async function sendRequest<T>(
  base: string,
  path: string,
  init: { method?: string; body?: Record<string, unknown> | FormData },
  accessToken: string | null,
): Promise<{ response: Response; result: ApiResult<T> }> {
  const body = init.body;
  const isForm = body instanceof FormData;
  const jsonBody = !isForm && body ? JSON.stringify(body) : undefined;
  try {
    const response = await fetch(new URL(path, `${base}/`), {
      method: init.method ?? "GET",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(!isForm && body ? { "Content-Type": "application/json" } : {}),
      },
      body: isForm ? body : jsonBody,
    });
    const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
    const result: ApiResult<T> =
      response.ok && payload?.data !== undefined
        ? { ok: true, data: payload.data }
        : {
            ok: false,
            error: payload?.error?.message ?? "تعذر إكمال العملية.",
            code: payload?.error?.code ?? "unknown",
          };
    return { response, result };
  } catch {
    return {
      response: new Response(null, { status: 599 }),
      result: { ok: false, error: "تعذر الاتصال بالخدمة.", code: "network_error" },
    };
  }
}

function looksLikeCorruptedArabic(value: string | null): boolean {
  if (!value) return false;
  if (value.includes("�") || /[ÃÂØÙÐÑ]/.test(value)) return true;
  const compact = value.replace(/\s+/g, "");
  const suspiciousArabicMarkers = [...compact].filter(
    (character) => character === "ط" || character === "ظ",
  ).length;
  return compact.length >= 5 && suspiciousArabicMarkers >= 3;
}

function repairWindows1256Mojibake(value: string): string {
  if (!/[طظ]/.test(value)) return value;
  try {
    const encoded = new TextEncoder().encode(value);
    const decoded = new TextDecoder("windows-1256").decode(encoded);
    const roundTrip = new TextEncoder().encode(decoded);
    if (roundTrip.length === encoded.length && decoded !== value) return decoded;
  } catch {
    // ignore
  }
  return value;
}

function firebaseIdentityDisplayName(user: AuthUser): string | null {
  return user.user_metadata.display_name?.trim() || user.user_metadata.full_name?.trim() || null;
}

function accountDisplayNameFallback(
  user: AuthUser,
  firstName: string | null,
  lastName: string | null,
): string | null {
  const firebaseName = firebaseIdentityDisplayName(user);
  if (firebaseName && !looksLikeCorruptedArabic(firebaseName)) return firebaseName;

  const storedName = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ");
  if (storedName) {
    const repaired = repairWindows1256Mojibake(storedName);
    if (repaired !== storedName || !looksLikeCorruptedArabic(repaired)) return repaired;
  }

  const email = user.email?.trim();
  if (!email) return null;
  const localPart = email.split("@", 1)[0]?.trim();
  return localPart || null;
}

export function resolveDisplayName(
  profile: UserProfile | null,
  email: string | null | undefined,
  text: (ar: string, en: string) => string,
): string {
  if (!profile) return text("حساب رواج", "RAWAJ account");
  const candidates = [
    profile.businessName,
    profile.displayName,
    profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : null,
    profile.firstName,
    profile.lastName,
    email,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const repaired = repairWindows1256Mojibake(candidate);
    if (repaired && !looksLikeCorruptedArabic(repaired)) return repaired;
  }
  const localPart = email?.split("@", 1)[0]?.trim();
  if (localPart) return localPart;
  return text("حساب رواج", "RAWAJ account");
}

export async function loadCloudflareUserProfile(user: AuthUser): Promise<UserProfile> {
  const result = await cloudflareApiRequest<{
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
    verificationStatus: UserProfile["verificationStatus"];
    accountStatus: UserProfile["accountStatus"];
    roles?: UserProfile["roles"];
    avatarUrl?: string | null;
    coverUrl?: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>("/api/profile");
  if (!result.ok) throw new Error(result.error);

  const roles = (result.data.roles?.length ? result.data.roles : ["user"]) as UserProfile["roles"];
  const role =
    (["owner", "admin", "moderator", "seller", "user"] as const).find((item) =>
      roles.includes(item),
    ) ?? "user";
  const fallbackDisplayName = accountDisplayNameFallback(
    user,
    result.data.firstName,
    result.data.lastName,
  );
  const displayName =
    !result.data.displayName || looksLikeCorruptedArabic(result.data.displayName)
      ? fallbackDisplayName
      : result.data.displayName;

  return {
    ...result.data,
    displayName,
    preferredContactMethod:
      result.data.preferredContactMethod === "chat"
        ? "messages"
        : result.data.preferredContactMethod,
    id: result.data.id || user.id,
    email: result.data.email || user.email || "",
    role,
    roles,
    avatarPath: null,
    avatarUrl: result.data.avatarUrl ? cloudflareApiUrl(result.data.avatarUrl) : null,
    coverPath: null,
    coverUrl: result.data.coverUrl ? cloudflareApiUrl(result.data.coverUrl) : null,
  };
}
