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

test("Google registration is consent-aware while normal Google login remains available", () => {
  assert.match(login, /registrationMode=\{mode === "register"\}/);
  assert.match(login, /blockedByConsent = registrationMode && !acceptedPolicies/);
  assert.match(login, /registrationMode[\s\S]*termsAccepted: acceptedPolicies/);
  assert.match(login, /registrationMode[\s\S]*privacyAccepted: acceptedPolicies/);
  assert.match(authContext, /registrationConsent\?: RegistrationConsent/);
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
  assert.match(terms, /شروط الاستخدام – سوريا/);
  assert.match(terms, /نسخة رَوَاج سوريا/);
  assert.match(terms, /وسيط تقني/);
  assert.match(terms, /الاحتيال/);
  assert.match(terms, /الأسلحة والذخائر/);
  assert.match(terms, /التاجر أو متجراً أو مقدم خدمة|تاجراً أو متجراً أو مقدم خدمة/);
  assert.match(terms, /لا يضمن هوية أي مستخدم/);
  assert.match(terms, /لا يسمح القانون باستبعادها/);
  assert.match(terms, /القوانين السورية النافذة/);
  assert.match(terms, /13 آب 2026/);
});
