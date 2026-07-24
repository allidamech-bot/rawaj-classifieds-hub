import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production recovery uses a restricted native Cloudflare email binding", async () => {
  const [auth, configText] = await Promise.all([
    readFile(new URL("../src/auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.base.jsonc", import.meta.url), "utf8"),
  ]);
  const config = JSON.parse(configText.replace(/,\s*([}\]])/g, "$1"));

  assert.deepEqual(config.send_email, [
    {
      name: "RECOVERY_EMAIL",
      allowed_sender_addresses: ["noreply@rawa-j.com"],
    },
  ]);
  assert.equal(config.vars.AUTH_RECOVERY_FROM, "noreply@rawa-j.com");
  assert.equal(config.vars.AUTH_RECOVERY_APP_ORIGIN, "https://rawa-j.com");
  assert.match(auth, /env\.RECOVERY_EMAIL!\.send\(/);
  assert.match(auth, /if \(!env\.RECOVERY_EMAIL\) return null/);
  assert.match(auth, /from\.endsWith\("@rawa-j\.com"\)/);
  assert.match(auth, /origin\.protocol !== "https:"/);
  assert.match(auth, /rawaj_recovery_delivery_failed/);
  assert.match(auth, /safeEmailErrorCode\(error\)/);
  assert.doesNotMatch(auth, /console\.(?:log|error)\([^)]*(?:developmentToken|token)\b/);
});

test("Arabic recovery message contains one-time purpose, expiry, and ignore guidance", async () => {
  const auth = await readFile(new URL("../src/auth.ts", import.meta.url), "utf8");

  assert.match(auth, /استعادة كلمة المرور في رواج/);
  assert.match(auth, /تنتهي صلاحية هذا الرابط بعد 30 دقيقة/);
  assert.match(auth, /يمكن استخدامه مرة واحدة فقط/);
  assert.match(auth, /إذا لم تطلب استعادة كلمة المرور فتجاهل هذه الرسالة/);
  assert.match(auth, /new URL\("\/reset-password", appOrigin\)/);
  assert.match(auth, /searchParams\.set\("token", token\)/);
});
