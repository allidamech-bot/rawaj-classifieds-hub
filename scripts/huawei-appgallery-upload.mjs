#!/usr/bin/env node
// RAWAJ Huawei AppGallery Connect API package uploader.
// Uploads an existing signed APK and associates it with the AppGallery app.
// Does NOT submit the version for review or publish the application.
// Credentials must come from private GitHub Actions secrets.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const apiRoot = "https://connect-api.cloud.huawei.com/api";
const clientId = process.env.HUAWEI_API_CLIENT_ID?.trim();
const clientSecret = process.env.HUAWEI_API_CLIENT_SECRET?.trim();
const appId = process.env.HUAWEI_APP_ID?.trim();
const apkPath = process.env.HUAWEI_APK_PATH?.trim();

function check(condition, message) {
  if (!condition) throw new Error(message);
}
check(clientId && clientSecret && appId && apkPath, "Missing Huawei API client, API secret, app ID, or APK path in GitHub Actions secrets.");
check(/^\d+$/.test(appId), "Huawei app ID must contain digits only.");
check(apkPath.toLowerCase().endsWith(".apk"), "Only APK uploads are supported by this workflow.");

const info = await stat(apkPath);
check(info.isFile() && info.size > 0 && info.size <= 4_000_000_000, "APK missing, empty, or too large.");
const filename = path.basename(apkPath);
const responseJson = async (response, phase) => {
  let raw = "";
  try { raw = await response.text(); } catch { /* hide transport-specific errors */ }
  // Never include Huawei access tokens, authorization codes, or signed upload URLs in logs.
  if (!response.ok) throw new Error(phase + " failed with HTTP " + response.status);
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error(phase + " returned invalid JSON."); }
  const ret = data?.ret;
  if (ret !== undefined && ret !== null) {
    const code = typeof ret === "string" ? (() => { try { return JSON.parse(ret).code; } catch { return ret; } })() : ret?.code;
    if (String(code) !== "0") throw new Error(phase + " returned non-success code: " + String(code));
  }
  return data;
};

const tokenData = await responseJson(await fetch(apiRoot + "/oauth2/v1/token", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
}), "Token request");
check(typeof tokenData.access_token === "string" && tokenData.access_token.length > 10,
  "Huawei token response did not include an access token.");
const headers = {
  Authorization: "Bearer " + tokenData.access_token,
  client_id: clientId,
};

const obtainUrl = new URL(apiRoot + "/publish/v2/upload-url");
obtainUrl.searchParams.set("appId", appId);
obtainUrl.searchParams.set("suffix", "apk");
obtainUrl.searchParams.set("releaseType", "1");
const slot = await responseJson(await fetch(obtainUrl, { headers }), "Upload URL request");
check(typeof slot.uploadUrl === "string" && typeof slot.authCode === "string",
  "Huawei did not return an upload URL and authorization code.");

const destination = new URL(slot.uploadUrl);
check(destination.protocol === "https:" && (
  destination.hostname === "hicloud.com" ||
  destination.hostname.endsWith(".hicloud.com") ||
  destination.hostname === "huawei.com" ||
  destination.hostname.endsWith(".huawei.com") ||
  destination.hostname === "huaweicloud.com" ||
  destination.hostname.endsWith(".huaweicloud.com")
), "Huawei returned an unexpected upload host; refusing to send APK.");

const fileForm = new FormData();
fileForm.set("authCode", slot.authCode);
fileForm.set("fileCount", "1");
fileForm.set("file", new Blob([await readFile(apkPath)], { type: "application/vnd.android.package-archive" }), filename);
const uploaded = await responseJson(await fetch(destination, {
  method: "POST", body: fileForm, redirect: "error",
}), "APK upload");
const fileRecord = uploaded?.result?.UploadFileRsp?.fileInfoList?.[0]
  ?? uploaded?.UploadFileRsp?.fileInfoList?.[0]
  ?? uploaded?.result?.fileInfoList?.[0];
check(fileRecord, "Huawei uploaded the bytes but did not return recognizable file metadata; check AppGallery Connect before retrying.");
// Huawei's API field is historically misspelled fileDestUlr (not Url).
const fileDestUrl = fileRecord.fileDestUlr ?? fileRecord.fileDestUrl;
check(typeof fileDestUrl === "string" && fileDestUrl.length > 0,
  "Uploaded file metadata is missing fileDestUrl; check console before retrying.");
const byteSize = Number(fileRecord.size);
check(Number.isFinite(byteSize) && byteSize > 0,
  "Uploaded file metadata is missing size; check console before retrying.");

const updateUrl = new URL(apiRoot + "/publish/v2/app-file-info");
updateUrl.searchParams.set("appId", appId);
await responseJson(await fetch(updateUrl, {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json", releaseType: "1" },
  body: JSON.stringify({
    fileType: "5",
    files: [{ fileName: filename, fileDestUrl, size: String(byteSize) }],
  }),
}), "App package association");

console.log("SUCCESS: RAWAJ APK uploaded and associated with Huawei AppGallery app.");
console.log("APK file: " + filename);
console.log("App ID: " + appId);
console.log("The draft is NOT submitted for review. Open Manage packages in AppGallery Connect to verify.");
