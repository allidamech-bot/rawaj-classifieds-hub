import fs from "node:fs";

const target = "cloudflare/worker/src/trust-support.ts";
let source = fs.readFileSync(target, "utf8");

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing privacy patch anchor: ${label}`);
  if (source.indexOf(search) !== source.lastIndexOf(search)) {
    throw new Error(`Non-unique privacy patch anchor: ${label}`);
  }
  source = source.replace(search, replacement);
}

replaceOnce(
  `  return result.success\n    ? json({ data: (result.results ?? []).map(mapSupport) }, 200, cors)\n    : databaseError(cors);\n}\n\nasync function moderateSupportRequest(`,
  `  return result.success\n    ? json({ data: (result.results ?? []).map(mapAdminSupport) }, 200, cors)\n    : databaseError(cors);\n}\n\nasync function moderateSupportRequest(`,
  "admin support list mapper",
);

replaceOnce(
  `  return json({ data: mapSupport(persisted) }, 200, cors);\n}\n\nasync function createListingReport(`,
  `  return json({ data: mapAdminSupport(persisted) }, 200, cors);\n}\n\nasync function createListingReport(`,
  "admin support mutation mapper",
);

replaceOnce(
  `function mapSupport(row: Row) {\n  return {\n    id: stringValue(row.id),\n    userId: stringValue(row.user_id),\n    email: nullableString(row.email),\n    type: stringValue(row.type, "other"),\n    status: supportStatusFromDb(stringValue(row.status, "open")),\n    priority: stringValue(row.priority, "normal"),\n    assignedTo: nullableString(row.assigned_to),\n    subject: stringValue(row.subject),\n    message: stringValue(row.message),\n    relatedListingId: nullableString(row.related_listing_id),\n    relatedReportId: nullableString(row.related_report_id),\n    publicResponse: nullableString(row.public_response),\n    adminNote: nullableString(row.admin_note),\n    createdAt: stringValue(row.created_at),\n    updatedAt: stringValue(row.updated_at),\n  };\n}`,
  `function mapSupport(row: Row) {\n  return {\n    id: stringValue(row.id),\n    userId: stringValue(row.user_id),\n    type: stringValue(row.type, "other"),\n    status: supportStatusFromDb(stringValue(row.status, "open")),\n    subject: stringValue(row.subject),\n    message: stringValue(row.message),\n    relatedListingId: nullableString(row.related_listing_id),\n    relatedReportId: nullableString(row.related_report_id),\n    publicResponse: nullableString(row.public_response),\n    createdAt: stringValue(row.created_at),\n    updatedAt: stringValue(row.updated_at),\n  };\n}\n\nfunction mapAdminSupport(row: Row) {\n  return {\n    ...mapSupport(row),\n    email: nullableString(row.email),\n    priority: stringValue(row.priority, "normal"),\n    assignedTo: nullableString(row.assigned_to),\n    adminNote: nullableString(row.admin_note),\n  };\n}`,
  "split public and admin support mappers",
);

fs.writeFileSync(target, source);

fs.writeFileSync(
  "cloudflare/worker/test/support-admin.test.mjs",
  `import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport test from "node:test";\n\nconst source = fs.readFileSync(new URL("../src/trust-support.ts", import.meta.url), "utf8");\n\ntest("support requests expose a protected admin moderation contract", () => {\n  assert.match(source, /\\/v1\\/admin\\/support-requests/);\n  assert.match(source, /support_request\\.moderated/);\n  assert.match(source, /public_response = \\?/);\n  assert.match(source, /assigned_to = \\?/);\n  assert.match(source, /stringValue\\(persisted\\.updated_at\\) !== timestamp/);\n  const moderateStart = source.indexOf("async function moderateSupportRequest(");\n  const moderateEnd = source.indexOf("async function createListingReport(", moderateStart);\n  assert.ok(moderateStart >= 0 && moderateEnd > moderateStart);\n  assert.doesNotMatch(source.slice(moderateStart, moderateEnd), /changedRows\\(result\\)/);\n});\n\ntest("internal support fields are only returned to administrators", () => {\n  const publicStart = source.indexOf("function mapSupport(");\n  const adminStart = source.indexOf("function mapAdminSupport(", publicStart);\n  const adminEnd = source.indexOf("function mapListingReport(", adminStart);\n  assert.ok(publicStart >= 0 && adminStart > publicStart && adminEnd > adminStart);\n  const publicMapper = source.slice(publicStart, adminStart);\n  const adminMapper = source.slice(adminStart, adminEnd);\n  assert.doesNotMatch(publicMapper, /adminNote|assignedTo|row\\.email|row\\.priority/);\n  assert.match(adminMapper, /adminNote/);\n  assert.match(adminMapper, /assignedTo/);\n  assert.match(adminMapper, /row\\.email/);\n  assert.match(source, /map\\(mapAdminSupport\\)/);\n  assert.match(source, /mapAdminSupport\\(persisted\\)/);\n});\n`,
);

for (const path of [
  "scripts/refine-saudi-admin-support-privacy.mjs",
  ".github/workflows/refine-saudi-admin-support-privacy.yml",
]) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}
