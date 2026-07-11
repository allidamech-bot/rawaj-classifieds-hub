import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, shared, login, profile, css, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/features/account/AccountExperience.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/profile.tsx", import.meta.url), "utf8"),
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
  assert.match(profile, /to="\/support"/);
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
