import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const dataQualityRpcNames = new Set([
  "rawaj_admin_fetch_data_quality_context_v1",
  "rawaj_admin_fetch_listing_data_quality_v1",
  "rawaj_owner_refresh_listing_data_quality_v1",
  "rawaj_admin_review_listing_data_quality_v1",
]);
const dataQualityCapabilityTtlMs = 30_000;
let dataQualityCapabilityCache: { ready: boolean; expiresAt: number } | null = null;
let dataQualityCapabilityRequest: Promise<boolean> | null = null;

function hasUsableEnvValue(value: string | undefined, placeholder: string) {
  return Boolean(value && value.trim() && value.trim() !== placeholder);
}

const hasSupabaseUrl = hasUsableEnvValue(supabaseUrl, "https://YOUR_PROJECT_REF.supabase.co");
const hasSupabaseAnonKey = hasUsableEnvValue(supabaseAnonKey, "YOUR_SUPABASE_ANON_KEY");

export const isSupabaseConfigured = hasSupabaseUrl && hasSupabaseAnonKey;

function unavailableDataQualityResult() {
  return {
    data: null,
    error: {
      code: "RAWAJ_FEATURE_UNAVAILABLE",
      message:
        "مركز جودة البيانات متوقف مؤقتاً حتى اكتمال نشر قاعدة البيانات الخاصة به. بقية لوحة الإدارة تعمل بشكل طبيعي.",
      details: "data_quality_runtime_not_ready",
      hint: "Complete the governed Data Quality schema cutover before retrying.",
    },
    count: null,
    status: 503,
    statusText: "Service Unavailable",
  };
}

async function isDataQualityRuntimeReady(client: SupabaseClient): Promise<boolean> {
  const now = Date.now();
  if (dataQualityCapabilityCache && dataQualityCapabilityCache.expiresAt > now) {
    return dataQualityCapabilityCache.ready;
  }
  if (dataQualityCapabilityRequest) return dataQualityCapabilityRequest;

  dataQualityCapabilityRequest = (async () => {
    const { data, error } = await client.rpc("rawaj_admin_runtime_capabilities_v1");
    const ready =
      !error &&
      Boolean(
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        (data as Record<string, unknown>).dataQualityReady === true,
      );
    dataQualityCapabilityCache = {
      ready,
      expiresAt: Date.now() + dataQualityCapabilityTtlMs,
    };
    return ready;
  })().finally(() => {
    dataQualityCapabilityRequest = null;
  });

  return dataQualityCapabilityRequest;
}

function withAdminRuntimeGuards(client: SupabaseClient): SupabaseClient {
  const originalRpc = client.rpc.bind(client);

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property !== "rpc") return Reflect.get(target, property, receiver);

      return ((functionName: string, args?: Record<string, unknown>, options?: unknown) => {
        if (!dataQualityRpcNames.has(functionName)) {
          return originalRpc(functionName as never, args as never, options as never);
        }

        return (async () => {
          const ready = await isDataQualityRuntimeReady(client);
          if (!ready) return unavailableDataQualityResult();
          return originalRpc(functionName as never, args as never, options as never);
        })();
      }) as SupabaseClient["rpc"];
    },
  }) as SupabaseClient;
}

const authenticatedSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabase: SupabaseClient | null = authenticatedSupabase
  ? withAdminRuntimeGuards(authenticatedSupabase)
  : null;

/**
 * Public marketplace reads must not inherit or wait on an account session.
 * This client never persists or refreshes authentication and therefore keeps
 * public ad placements stable while sign-in state is being established.
 */
export const publicSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "rawaj-public-read-client",
      },
    })
  : null;

export function getSupabaseAuthUnavailableReason() {
  if (isSupabaseConfigured) return null;
  if (!hasSupabaseUrl && !hasSupabaseAnonKey) {
    return "تعذر الوصول إلى خدمة الحسابات والبيانات الآن. التصفح العام متاح ويمكنك المحاولة مرة أخرى.";
  }

  if (!hasSupabaseUrl) {
    return "تعذر الوصول إلى اتصال Supabase الآن. التصفح العام متاح ويمكنك المحاولة مرة أخرى.";
  }

  return "تعذر الوصول إلى خدمة الحسابات الآن. يمكنك تصفح رَوَاج والمحاولة مرة أخرى.";
}
