import { readFile, writeFile } from "node:fs/promises";

const envText = await readFile(new URL("../.env.production", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const baseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
if (!baseUrl || !anonKey) throw new Error("Production Supabase configuration is missing.");

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
};

async function probe(name, url, init = {}) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "follow",
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
    });
    const text = await response.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Preserve non-JSON diagnostics.
    }
    return {
      name,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      body,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 0,
      durationMs: Date.now() - startedAt,
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

const rpcBody = JSON.stringify({
  p_conversation_id: null,
  p_client_request_id: null,
  p_body: "",
  p_attachment_path: null,
  p_attachment_mime_type: null,
  p_attachment_size_bytes: null,
  p_attachment_kind: null,
  p_attachment_duration_ms: null,
});

const results = await Promise.all([
  probe("auth-health", `${baseUrl}/auth/v1/health`, { method: "GET" }),
  probe("message-rpc-v4", `${baseUrl}/rest/v1/rpc/rawaj_send_conversation_message_v4`, {
    method: "POST",
    body: rpcBody,
  }),
  probe("message-rpc-v3", `${baseUrl}/rest/v1/rpc/rawaj_send_conversation_message_v3`, {
    method: "POST",
    body: JSON.stringify({
      p_conversation_id: null,
      p_client_request_id: null,
      p_body: "",
      p_attachment_path: null,
      p_attachment_mime_type: null,
      p_attachment_size_bytes: null,
    }),
  }),
  probe(
    "conversation-audio-object",
    `${baseUrl}/storage/v1/object/conversation-audio/__rawaj_nonexistent_probe__`,
    { method: "GET" },
  ),
  probe(
    "listing-images-object-control",
    `${baseUrl}/storage/v1/object/listing-images/__rawaj_nonexistent_probe__`,
    { method: "GET" },
  ),
  probe(
    "missing-bucket-control",
    `${baseUrl}/storage/v1/object/__rawaj_missing_bucket__/__rawaj_nonexistent_probe__`,
    { method: "GET" },
  ),
  probe(
    "conversation-message-columns",
    `${baseUrl}/rest/v1/conversation_messages?select=attachment_kind,attachment_duration_ms&limit=0`,
    { method: "GET" },
  ),
]);

function bodyText(result) {
  return typeof result.body === "string" ? result.body : JSON.stringify(result.body);
}

function isMissingRpc(result) {
  const text = bodyText(result);
  return result.status === 404 && (text.includes("PGRST202") || text.includes("schema cache"));
}

function storageClassification(result) {
  const text = bodyText(result).toLowerCase();
  if (text.includes("bucket not found")) return "bucket-missing";
  if (text.includes("object not found") || text.includes("not_found")) return "bucket-present-object-missing";
  if (result.status === 401 || result.status === 403) return "bucket-present-access-denied";
  return "unknown";
}

const v4 = results.find((result) => result.name === "message-rpc-v4");
const audio = results.find((result) => result.name === "conversation-audio-object");
const listingControl = results.find((result) => result.name === "listing-images-object-control");
const missingControl = results.find((result) => result.name === "missing-bucket-control");

const summary = {
  checkedAt: new Date().toISOString(),
  supabaseHost: new URL(baseUrl).host,
  rpcV4: v4 ? (isMissingRpc(v4) ? "missing" : "present-or-resolved") : "unknown",
  audioBucket: audio ? storageClassification(audio) : "unknown",
  controls: {
    listingImages: listingControl ? storageClassification(listingControl) : "unknown",
    missingBucket: missingControl ? storageClassification(missingControl) : "unknown",
  },
};

const report = { summary, results };
await writeFile("chat-audio-production-diagnostic.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));

if (summary.rpcV4 === "missing" || summary.audioBucket === "bucket-missing") {
  process.exitCode = 1;
}
