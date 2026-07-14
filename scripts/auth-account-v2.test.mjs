import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, shared, login, profile, profileApi, css, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/account/AccountExperience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/profile.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/auth-account-v2.css", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("auth account V2 stylesheet loads after the existing account foundation", () => {
  assert.match(root, /import authAccountV2Css from "\.\.\/auth-account-v2\.css\?url"/);
  const foundation = root.indexOf("href: authAccountFoundationCss");
  const v2 = root.indexOf("href: authAccountV2Css");
  assert.notEqual(foundation, -1);
  assert.notEqual(v2, -1);
  assert.ok(v2 > foundation);
});

test("login uses one shared account experience without changing authentication flows", () => {
  assert.match(login, /rawaj-auth-v2/);
  assert.match(login, /<AuthExperienceAside mode=\{mode\}/);
  assert.match(login, /<AuthExperienceHeader mode=\{mode\}/);
  assert.match(login, /rawaj-auth-tabs/);
  assert.match(login, /rawaj-auth-google/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /signUp/);
  assert.match(login, /resetPasswordForEmail/);
  assert.match(login, /signInWithGoogle/);
  assert.match(login, /sanitizeAuthReturnTo/);
  assert.match(login, /ensureOwnProfile/);
});

test("account center shares identity, shortcuts, editor and safety while preserving APIs", () => {
  assert.match(profile, /rawaj-account-v2/);
  assert.match(profile, /<AccountIdentityHero/);
  assert.match(profile, /<AccountQuickLinks/);
  assert.match(shared, /rawaj-account-profile-editor/);
  assert.match(profile, /updateOwnProfileBasics/);
  assert.match(profile, /uploadProfileMedia/);
  assert.match(profile, /removeProfileMedia/);
  assert.match(profile, /fetchCurrentUserListings/);
  assert.match(profile, /fetchMyVerificationRequests/);
  assert.match(profile, /auth\.signOut\(\)/);
  assert.match(profile, /createAccountDeletionRequest/);
  assert.match(profile, /changeOwnPassword/);
});

test("profile overview loads recover independently without erasing successful snapshots", () => {
  assert.match(profile, /const \[myListingsHasLoaded, setMyListingsHasLoaded\]/);
  assert.match(profile, /const \[verificationHasLoaded, setVerificationHasLoaded\]/);
  assert.match(profile, /const \[verificationError, setVerificationError\]/);
  assert.match(profile, /const reloadListings = useCallback/);
  assert.match(profile, /const loadVerificationRequests = useCallback/);
  assert.match(profile, /myListingsError && !myListingsHasLoaded/);
  assert.match(profile, /verificationError && !verificationHasLoaded/);
  assert.match(profile, /onAction=\{\(\) => void reloadListings\(\)\}/);
  assert.match(profile, /onAction=\{\(\) => void loadVerificationRequests\(\)\}/);
  assert.doesNotMatch(profile, /setMyListingsError\(result\.error\);[\s\S]{0,80}setMyListings\(\[\]\)/);
  assert.doesNotMatch(profile, /setVerificationError\(result\.error\);[\s\S]{0,80}setVerificationRequests\(\[\]\)/);
});

test("profile overview requests reject stale account and route responses", () => {
  assert.match(profile, /const listingsRequestIdRef = useRef\(0\)/);
  assert.match(profile, /const verificationRequestIdRef = useRef\(0\)/);
  assert.match(profile, /requestId !== listingsRequestIdRef\.current/);
  assert.match(profile, /requestId !== verificationRequestIdRef\.current/);
  assert.match(profile, /currentProfileId !== auth\.profile\?\.id/);
});

test("profile media replacement validates files and never deletes the old image before linking the new one", () => {
  assert.match(profileApi, /allowedImageTypes = \["image\/jpeg", "image\/png", "image\/webp"\]/);
  assert.match(profileApi, /maxProfileImageSizeBytes = 3 \* 1024 \* 1024/);
  assert.match(profileApi, /upsert: false/);
  const uploadIndex = profileApi.indexOf(".upload(storagePath, file");
  const profileUpdateIndex = profileApi.indexOf(".update(updatePayload)");
  const oldMediaCleanupIndex = profileApi.indexOf(".remove([oldPath])");
  assert.ok(uploadIndex >= 0);
  assert.ok(profileUpdateIndex > uploadIndex);
  assert.ok(oldMediaCleanupIndex > profileUpdateIndex);
  assert.match(profileApi, /Failed to clean up unlinked profile media upload/);
  assert.match(profileApi, /oldPath\.startsWith\(`\$\{userId\}\/\$\{kind\}\/`\)/);
});

test("profile media removal clears the database reference before best-effort storage cleanup", () => {
  const removalFunctionIndex = profileApi.indexOf("export async function removeProfileMedia");
  const removalSection = profileApi.slice(removalFunctionIndex);
  const profileUpdateIndex = removalSection.indexOf(".update(updatePayload)");
  const storageCleanupIndex = removalSection.indexOf(".remove([path])");
  assert.ok(profileUpdateIndex >= 0);
  assert.ok(storageCleanupIndex > profileUpdateIndex);
  assert.match(removalSection, /path\.startsWith\(`\$\{userId\}\/\$\{kind\}\/`\)/);
  assert.match(removalSection, /Failed to clean up profile media after profile reference removal/);
});

test("account identity media falls back and accepts refreshed URLs", () => {
  assert.match(shared, /useState<string \| null>\(null\)/);
  assert.match(shared, /failedCoverUrl !== coverUrl/);
  assert.match(shared, /failedAvatarUrl !== avatarUrl/);
  assert.match(shared, /onError=\{\(\) => setFailedCoverUrl\(coverUrl \?\? null\)\}/);
  assert.match(shared, /onError=\{\(\) => setFailedAvatarUrl\(avatarUrl \?\? null\)\}/);
  assert.match(shared, /<User aria-hidden="true" \/>/);
  assert.doesNotMatch(shared, /useEffect/);
});

test("shared account components expose factual identity and protected navigation", () => {
  assert.match(shared, /export function AuthExperienceAside/);
  assert.match(shared, /export function AuthExperienceHeader/);
  assert.match(shared, /export function AccountIdentityHero/);
  assert.match(shared, /export function AccountQuickLinks/);
  assert.match(shared, /export function AccountSection/);
  assert.match(shared, /to="\/profile\/listings"/);
  assert.match(shared, /to="\/chats"/);
  assert.match(shared, /to="\/favorites"/);
  assert.match(shared, /to="\/notifications"/);
  assert.doesNotMatch(shared, /guaranteed|100% secure|bank-grade/i);
});

test("auth and account V2 stays responsive, RTL neutral and reduced-motion safe", () => {
  assert.match(css, /\.rawaj-auth-layout/);
  assert.match(css, /\.rawaj-account-identity/);
  assert.match(css, /\.rawaj-account-quick-links/);
  assert.match(css, /inset-inline/);
  assert.match(css, /@media \(min-width: 900px\)/);
  assert.match(css, /@media \(max-width: 389px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("quality gate permanently runs auth account V2 read-only", () => {
  assert.match(qualityGate, /contents: read/);
  assert.match(qualityGate, /Auth and Account V2 contract/);
  assert.match(qualityGate, /node --test scripts\/auth-account-v2\.test\.mjs/);
  assert.doesNotMatch(qualityGate, /contents: write/);
});
