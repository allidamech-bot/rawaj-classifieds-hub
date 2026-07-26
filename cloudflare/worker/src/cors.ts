export interface CorsEnv {
  API_ALLOWED_ORIGINS?: string;
}

const OFFICIAL_ORIGINS = ["https://rawa-j.com", "https://www.rawa-j.com"] as const;

export function corsHeadersForRequest(request: Request, env: CorsEnv): Headers {
  return corsHeadersForOrigin(request.headers.get("Origin"), env);
}

export function corsHeadersForOrigin(origin: string | null, env: CorsEnv): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Idempotency-Key, If-None-Match",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });

  if (!origin) return headers;

  const allowed = new Set<string>(OFFICIAL_ORIGINS);
  for (const configuredOrigin of (env.API_ALLOWED_ORIGINS ?? "").split(",")) {
    const normalizedOrigin = configuredOrigin.trim();
    if (normalizedOrigin) allowed.add(normalizedOrigin);
  }

  if (allowed.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}
