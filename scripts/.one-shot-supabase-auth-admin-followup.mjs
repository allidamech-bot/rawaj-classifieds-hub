#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const target = path.join(process.cwd(), "scripts/admin-security-regression.mjs");
let source = await readFile(target, "utf8");

source = source.replace(
  `  assert.match(auth, /export async function requireMutationAuth/);\n  assert.doesNotMatch(auth, /service_role|SUPABASE|supabase/i);`,
  `  assert.match(auth, /export async function requireMutationAuth/);\n  assert.match(auth, /verifySupabaseAccessToken/);\n  assert.match(auth, /SUPABASE_URL/);\n  assert.doesNotMatch(\n    auth,\n    /service_role|SUPABASE_(?:SERVICE_ROLE|SECRET|JWT_SECRET)|firebase/i,\n  );`,
);

source = source.replace(
  `  assert.doesNotMatch(verification, /getPublicUrl|createSignedUrl|supabase/i);`,
  `  assert.doesNotMatch(\n    verification,\n    /getPublicUrl|createSignedUrl|@supabase\\/supabase-js|\\.storage(?:\\.|\\[)|\\.from\\s*\\(/i,\n  );`,
);

if (!source.includes("verifySupabaseAccessToken") || source.includes("service_role|SUPABASE|supabase")) {
  throw new Error("admin security Supabase Auth contract replacement failed");
}
await writeFile(target, source, "utf8");
console.log("Admin security regression aligned to Supabase Auth-only boundary.");
