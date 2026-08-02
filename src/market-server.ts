import rawajServer from "./server";

const saudiHostname = "sa.rawa-j.com";
const saudiOrigin = "https://rawaj-saudi-web.allidamech.workers.dev";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

function normalizeHostname(value: string | null) {
  return (value ?? "")
    .split(",", 1)[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function requestHostname(request: Request) {
  return (
    normalizeHostname(request.headers.get("x-forwarded-host")) ||
    normalizeHostname(request.headers.get("host")) ||
    normalizeHostname(new URL(request.url).hostname)
  );
}

function rewriteSaudiLocation(location: string, upstreamUrl: URL) {
  try {
    const resolved = new URL(location, upstreamUrl);
    if (resolved.hostname !== new URL(saudiOrigin).hostname) return location;
    resolved.protocol = "https:";
    resolved.host = saudiHostname;
    return resolved.toString();
  } catch {
    return location;
  }
}

async function proxySaudiRequest(request: Request): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, saudiOrigin);
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.set("x-forwarded-host", saudiHostname);
  headers.set("x-forwarded-proto", "https");

  const method = request.method.toUpperCase();
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    redirect: "manual",
    signal: request.signal,
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const upstreamResponse = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers(upstreamResponse.headers);
  const location = responseHeaders.get("location");
  if (location) {
    responseHeaders.set("location", rewriteSaudiLocation(location, upstreamUrl));
  }
  responseHeaders.set("x-rawaj-market", "saudi");
  responseHeaders.set("x-rawaj-market-origin", "cloudflare");

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

const server: ServerEntry = {
  async fetch(request, env, ctx) {
    if (requestHostname(request) === saudiHostname) {
      try {
        return await proxySaudiRequest(request);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "saudi_host_proxy_failed",
            pathname: new URL(request.url).pathname,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        return new Response("Saudi market is temporarily unavailable.", {
          status: 502,
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "x-rawaj-market": "saudi",
          },
        });
      }
    }

    return rawajServer.fetch(request, env, ctx);
  },
};

export default server;
