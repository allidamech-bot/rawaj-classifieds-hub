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
  assert.match(profile, /setMyListingsHasLoaded\(true\)/);
  assert.match(profile, /setVerificationHasLoaded\(true\)/);
  assert.doesNotMatch(
    profile,
    /setMyListingsError\(result\.error\);[\s\S]{0,80}setMyListings\(\[\]\)/,
  );
  assert.doesNotMatch(
    profile,
    /setVerificationError\(result\.error\);[\s\S]{0,80}setVerificationRequests\(\[\]\)/,
  );
});

test("profile overview requests reject stale account and route responses", () => {
  assert.match(profile, /const listingsRequestIdRef = useRef\(0\)/);
  assert.match(profile, /const verificationRequestIdRef = useRef\(0\)/);
  assert.match(profile, /requestId !== listingsRequestIdRef\.current/);
  assert.match(profile, /requestId !== verificationRequestIdRef\.current/);
  assert.match(profile, /currentProfileId !== profileIdRef\.current/);
});

test("profile media replacement validates files and never deletes the old image before linking the new one", () => {
  assert.match(profileApi, /validateProfileImageFile\(file\)/);
  assert.match(profileApi, /buildProfileMediaPath\(actor\.data, kind, file\.name\)/);
  assert.match(profileApi, /upsert: false/);
  const uploadIndex = profileApi.indexOf(".upload(storagePath, file");
  const profileUpdateIndex = profileApi.indexOf("setMyProfileMediaReference(", uploadIndex);
  const oldMediaCleanupIndex = profileApi.indexOf(
    ".remove([currentPath.data])",
    profileUpdateIndex,
  );
  assert.ok(uploadIndex >= 0);
  assert.ok(profileUpdateIndex > uploadIndex);
  assert.ok(oldMediaCleanupIndex > profileUpdateIndex);
  assert.match(profileApi, /cleanupUnlinkedProfileMedia/);
  assert.match(profileApi, /isOwnedProfileMediaPath\(currentPath\.data, actor\.data, kind\)/);
  assert.match(profileApi, /accountSessionStillMatches/);
});

test("profile media removal clears the database reference before best-effort storage cleanup", () => {
  const removalFunctionIndex = profileApi.indexOf("export async function removeMyProfileMedia");
  const removalSection = profileApi.slice(removalFunctionIndex);
  const profileUpdateIndex = removalSection.indexOf('rpc("rawaj_clear_my_profile_media"');
  const storageCleanupIndex = removalSection.indexOf(".remove([currentPath.data])");
  assert.ok(profileUpdateIndex >= 0);
  assert.ok(storageCleanupIndex > profileUpdateIndex);
  assert.match(removalSection, /isOwnedProfileMediaPath\(currentPath\.data, actor\.data, kind\)/);
  assert.doesNotMatch(removalSection, /userId|oldPath/);
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
