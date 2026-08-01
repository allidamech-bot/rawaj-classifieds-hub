import type { IncomingMessage, ServerResponse } from "node:http";

import worker from "../src/index.ts";

const INTERNAL_PATH_PARAMETER = "__rawaj_path";

function restorePublicUrl(request: Request): Request {
  const url = new URL(request.url);
  const publicPath = url.searchParams.get(INTERNAL_PATH_PARAMETER);

  if (publicPath) {
    url.pathname = publicPath.startsWith("/") ? publicPath : `/${publicPath}`;
  }
  url.searchParams.delete(INTERNAL_PATH_PARAMETER);

  return new Request(url, request);
}

export function handleWebRequest(request: Request): Promise<Response> {
  return worker.fetch(restorePublicUrl(request));
}

function requestOrigin(request: IncomingMessage): string {
  const forwardedProto = request.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto || "https";
  return `${protocol}://${request.headers.host || "rawaj-market-gateway.vercel.app"}`;
}

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const method = request.method || "GET";
  const webRequest = new Request(new URL(request.url || "/", requestOrigin(request)), {
    method,
    headers: requestHeaders(request),
  });
  const webResponse = await handleWebRequest(webRequest);

  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));

  if (method === "HEAD" || webResponse.body === null) {
    response.end();
    return;
  }
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}
