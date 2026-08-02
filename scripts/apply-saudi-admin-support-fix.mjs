import fs from "node:fs";

const target = "cloudflare/worker/src/trust-support.ts";
let source = fs.readFileSync(target, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Patch anchor missing: ${label}`);
  if (source.indexOf(search) !== source.lastIndexOf(search)) {
    throw new Error(`Patch anchor is not unique: ${label}`);
  }
  source = source.replace(search, replacement);
}

replaceOnce(
  `]);\nconst LISTING_REPORT_TYPES = new Set([`,
  `]);\nconst SUPPORT_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);\nconst LISTING_REPORT_TYPES = new Set([`,
  "support priorities",
);

replaceOnce(
  `  const ownSupport = path.match(/^\\/v1\\/account\\/support-requests\\/([^/]+)$/);\n  if (ownSupport && request.method === "GET") {\n    return getOwnSupportRequest(request, env, cors, decodeURIComponent(ownSupport[1]));\n  }\n\n  const listingReport = path.match(`,
  `  const ownSupport = path.match(/^\\/v1\\/account\\/support-requests\\/([^/]+)$/);\n  if (ownSupport && request.method === "GET") {\n    return getOwnSupportRequest(request, env, cors, decodeURIComponent(ownSupport[1]));\n  }\n  if (path === "/v1/admin/support-requests" && request.method === "GET") {\n    return listSupportRequests(request, env, cors, url);\n  }\n  const adminSupport = path.match(/^\\/v1\\/admin\\/support-requests\\/([^/]+)$/);\n  if (adminSupport && request.method === "PATCH") {\n    return moderateSupportRequest(\n      request,\n      env,\n      cors,\n      decodeURIComponent(adminSupport[1]),\n    );\n  }\n\n  const listingReport = path.match(`,
  "admin support routes",
);

replaceOnce(
  `    /^\\/v1\\/admin\\/(?:listing-reports|seller-reviews|seller-review-reports)(?:\\/|$)/.test(path)`,
  `    /^\\/v1\\/admin\\/(?:support-requests|listing-reports|seller-reviews|seller-review-reports)(?:\\/|$)/.test(path)`,
  "relevant admin support route",
);

replaceOnce(
  `function supportSelect(): string {\n  return \`SELECT id, user_id, type, status, subject, message, related_listing_id,\n    related_report_id, public_response, created_at, updated_at FROM support_requests\`;\n}`,
  `function supportSelect(): string {\n  return \`SELECT id, user_id, email, type, status, priority, assigned_to, subject, message,\n    related_listing_id, related_report_id, public_response, admin_note, created_at, updated_at\n    FROM support_requests\`;\n}`,
  "support select",
);

replaceOnce(
  `async function readSupportRow(\n  env: TrustSupportEnv,\n  id: string,\n  userId: string,\n): Promise<Row | null> {\n  return env.DB.prepare(\`${"${supportSelect()}"} WHERE id = ? AND user_id = ?\`)\n    .bind(id, userId)\n    .first<Row>();\n}\n\nasync function createListingReport(`,
  `async function readSupportRow(\n  env: TrustSupportEnv,\n  id: string,\n  userId: string,\n): Promise<Row | null> {\n  return env.DB.prepare(\`${"${supportSelect()}"} WHERE id = ? AND user_id = ?\`)\n    .bind(id, userId)\n    .first<Row>();\n}\n\nasync function listSupportRequests(\n  request: Request,\n  env: TrustSupportEnv,\n  cors: Headers,\n  url: URL,\n): Promise<Response> {\n  const auth = await authenticate(request, asAuthEnv(env));\n  if (!auth) return unauthorized(cors);\n  if (!canModerate(auth.roles)) return forbidden(cors);\n  const limit = integer(url.searchParams.get("limit"), 100, 1, 200);\n  const requestedStatus = optionalText(url.searchParams.get("status"), 30);\n  const dbStatus = requestedStatus ? supportStatusToDb(requestedStatus) : null;\n  if (requestedStatus && !dbStatus) return validation(cors, "Invalid support status.");\n  const result = dbStatus\n    ? await env.DB.prepare(\`${"${supportSelect()}"} WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT ?\`)\n        .bind(dbStatus, limit)\n        .all<Row>()\n    : await env.DB.prepare(\`${"${supportSelect()}"} ORDER BY created_at DESC, id DESC LIMIT ?\`)\n        .bind(limit)\n        .all<Row>();\n  return result.success\n    ? json({ data: (result.results ?? []).map(mapSupport) }, 200, cors)\n    : databaseError(cors);\n}\n\nasync function moderateSupportRequest(\n  request: Request,\n  env: TrustSupportEnv,\n  cors: Headers,\n  requestIdRaw: string,\n): Promise<Response> {\n  const auth = await requireMutationAuth(request, asAuthEnv(env), cors);\n  if (auth instanceof Response) return auth;\n  if (!canModerate(auth.roles)) return forbidden(cors);\n  const body = await readJson(request);\n  if (!body.ok) return json({ error: body.error }, body.status, cors);\n  const requestId = text(requestIdRaw, 120);\n  const status = text(body.data.status, 30);\n  const expectedUpdatedAt = text(body.data.expectedUpdatedAt, 80);\n  const publicResponse = optionalText(body.data.publicResponse, 3000);\n  const adminNote = optionalText(body.data.adminNote, 2000);\n  const priority = text(body.data.priority, 20) || "normal";\n  const dbStatus = supportStatusToDb(status);\n  if (\n    !requestId ||\n    !dbStatus ||\n    !expectedUpdatedAt ||\n    !SUPPORT_PRIORITIES.has(priority) ||\n    ((dbStatus === "resolved" || dbStatus === "closed") && !publicResponse)\n  ) {\n    return validation(cors, "Invalid support update.");\n  }\n  const timestamp = now();\n  const result = await env.DB.prepare(\n    \`UPDATE support_requests SET status = ?, priority = ?, assigned_to = ?,\n      public_response = ?, admin_note = ?, updated_at = ? WHERE id = ? AND updated_at = ?\`,\n  )\n    .bind(\n      dbStatus,\n      priority,\n      auth.userId,\n      publicResponse,\n      adminNote,\n      timestamp,\n      requestId,\n      expectedUpdatedAt,\n    )\n    .run();\n  if (!result.success) return databaseError(cors);\n  const persisted = await env.DB.prepare(\`${"${supportSelect()}"} WHERE id = ?\`)\n    .bind(requestId)\n    .first<Row>();\n  if (!persisted) return notFound(cors);\n  if (\n    stringValue(persisted.updated_at) !== timestamp ||\n    stringValue(persisted.status) !== dbStatus ||\n    stringValue(persisted.assigned_to) !== auth.userId\n  ) {\n    return stale(cors);\n  }\n  await insertAudit(env, auth.userId, "support_request.moderated", "support_request", requestId, {\n    status,\n    priority,\n  });\n  return json({ data: mapSupport(persisted) }, 200, cors);\n}\n\nasync function createListingReport(`,
  "admin support handlers",
);

replaceOnce(
  `    userId: stringValue(row.user_id),\n    type: stringValue(row.type, "other"),\n    status: supportStatusFromDb(stringValue(row.status, "open")),`,
  `    userId: stringValue(row.user_id),\n    email: nullableString(row.email),\n    type: stringValue(row.type, "other"),\n    status: supportStatusFromDb(stringValue(row.status, "open")),\n    priority: stringValue(row.priority, "normal"),\n    assignedTo: nullableString(row.assigned_to),`,
  "support response fields",
);

replaceOnce(
  `    publicResponse: nullableString(row.public_response),\n    createdAt: stringValue(row.created_at),`,
  `    publicResponse: nullableString(row.public_response),\n    adminNote: nullableString(row.admin_note),\n    createdAt: stringValue(row.created_at),`,
  "support admin note",
);

replaceOnce(
  `function listingReportStatusFromDb(status: string): string {`,
  `function supportStatusToDb(status: string): string | null {\n  if (status === "new") return "open";\n  if (status === "under_review") return "in_progress";\n  if (status === "resolved") return "resolved";\n  if (status === "rejected") return "closed";\n  return null;\n}\n\nfunction listingReportStatusFromDb(status: string): string {`,
  "support status mapping",
);

fs.writeFileSync(target, source);

fs.writeFileSync(
  "cloudflare/worker/test/support-admin.test.mjs",
  `import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport test from "node:test";\n\nconst source = fs.readFileSync(new URL("../src/trust-support.ts", import.meta.url), "utf8");\n\ntest("support requests expose a protected admin moderation contract", () => {\n  assert.match(source, /\\/v1\\/admin\\/support-requests/);\n  assert.match(source, /support_request\\.moderated/);\n  assert.match(source, /public_response = \\?/);\n  assert.match(source, /assigned_to = \\?/);\n  assert.match(source, /stringValue\\(persisted\\.updated_at\\) !== timestamp/);\n  const start = source.indexOf("async function moderateSupportRequest(");\n  const end = source.indexOf("async function createListingReport(", start);\n  assert.ok(start >= 0 && end > start);\n  assert.doesNotMatch(source.slice(start, end), /changedRows\\(result\\)/);\n});\n`,
);

for (const path of [
  "scripts/apply-saudi-admin-support-fix.mjs",
  ".github/workflows/apply-saudi-admin-support-fix.yml",
  "docs/saudi-admin-support-fix-trigger.txt",
]) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}
