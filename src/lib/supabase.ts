import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { installPasswordRecoverySessionBridge } from "@/lib/auth-recovery-session";
import { listingImagesBucket } from "@/lib/api/storage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const disableRemoteMediaForE2E = import.meta.env.VITE_RAWAJ_E2E_DISABLE_REMOTE_MEDIA === "1";

const dataQualityRpcNames = new Set([
  "rawaj_admin_fetch_data_quality_context_v1",
  "rawaj_admin_fetch_listing_data_quality_v1",
  "rawaj_owner_refresh_listing_data_quality_v1",
  "rawaj_admin_review_listing_data_quality_v1",
]);
const dataQualityCapabilityTtlMs = 30_000;
let dataQualityCapabilityCache: { ready: boolean; expiresAt: number } | null = null;
let dataQualityCapabilityRequest: Promise<boolean> | null = null;

type StorageBucketApi = ReturnType<SupabaseClient["storage"]["from"]>;
type SignedUrlBatchResult = Awaited<ReturnType<StorageBucketApi["createSignedUrls"]>>;
type SignedUrlEntry = NonNullable<SignedUrlBatchResult["data"]>[number];

const signedUrlExpirySafetyMs = 60_000;

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

function serializeSignedUrlOptions(options: unknown) {
  try {
    return JSON.stringify(options ?? null) ?? "null";
  } catch {
    return "unserializable";
  }
}

function withListingImageSignedUrlCache(client: SupabaseClient): SupabaseClient {
  const signedUrlCache = new Map<string, { item: SignedUrlEntry; expiresAt: number }>();
  const signedUrlBatchRequests = new Map<string, Promise<SignedUrlBatchResult>>();

  client.auth.onAuthStateChange(() => {
    signedUrlCache.clear();
    signedUrlBatchRequests.clear();
  });

  const storageProxy = new Proxy(client.storage, {
    get(storageTarget, property) {
      if (property !== "from") {
        const value = Reflect.get(storageTarget, property, storageTarget);
        return typeof value === "function" ? value.bind(storageTarget) : value;
      }

      return (bucketId: string) => {
        const bucket = storageTarget.from(bucketId);
        if (bucketId !== listingImagesBucket) return bucket;

        const originalCreateSignedUrls = bucket.createSignedUrls.bind(bucket);

        return new Proxy(bucket, {
          get(bucketTarget, bucketProperty) {
            if (bucketProperty !== "createSignedUrls") {
              const value = Reflect.get(bucketTarget, bucketProperty, bucketTarget);
              return typeof value === "function" ? value.bind(bucketTarget) : value;
            }

            const cachedCreateSignedUrls: StorageBucketApi["createSignedUrls"] = async (
              paths,
              expiresIn,
              options,
            ) => {
              const normalizedPaths = [...new Set(paths.filter(Boolean))];

              if (disableRemoteMediaForE2E) {
                return {
                  data: normalizedPaths.map((path) => ({ path, signedUrl: "", error: null })),
                  error: null,
                } as unknown as SignedUrlBatchResult;
              }

              const optionsKey = serializeSignedUrlOptions(options);
              const now = Date.now();
              const resolvedByPath = new Map<string, SignedUrlEntry>();
              const missingPaths: string[] = [];

              for (const path of normalizedPaths) {
                const cacheKey = `${expiresIn}:${optionsKey}:${path}`;
                const cached = signedUrlCache.get(cacheKey);
                if (cached && cached.expiresAt > now) {
                  resolvedByPath.set(path, cached.item);
                } else {
                  if (cached) signedUrlCache.delete(cacheKey);
                  missingPaths.push(path);
                }
              }

              if (missingPaths.length > 0) {
                const requestKey = `${expiresIn}:${optionsKey}:${[...missingPaths].sort().join("\n")}`;
                let request = signedUrlBatchRequests.get(requestKey);

                if (!request) {
                  request = originalCreateSignedUrls(missingPaths, expiresIn, options).finally(() => {
                    signedUrlBatchRequests.delete(requestKey);
                  });
                  signedUrlBatchRequests.set(requestKey, request);
                }

                const result = await request;
                if (result.error || !result.data) return result;

                const expiresAt =
                  Date.now() + Math.max(0, expiresIn * 1_000 - signedUrlExpirySafetyMs);

                for (const item of result.data) {
                  if (!item.path) continue;
                  resolvedByPath.set(item.path, item);
                  if (item.signedUrl) {
                    const cacheKey = `${expiresIn}:${optionsKey}:${item.path}`;
                    signedUrlCache.set(cacheKey, { item, expiresAt });
                  }
                }
              }

              const data = normalizedPaths
                .map((path) => resolvedByPath.get(path))
                .filter((item): item is SignedUrlEntry => Boolean(item));

              return { data, error: null } as SignedUrlBatchResult;
            };

            return cachedCreateSignedUrls;
          },
        });
      };
    },
  });

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "storage") return storageProxy;
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
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

installPasswordRecoverySessionBridge(authenticatedSupabase);

export const supabase: SupabaseClient | null = authenticatedSupabase
  ? withAdminRuntimeGuards(withListingImageSignedUrlCache(authenticatedSupabase))
  : null;

/**
 * Public marketplace reads must not inherit or wait on an account session.
 * This client never persists or refreshes authentication and therefore keeps
 * public ad placements stable while sign-in state is being established.
 */
const unauthenticatedPublicSupabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "rawaj-public-read-client",
      },
    })
  : null;

export const publicSupabase: SupabaseClient | null = unauthenticatedPublicSupabase
  ? withListingImageSignedUrlCache(unauthenticatedPublicSupabase)
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
