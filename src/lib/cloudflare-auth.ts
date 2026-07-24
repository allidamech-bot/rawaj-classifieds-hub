import type { UserProfile } from "@/lib/auth-types";
import type { AuthUser } from "@/lib/auth-context";
import { firebaseAuth } from "@/lib/firebase";
import { requireCloudflarePublicApiBaseUrl } from "@/lib/public-data/config";

type Envelope<T> = { data?: T; error?: { code?: string; message?: string } };
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

export function cloudflareApiUrl(path: string): string {
  const base = requireCloudflarePublicApiBaseUrl();
  return base.ok ? new URL(path, `${base.data}/`).toString() : path;
}

export async function cloudflareApiRequest<T>(
  path: string,
  init: { method?: string; body?: Record<string, unknown> | FormData } = {},
): Promise<ApiResult<T>> {
  const base = requireCloudflarePublicApiBaseUrl();
  if (!base.ok) return { ok: false, error: base.error.message, code: base.error.code };

  const currentUser = firebaseAuth.currentUser;
  const initialToken = currentUser ? await currentUser.getIdToken() : null;
  const first = await sendRequest<T>(base.data, path, init, initialToken);
  if (first.response.status !== 401 || !currentUser) return first.result;

  try {
    const refreshedToken = await currentUser.getIdToken(true);
    return (await sendRequest<T>(base.data, path, init, refreshedToken)).result;
  } catch {
    await firebaseAuth.signOut().catch(() => undefined);
    return first.result;
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
  const suspiciousArabicMarkers = [...compact].filter((character) => character === "ط" || character === "ظ").length;
  return compact.length >= 5 && suspiciousArabicMarkers >= 3;
}

function firebaseIdentityDisplayName(user: AuthUser): string | null {
  return (
    user.user_metadata.display_name?.trim() ||
    user.user_metadata.full_name?.trim() ||
    null
  );
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
    createdAt: string | null;
    updatedAt: string | null;
  }>("/api/profile");
  if (!result.ok) throw new Error(result.error);

  const roles = (result.data.roles?.length ? result.data.roles : ["user"]) as UserProfile["roles"];
  const role =
    (["owner", "admin", "moderator", "seller", "user"] as const).find((item) =>
      roles.includes(item),
    ) ?? "user";
  const identityDisplayName = firebaseIdentityDisplayName(user);
  const displayName =
    looksLikeCorruptedArabic(result.data.displayName) && identityDisplayName
      ? identityDisplayName
      : result.data.displayName;

  return {
    ...result.data,
    displayName,
    id: result.data.id || user.id,
    email: result.data.email || user.email || "",
    role,
    roles,
    avatarPath: null,
    avatarUrl: null,
    coverPath: null,
    coverUrl: null,
  };
}
