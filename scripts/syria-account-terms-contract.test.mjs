import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [header, dock, login, authContext, auth, terms] = await Promise.all([
  readFile(new URL("../src/components/shell/FloatingHeader.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/shell/BottomDock.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/login.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth-context.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/auth.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/terms.tsx", import.meta.url), "utf8"),
]);

test("Syrian mobile header exposes an explicit guest login CTA and Syrian location", () => {
  assert.match(header, /تصفح الإعلانات في كل سوريا/);
  assert.match(header, /كل سوريا/);
  assert.match(header, /Browse listings across Syria/);
  assert.doesNotMatch(header, /كل السعودية|All Saudi Arabia/);
  assert.match(header, /auth\.status === "signedIn" \? \(\s*<Link[\s\S]*to="\/more"/);
  assert.match(header, /to="\/login"[\s\S]*<span className="font-bold">\{text\("تسجيل الدخول", "Log in"\)\}<\/span>/);
  assert.match(header, /rawaj-header-cta[\s\S]*font-bold/);
  assert.match(header, /auth\.status === "signedIn" \? <NotificationTrigger tone="light" \/> : null/);
});

test("bottom dock stays visually account-oriented while routing guests to login", () => {
  assert.match(dock, /to:\s*signedIn \? "\/more" : "\/login"/);
  assert.match(dock, /labelAr:\s*"حسابي"/);
  assert.match(dock, /labelEn:\s*"Account"/);
  assert.match(dock, /icon:\s*User/);
  assert.match(dock, /item\.section === "account" && signedIn/);
  assert.doesNotMatch(dock, /labelAr:\s*"تسجيل الدخول"/);
});

test("registration requires explicit Terms and Privacy consent before password signup", () => {
  assert.match(login, /id="registration-policy-consent"/);
  assert.match(login, /type="checkbox"/);
  assert.match(login, /to="\/terms"/);
  assert.match(login, /to="\/privacy"/);
  assert.match(login, /mode === "register" && !acceptedPolicies/);
  assert.match(login, /يجب الموافقة على شروط الاستخدام وسياسة الخصوصية قبل إنشاء الحساب/);
  assert.match(login, /signUpWithPassword\(cleanEmail, password, cleanName, \{/);
  assert.match(login, /termsAccepted:\s*acceptedPolicies/);
  assert.match(login, /privacyAccepted:\s*acceptedPolicies/);
});

test("Google auth cannot start before explicit Terms and Privacy consent", () => {
  assert.match(login, /id="google-policy-consent"/);
  assert.match(login, /blockedByConsent = !acceptedPolicies/);
  assert.match(login, /signInWithGoogle\(returnTo, \{/);
  assert.match(login, /termsAccepted:\s*acceptedPolicies/);
  assert.match(login, /privacyAccepted:\s*acceptedPolicies/);
  assert.match(authContext, /registrationConsent: RegistrationConsent/);
  assert.doesNotMatch(authContext, /registrationConsent\?: RegistrationConsent/);

  const googleFunctionIndex = auth.indexOf("const signInWithGoogle = async");
  const consentGuardIndex = auth.indexOf(
    "if (!hasRegistrationConsent(registrationConsent))",
    googleFunctionIndex,
  );
  const providerIndex = auth.indexOf("new GoogleAuthProvider()", googleFunctionIndex);
  assert.ok(googleFunctionIndex >= 0);
  assert.ok(consentGuardIndex > googleFunctionIndex);
  assert.ok(providerIndex > consentGuardIndex);
});

test("auth runtime rejects password account creation without consent", () => {
  assert.match(authContext, /export interface RegistrationConsent/);
  assert.match(authContext, /termsAccepted: boolean/);
  assert.match(authContext, /privacyAccepted: boolean/);
  assert.match(auth, /function hasRegistrationConsent/);
  assert.match(auth, /if \(!hasRegistrationConsent\(registrationConsent\)\)/);
  assert.match(auth, /createUserWithEmailAndPassword/);
  const guardIndex = auth.indexOf("if (!hasRegistrationConsent(registrationConsent))");
  const createIndex = auth.indexOf("createUserWithEmailAndPassword", guardIndex);
  assert.ok(guardIndex >= 0);
  assert.ok(createIndex > guardIndex);
});

test("Syria terms identify intermediary role, user responsibility, fraud risk and non-waivable rights", () => {
  const normalizedTerms = terms.normalize("NFC");
  assert.match(normalizedTerms, /شروط الاستخدام – سوريا/);
  assert.match(normalizedTerms, /نسخة رَوَاج سوريا/);
  assert.match(normalizedTerms, /وسيط تقني/);
  assert.match(normalizedTerms, /الاحتيال/);
  assert.match(normalizedTerms, /الأسلحة والذخائر/);
  assert.match(normalizedTerms, /تاجراً[\s\S]{0,40}متجراً[\s\S]{0,40}مقدم خدمة/);
  assert.match(normalizedTerms, /لا يضمن هوية أي مستخدم/);
  assert.match(normalizedTerms, /لا يسمح القانون باستبعادها/);
  assert.match(terms, /governed by applicable Syrian law/);
  assert.match(normalizedTerms, /13 آب 2026/);
});
