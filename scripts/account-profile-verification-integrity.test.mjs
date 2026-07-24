import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  accountIdentity,
  profileApi,
  verificationApi,
  accountSecurity,
  supportApi,
  profileDto,
  authTypes,
  auth,
  sellerApi,
  profileRoute,
  verificationRoute,
  adminRoute,
  authReturn,
  resetRoute,
  migration,
  workflow,
  qualityGate,
  packageJson,
  phase12Api,
] = await Promise.all([
  read("src/lib/api/account-identity.ts"),
  read("src/lib/api/profile.ts"),
  read("src/lib/api/verification.ts"),
  read("src/lib/api/account-security.ts"),
  read("src/lib/api/support.ts"),
  read("src/lib/profile-dto.ts"),
  read("src/lib/auth-types.ts"),
  read("src/lib/auth.tsx"),
  read("src/lib/api/seller.ts"),
  read("src/routes/profile.tsx"),
  read("src/routes/verification.tsx"),
  read("src/routes/admin.verifications.tsx"),
  read("src/lib/auth-return.ts"),
  read("src/routes/reset-password.tsx"),
  read("supabase/migrations/202607170002_account_profile_verification_integrity.sql"),
  read(".github/workflows/account-profile-verification-integrity.yml"),
  read(".github/workflows/quality-gate.yml"),
  read("package.json"),
  read("src/lib/api/notification-preferences.ts"),
]);

function exportedFunction(source, name, nextMarker = "\nexport ") {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const end = source.indexOf(nextMarker, start + 10);
  return source.slice(start, end === -1 ? source.length : end);
}

