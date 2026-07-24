import type { User } from "@supabase/supabase-js";
import type { UserProfile } from "@/lib/auth-types";
import { requireCloudflarePublicApiBaseUrl } from "@/lib/public-data/config";
import { supabase } from "@/lib/supabase";

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

  const session = await supabase?.auth.getSession();
  const initialToken = session?.data.session?.access_token ?? null;
  const first = await sendRequest<T>(base.data, path, init, initialToken);
  if (first.response.status !== 401 || !initialToken || !supabase) return first.result;

  const refreshed = await supabase.auth.refreshSession();
  const refreshedToken = refreshed.data.session?.access_token ?? null;
  if (refreshed.error || !refreshedToken) {
    await supabase.auth.signOut({ scope: "local" });
    return first.result;
  }

  return (await sendRequest<T>(base.data, path, init, refreshedToken)).result;
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

export async function loadCloudflareUserProfile(user: User): Promise<UserProfile> {
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
  return {
    ...result.data,
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
