import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202607100011_verification_documents_v2.sql",
  import.meta.url,
);
const apiPath = new URL("../src/lib/api/verification.ts", import.meta.url);
const typesPath = new URL("../src/lib/classifieds-types.ts", import.meta.url);
const userRoutePath = new URL("../src/routes/verification.tsx", import.meta.url);
const adminRoutePath = new URL("../src/routes/admin.verifications.tsx", import.meta.url);

const [migration, api, types, userRoute, adminRoute] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(apiPath, "utf8"),
  readFile(typesPath, "utf8"),
  readFile(userRoutePath, "utf8"),
  readFile(adminRoutePath, "utf8"),
]);

test("verification evidence uses a private bounded MIME-controlled bucket", () => {
  assert.match(migration, /'verification-documents'/);
  assert.match(migration, /false,\s*10485760/);
  for (const mime of ["image/jpeg", "image/png", "image/webp", "application/pdf"]) {
    assert.match(migration, new RegExp(mime.replace("/", "\\/")));
  }
});

test("verification storage policies bind uploads to owner and request folders", () => {
  assert.match(migration, /auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[1\]/);
  assert.match(migration, /rawaj_safe_uuid\(\(storage\.foldername\(name\)\)\[2\]\)/);
  assert.match(migration, /current_user_is_admin_like\(\)/);
  assert.match(migration, /where r\.document_path = storage\.objects\.name/);
  assert.match(migration, /not exists \([\s\S]*where r\.document_path = storage\.objects\.name/);
});

test("governed V2 RPC verifies auth, controlled document types and exact object ownership", () => {
  assert.match(migration, /rawaj_create_verification_request_v2/);
  assert.match(migration, /v_actor uuid := auth\.uid\(\)/);
  assert.match(migration, /'national_id'/);
  assert.match(migration, /'commercial_registration'/);
  assert.match(migration, /o\.bucket_id = 'verification-documents'/);
  assert.match(migration, /o\.name = v_document_path/);
  assert.match(migration, /\(storage\.foldername\(o\.name\)\)\[2\] = p_request_id::text/);
  assert.match(migration, /drop policy if exists "seller_verification_user_insert"/);
});

test("verification review authority excludes generic moderators", () => {
  assert.match(migration, /seller_verification_admin_select[\s\S]*current_user_is_admin_like\(\)/);
  assert.match(
    migration,
    /rawaj_admin_moderate_verification_request[\s\S]*not public\.current_user_is_admin_like\(\)/,
  );
});

test("client uploads evidence then calls governed RPC and cleans unattached failures", () => {
  assert.match(api, /verificationDocumentsBucket/);
  assert.match(api, /\.upload\(storagePath, payload\.documentFile/);
  assert.match(api, /rpc\("rawaj_create_verification_request_v2"/);
  assert.match(api, /\.remove\(\[storagePath\]\)/);
  assert.doesNotMatch(api, /\.from\("seller_verification_requests"\)[\s\S]*\.insert\(/);
});

test("verification types and user UI require controlled evidence", () => {
  assert.match(types, /export type VerificationDocumentType/);
  assert.match(types, /documentType: VerificationDocumentType/);
  assert.match(types, /documentFile: File/);
  assert.match(userRoute, /accept="image\/jpeg,image\/png,image\/webp,application\/pdf"/);
  assert.match(userRoute, /setDocumentFile/);
  assert.match(userRoute, /documentTypeOptions/);
  assert.match(userRoute, /documentFile/);
});

test("admin document access is permission gated and signed", () => {
  assert.match(api, /adminCreateVerificationDocumentSignedUrl/);
  assert.match(api, /if \(!canManageVerifications\)/);
  assert.match(api, /createSignedUrl\(normalizedPath, 300\)/);
  assert.match(adminRoute, /adminCreateVerificationDocumentSignedUrl\(canManageVerifications/);
  assert.match(adminRoute, /target="_blank"/);
  assert.doesNotMatch(adminRoute, /href=\{request\.documentPath\}/);
});