test("private account APIs derive the current actor and expose actor-free signatures", () => {
  assert.match(accountIdentity, /client\.auth\.getUser\(\)/);
  assert.match(accountIdentity, /accountSessionStillMatches/);

  const update = exportedFunction(profileApi, "updateMyProfile");
  const upload = exportedFunction(profileApi, "uploadMyProfileMedia");
  const remove = exportedFunction(profileApi, "removeMyProfileMedia");
  const history = exportedFunction(verificationApi, "fetchMyVerificationRequests");
  const create = exportedFunction(verificationApi, "createMyVerificationRequest");
  const password = exportedFunction(accountSecurity, "changeOwnPassword");
  const deletion = exportedFunction(supportApi, "createAccountDeletionRequest");

  for (const fn of [update, upload, remove, history, create, deletion]) {
    assert.match(fn, /resolveAuthenticatedAccountId/);
  }
  for (const fn of [update, upload, remove, history, create, password, deletion]) {
    const signature = fn.slice(0, fn.indexOf("):"));
    assert.doesNotMatch(signature, /userId|profileId|ownerId|accountId/);
  }
  assert.match(password, /authChangePassword\(currentPassword, newPassword\)/);
  assert.doesNotMatch(password, /getClient|client\.auth|userId|profileId|ownerId|accountId/);
  assert.doesNotMatch(profileRoute, /updateOwnProfileBasics\(currentProfileId/);
  assert.doesNotMatch(verificationRoute, /fetchMyVerificationRequests\(profileId/);
  assert.doesNotMatch(verificationRoute, /userId:\s*profileId/);
});

test("public and private profile DTO boundaries are explicit and allowlisted", () => {
  assert.match(authTypes, /export interface PrivateAccountProfile/);
  assert.match(profileDto, /privateAccountProfileSelect/);
  assert.match(profileDto, /publicSellerProfileSelect/);
  assert.match(auth, /loadCloudflareUserProfile\(next\)/);
  assert.doesNotMatch(auth, /\.select\(|getClient\(|client\.auth/);
  assert.match(sellerApi, /\.select\(publicSellerProfileSelect\)/);

  const publicSelect = profileDto.match(/publicSellerProfileSelect\s*=\s*\n?\s*"([^"]+)"/)?.[1];
  assert.ok(publicSelect);
  for (const forbidden of [
    "email",
    "phone",
    "whatsapp",
    "avatar_path",
    "cover_path",
    "verification_status",
    "account_status",
    "admin_note",
  ]) {
    assert.ok(!publicSelect.split(",").includes(forbidden), `${forbidden} leaked publicly`);
  }
  assert.doesNotMatch(sellerApi, /first_name|last_name|avatar_path|cover_path/);
  assert.match(migration, /p\.verification_status = 'verified' as verified/);
});

test("profile updates are normalized, allowlisted, and cannot change authority fields", () => {
  assert.match(profileApi, /normalizeProfilePayload/);
  assert.match(profileApi, /preferredContactMethod.*\["phone", "whatsapp", "chat"\]/s);
  assert.match(profileApi, /rpc\("rawaj_update_my_profile"/);
  assert.match(profileDto, /forbiddenSelfProfileUpdateFields/);
  for (const forbidden of ["verification_status", "account_status", "role", "created_at"]) {
    assert.doesNotMatch(
      exportedFunction(profileApi, "updateMyProfile"),
      new RegExp(`${forbidden}\\s*:`),
    );
  }
  assert.match(migration, /revoke update on table public\.profiles from anon, authenticated/);
  assert.match(migration, /where id = v_actor/);
  assert.match(migration, /v_actor uuid := auth\.uid\(\)/);
});

test("avatar and cover lifecycle is owner-scoped, bounded, and replacement-safe", () => {
  assert.match(profileApi, /validateProfileImageFile\(file\)/);
  assert.match(profileApi, /buildProfileMediaPath\(actor\.data, kind, file\.name\)/);
  assert.match(profileApi, /accountSessionStillMatches/);
  assert.match(profileApi, /cleanupUnlinkedProfileMedia/);
  assert.match(profileApi, /setMyProfileMediaReference[\s\S]*remove\(\[currentPath\.data\]\)/);
  assert.doesNotMatch(profileApi, /userId[,:]\s*currentProfileId|oldPath/);
  assert.match(migration, /file_size_limit = excluded\.file_size_limit/);
  assert.match(migration, /auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[1\]/);
  assert.match(migration, /drop policy if exists "RAWAJ users update own profile media"/);
  assert.match(migration, /profile_media_not_owned/);
  assert.match(migration, /o\.bucket_id = 'profile-media'/);
});

test("verification evidence remains private and cannot be addressed as another account", () => {
  assert.match(migration, /'verification-documents',[\s\S]*false,[\s\S]*10485760/);
  assert.match(
    migration,
    /array\['image\/jpeg', 'image\/png', 'image\/webp', 'application\/pdf'\]/,
  );
  assert.match(migration, /auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[1\]/);
  assert.doesNotMatch(verificationApi, /getPublicUrl/);
  assert.match(verificationApi, /verificationDocumentMaxBytes = 10 \* 1024 \* 1024/);
  assert.match(verificationApi, /allowedExtensions\.includes\(extension\)/);
  assert.match(verificationApi, /cacheControl: "0"/);
  assert.match(migration, /o\.metadata ->> 'mimetype'/);
  assert.match(migration, /\(storage\.foldername\(o\.name\)\)\[2\] = p_request_id::text/);
});

test("verification history and creation return minimum owner DTOs", () => {
  assert.match(verificationApi, /ownerVerificationRequestSelect/);
  const ownerSelect = verificationApi.match(
    /ownerVerificationRequestSelect\s*=\s*\n?\s*"([^"]+)"/,
  )?.[1];
  assert.ok(ownerSelect);
  for (const forbidden of ["user_id", "document_path", "admin_note", "reviewed_by"]) {
    assert.ok(!ownerSelect.split(",").includes(forbidden));
  }
  assert.match(migration, /rawaj_fetch_my_verification_requests/);
  assert.match(migration, /drop policy if exists "seller_verification_user_select_own"/);
  assert.match(migration, /where auth\.uid\(\) is not null[\s\S]*r\.user_id = auth\.uid\(\)/);
  assert.doesNotMatch(verificationApi, /\.select\("\*"\)/);
  assert.doesNotMatch(verificationApi, /adminNote:.*mapOwnerVerificationRequest/s);
});

test("pending verification concurrency and status authority are database-controlled", () => {
  assert.match(migration, /idx_seller_verification_open_unique/);
  assert.match(migration, /where status = 'pending_review'/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\('rawaj-verification:'/);
  assert.match(migration, /exception when unique_violation/);
  assert.match(migration, /if v_current_status = p_status/);
  assert.match(migration, /rawaj_create_notification/);
  assert.match(migration, /seller_verification_status_notification/);
  assert.match(migration, /p_request_type not in \('personal', 'business'\)/);
  assert.match(
    migration,
    /v_document_type not in \('national_id', 'passport', 'other_government_id'\)/,
  );
  assert.match(
    migration,
    /v_document_type not in \('commercial_registration', 'business_license', 'tax_document'\)/,
  );
  assert.match(migration, /status, request_type, legal_name/);
  assert.doesNotMatch(profileApi, /verification_status\s*:/);
  assert.match(sellerApi, /verified:\s*rowBoolean\(profile, "verified"\)/);
});

test("admin document and moderation access remains capability-checked and short-lived", () => {
  assert.match(verificationApi, /if \(!canManageVerifications\)/);
  assert.match(verificationApi, /verificationDocumentSignedUrlSeconds = 120/);
  assert.match(verificationApi, /\.select\("id,document_path"\)/);
  assert.match(verificationApi, /\.eq\("id", requestId\)/);
  assert.match(adminRoute, /adminCreateVerificationDocumentSignedUrl\([\s\S]*request\.id/);
  assert.doesNotMatch(adminRoute, /href=\{request\.documentPath\}/);
  assert.match(migration, /current_user_is_admin_like\(\)/);
  assert.match(migration, /security definer/g);
  assert.match(migration, /set search_path = public/g);
  assert.match(verificationApi, /adminVerificationRequestSelect/);
});

test("account switching and logout invalidate private route state and stale completions", () => {
  assert.match(verificationRoute, /profileIdRef = useRef/);
  assert.match(verificationRoute, /submissionProfileId !== profileIdRef\.current/);
  assert.match(verificationRoute, /setDocumentFile\(null\)/);
  assert.match(verificationRoute, /setRequests\(\[\]\)/);
  assert.match(profileRoute, /currentProfileId !== profileIdRef\.current/);
  assert.match(profileRoute, /setVerificationRequests\(\[\]\)/);
  assert.match(profileRoute, /setMediaSaving\(null\)/);
  assert.match(auth, /loadRequestIdRef\.current \+= 1/);
  assert.match(auth, /setProfile\(null\)/);
  assert.match(auth, /clearLocalNativePushState\(\)/);
  assert.match(adminRoute, /setDocumentUrls\(\{\}\)/);
});

test("login and recovery redirect boundaries remain internal and session-bound", () => {
  assert.match(authReturn, /!trimmed\.startsWith\("\/"\)/);
  assert.match(authReturn, /trimmed\.startsWith\("\/\/"\)/);
  assert.match(authReturn, /url\.origin !== origin/);
  assert.match(authReturn, /containsControlCharacter/);
  assert.match(authReturn, /containsEncodedRedirectBypass/);
  assert.match(authReturn, /decodeURIComponent/);
  assert.match(authReturn, /new URL\(trimmed, origin\)/);
  assert.match(resetRoute, /authConfirmPasswordReset\(recoveryToken, password\)/);
  assert.match(resetRoute, /const recoveryToken =/);
  assert.doesNotMatch(resetRoute, /onAuthStateChange|PASSWORD_RECOVERY|getSession\(\)/);
});

test("account deletion is reviewed, auth-derived, and duplicate-safe", () => {
  assert.match(supportApi, /rpc\("rawaj_request_my_account_deletion"\)/);
  assert.match(migration, /idx_support_account_deletion_open_unique/);
  assert.match(migration, /rawaj_request_my_account_deletion\(\)/);
  assert.match(migration, /v_actor uuid := auth\.uid\(\)/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\('rawaj-account-deletion:'/);
  assert.doesNotMatch(profileRoute, /createAccountDeletionRequest\(currentProfileId\)/);
  assert.doesNotMatch(profileRoute, /\.from\([^)]*\)[\s\S]{0,120}\.delete\(/);
});

test("Phase 12 preferences remain account-scoped and browser-safe", () => {
  assert.match(phase12Api, /getAuthenticatedUserId/);
  assert.doesNotMatch(phase12Api, /service_role|SUPABASE_SERVICE_ROLE/i);
  assert.match(profileRoute, /settingsPreferredContact/);
  assert.match(profileApi, /preferred_contact_method/);
});

test("permanent workflow and quality integration are read-only and bounded", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run test:account-profile-verification/);
  assert.match(workflow, /run: npm run typecheck -- --pretty false/);
  assert.doesNotMatch(workflow, /contents: write|service[_-]?role|supabase db|deploy|git push/i);
  assert.match(qualityGate, /Account, Profile & Verification Integrity contract/);
  assert.match(qualityGate, /npm run test:account-profile-verification/);
  assert.match(packageJson, /"test:account-profile-verification"/);
  assert.match(
    packageJson,
    /test:notifications-activity-push && npm run test:account-profile-verification/,
  );
});

test("Phase 13 introduces no production write, geolocation, Radius, or native Android change", () => {
  const combined = [profileApi, verificationApi, accountSecurity, migration, workflow].join("\n");
  assert.doesNotMatch(combined, /service[_-]?role|SUPABASE_SERVICE_ROLE/i);
  assert.doesNotMatch(combined, /navigator\.geolocation|\bRadius\b|nearby/i);
  assert.doesNotMatch(workflow, /production|workflow_run|push:/i);
  assert.match(profileRoute, /useUiPreferences/);
  assert.match(verificationRoute, /useUiPreferences/);
  assert.match(profileRoute, /mobile-page-bottom/);
  assert.match(verificationRoute, /mobile-page-bottom/);
});
