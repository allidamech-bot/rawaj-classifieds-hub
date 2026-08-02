import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("password reset does not depend on a market hostname allowlist", async () => {
  const auth = await readFile("src/lib/auth.tsx", "utf8");
  const start = auth.indexOf("const requestPasswordReset = async");
  const end = auth.indexOf("const signInWithGoogle = async", start);
  assert.ok(start >= 0 && end > start);
  const reset = auth.slice(start, end);
  assert.match(reset, /sendPasswordResetEmail\(firebaseAuth, normalizeAuthEmail\(email\)\)/);
  assert.doesNotMatch(reset, /window\.location\.origin/);
  assert.doesNotMatch(reset, /handleCodeInApp/);
  assert.doesNotMatch(reset, /url:/);
});
