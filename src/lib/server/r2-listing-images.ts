const service = "s3";
const algorithm = "AWS4-HMAC-SHA256";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
}

export function readR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const endpoint = process.env.R2_ENDPOINT?.trim().replace(/\/$/, "");
  const region = process.env.R2_REGION?.trim() || "auto";
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint, region };
}

export function toR2StoragePath(key: string): string {
  return `r2:${key}`;
}

export function fromR2StoragePath(path: string): string | null {
  return path.startsWith("r2:") ? path.slice(3) : null;
}

export async function putR2Object(
  config: R2Config,
  key: string,
  body: ArrayBuffer,
  contentType: string,
) {
  const url = objectUrl(config, key);
  const payloadHash = await sha256Hex(body);
  const response = await signedFetch(config, url, "PUT", body, payloadHash, {
    "content-type": contentType,
    "cache-control": "public, max-age=31536000, immutable",
  });
  if (!response.ok) throw new Error(`R2 PUT failed with ${response.status}`);
}

export async function deleteR2Object(config: R2Config, key: string) {
  const url = objectUrl(config, key);
  const response = await signedFetch(
    config,
    url,
    "DELETE",
    undefined,
    await sha256Hex(new Uint8Array()),
    {},
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 DELETE failed with ${response.status}`);
  }
}

export async function presignR2Get(config: R2Config, key: string, expiresSeconds = 900) {
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const base = objectUrl(config, key);
  const url = new URL(base);
  const params = new URLSearchParams({
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.max(1, Math.min(expiresSeconds, 3600))),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalQuery = canonicalSearchParams(params);
  const canonicalRequest = [
    "GET",
    url.pathname,
    canonicalQuery,
    `host:${url.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await deriveSigningKey(config.secretAccessKey, dateStamp, config.region);
  const signature = bytesToHex(await hmac(signingKey, stringToSign));
  return `${base}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

async function signedFetch(
  config: R2Config,
  urlString: string,
  method: string,
  body: ArrayBuffer | undefined,
  payloadHash: string,
  extraHeaders: Record<string, string>,
) {
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const url = new URL(urlString);
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...extraHeaders,
  };
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name].trim()}\n`)
    .join("");
  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaderNames.join(";"),
    payloadHash,
  ].join("\n");
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await deriveSigningKey(config.secretAccessKey, dateStamp, config.region);
  const signature = bytesToHex(await hmac(signingKey, stringToSign));
  const authorization = `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`;
  const requestHeaders = new Headers(extraHeaders);
  requestHeaders.set("x-amz-content-sha256", payloadHash);
  requestHeaders.set("x-amz-date", amzDate);
  requestHeaders.set("authorization", authorization);
  return fetch(url, { method, headers: requestHeaders, body });
}

function objectUrl(config: R2Config, key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodedKey}`;
}

function canonicalSearchParams(params: URLSearchParams) {
  return [...params.entries()]
    .sort(
      ([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue),
    )
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function deriveSigningKey(secret: string, dateStamp: string, region: string) {
  const dateKey = await hmac(new TextEncoder().encode(`AWS4${secret}`), dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

async function hmac(key: BufferSource, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value)),
  );
}

async function sha256Hex(value: string | BufferSource) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
