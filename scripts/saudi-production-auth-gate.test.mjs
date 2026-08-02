import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// Keep this gate release-blocking: every signed-in Saudi feature crosses Firebase and Cloudflare.
test("Saudi finalizer blocks releases on the full Firebase Cloudflare journey", async () => {
  const workflow = await readFile(".github/workflows/saudi-finalize-production.yml", "utf8");
  assert.match(workflow, /playwright install --with-deps chromium/);
  assert.match(workflow, /saudi-firebase-cloudflare-production-e2e\.mjs/);
  assert.match(workflow, /Clean disposable Firebase Cloudflare gate data/);
  assert.match(workflow, /public_profiles/);
  assert.match(workflow, /auth_users/);
});

test("Production auth gate covers Firebase, private gateway, D1 and R2", async () => {
  const script = await readFile("scripts/saudi-firebase-cloudflare-production-e2e.mjs", "utf8");
  assert.match(script, /accounts:signUp/);
  assert.match(script, /accounts:signInWithPassword/);
  assert.match(script, /accounts:sendOobCode/);
  assert.match(script, /نسيت كلمة المرور\|Forgot password/);
  assert.match(script, /إرسال رابط إعادة التعيين\|Send reset link/);
  assert.doesNotMatch(script, /login\?mode=forgot/);
  assert.match(script, /accounts\.google\.com/);
  assert.match(script, /Google OAuth popup did not open/);
  assert.match(script, /\/api\/profile/);
  assert.match(script, /notification-preferences/);
  assert.match(script, /profile\/media/);
  assert.match(script, /R2 avatar read failed/);
  assert.match(script, /Removed R2 avatar remained accessible/);
  assert.match(script, /Firebase browser session did not persist/);
  // The UI label "messages" is normalized to the canonical Worker value "chat".
  assert.match(script, /preferredContactMethod: "chat"/);
  assert.doesNotMatch(script, /preferredContactMethod: "messages"/);
});
