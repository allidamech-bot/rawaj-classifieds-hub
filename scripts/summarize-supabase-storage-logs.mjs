#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const AUTOMATION_USER_AGENT =
  /(playwright|headlesschrome|github[- ]actions|node\.js|\bnode\b|undici|vitest|jsdom|puppeteer)/i;
const BROWSER_USER_AGENT = /(mozilla\/5\.0|chrome|chromium|safari|firefox|edg\/)/i;

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const key of ["result", "logs", "data", "events", "items"]) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [value];
}

export function parseStorageLogExport(source) {
  const text = String(source ?? "").trim();
  if (!text) return [];

  try {
    return asArray(JSON.parse(text)).filter(Boolean);
  } catch {
    const records = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed));
      } catch (error) {
        throw new Error(`Invalid JSON log line ${index + 1}: ${error.message}`);
      }
    }
    return records;
  }
}

function collectPrimitiveFields(value, output = [], trail = []) {
  if (value === null || value === undefined) return output;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPrimitiveFields(item, output, [...trail, String(index)]));
    return output;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      collectPrimitiveFields(item, output, [...trail, key]),
    );
    return output;
  }
  output.push({ key: trail.at(-1)?.toLowerCase() ?? "", path: trail.join(".").toLowerCase(), value });
  return output;
}

function firstString(fields, keys) {
  for (const key of keys) {
    const match = fields.find(
      (field) => field.key === key || field.path.endsWith(`.${key}`),
    );
    if (match && typeof match.value === "string" && match.value.trim()) {
      return match.value.trim();
    }
  }
  return "";
}

function firstNumber(fields, keys) {
  for (const key of keys) {
    const match = fields.find(
      (field) => field.key === key || field.path.endsWith(`.${key}`),
    );
    if (!match) continue;
    const numeric = Number(match.value);
    if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  }
  return 0;
}

function parseMessageFallback(message) {
  const method = message.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i)?.[1] ?? "";
  const path =
    message.match(/(\/storage\/v1\/[^\s|?]+)/i)?.[1] ??
    message.match(/(\/object\/[^\s|?]+)/i)?.[1] ??
    "";
  const status = Number(message.match(/(?:^|\s|\|)([1-5]\d{2})(?:\s|\||$)/)?.[1] ?? 0);
  return { method: method.toUpperCase(), path, status };
}

export function normalizeStorageLogRecord(record) {
  const fields = collectPrimitiveFields(record);
  const message = firstString(fields, ["event_message", "message", "msg"]);
  const fallback = parseMessageFallback(message);

  const rawPath =
    firstString(fields, ["path", "pathname", "request_path", "url", "request_url"]) ||
    fallback.path;
  let pathname = rawPath;
  try {
    pathname = new URL(rawPath).pathname;
  } catch {
    pathname = rawPath.split("?")[0];
  }

  const method = (
    firstString(fields, ["method", "request_method", "http_method"]) || fallback.method
  ).toUpperCase();
  const userAgent = firstString(fields, ["user_agent", "useragent", "user-agent"]);
  const status =
    firstNumber(fields, ["status_code", "statuscode", "status"]) || fallback.status;
  const responseBytes = firstNumber(fields, [
    "response_bytes",
    "response_size",
    "body_bytes_sent",
    "bytes_sent",
    "content_length",
  ]);

  let actor = "unknown";
  if (AUTOMATION_USER_AGENT.test(userAgent)) actor = "automation";
  else if (BROWSER_USER_AGENT.test(userAgent)) actor = "likely_user";

  return { method, pathname, userAgent, status, responseBytes, actor };
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedObject(map) {
  return Object.fromEntries(
    [...map.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
  );
}

export function summarizeStorageLogs(records) {
  const actorCounts = new Map();
  const signPaths = new Map();
  const downloadPaths = new Map();
  const statusCounts = new Map();
  let storageRequests = 0;
  let listingImageRequests = 0;
  let signRequests = 0;
  let signedDownloads = 0;
  let responseBytes = 0;

  for (const rawRecord of records) {
    const record = normalizeStorageLogRecord(rawRecord);
    const isStorage = /\/storage\/v1\/|\/object\//i.test(record.pathname);
    if (!isStorage) continue;

    storageRequests += 1;
    increment(actorCounts, record.actor);
    if (record.status) increment(statusCounts, String(record.status));
    responseBytes += record.responseBytes;

    const isListingImages = record.pathname.includes("listing-images");
    if (isListingImages) listingImageRequests += 1;

    const isSignedPath = /\/object\/sign\//i.test(record.pathname);
    if (record.method === "POST" && isSignedPath) {
      signRequests += 1;
      increment(signPaths, record.pathname);
    } else if ((record.method === "GET" || record.method === "HEAD") && isSignedPath) {
      signedDownloads += 1;
      increment(downloadPaths, record.pathname);
    }
  }

  const repeatedSignPaths = new Map(
    [...signPaths.entries()].filter(([, count]) => count > 1),
  );

  return {
    input_records: records.length,
    storage_requests: storageRequests,
    listing_images_requests: listingImageRequests,
    sign_requests: signRequests,
    signed_downloads: signedDownloads,
    observed_response_bytes: responseBytes,
    actors: sortedObject(actorCounts),
    statuses: sortedObject(statusCounts),
    repeated_sign_paths: sortedObject(repeatedSignPaths),
    top_signed_download_paths: sortedObject(new Map([...downloadPaths.entries()].slice(0, 50))),
    interpretation: {
      automation_is_not_production_user_traffic: true,
      unknown_user_agents_require_manual_review: true,
      observed_response_bytes_may_be_incomplete: true,
    },
  };
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error(
      "Usage: node scripts/summarize-supabase-storage-logs.mjs <supabase-storage-log-export.json|ndjson>",
    );
  }
  const records = parseStorageLogExport(await readFile(inputPath, "utf8"));
  process.stdout.write(`${JSON.stringify(summarizeStorageLogs(records), null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
