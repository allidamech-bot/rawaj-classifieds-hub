#!/usr/bin/env node
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");
const write = (relative, content) =>
  writeFile(path.join(root, relative), content.endsWith("\n") ? content : `${content}\n`, "utf8");

function replaceOrThrow(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`followup replacement failed: ${label}`);
  return next;
}

await write(
  "src/lib/api/account-security.ts",
  `import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { supabaseAuth } from "@/lib/supabase-auth";

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<ClassifiedsResult<null>> {
  if (!currentPassword || newPassword.length < 8 || newPassword.length > 72) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "يجب أن تكون كلمة المرور بين 8 و72 حرفاً.",
      },
    };
  }

  const client = supabaseAuth;
  if (!client) {
    return {
      ok: false,
      error: { code: "setup_required", message: "خدمة الحسابات غير متاحة الآن." },
    };
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const currentUser = sessionData.session?.user ?? null;
  const email = currentUser?.email?.trim() ?? "";
  if (sessionError || !currentUser || !email) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "تسجيل الدخول مطلوب." },
    };
  }

  const { data: reauthenticated, error: reauthError } = await client.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthError || reauthenticated.user?.id !== currentUser.id) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "كلمة المرور الحالية غير صحيحة." },
    };
  }

  const { error: updateError } = await client.auth.updateUser({ password: newPassword });
  if (!updateError) return { ok: true, data: null };

  const message = updateError.message || "تعذر تغيير كلمة المرور.";
  const normalized = message.toLowerCase();
  if (normalized.includes("weak") || normalized.includes("password")) {
    return {
      ok: false,
      error: { code: "validation_error", message: "كلمة المرور الجديدة غير مقبولة." },
    };
  }
  return { ok: false, error: { code: "unknown", message } };
}
`,
);

for (const file of await readdir(path.join(root, "cloudflare/worker/src"))) {
  if (!file.endsWith(".ts")) continue;
  const relative = `cloudflare/worker/src/${file}`;
  const source = await read(relative);
  const next = source
    .replaceAll("FIREBASE_PROJECT_ID", "SUPABASE_URL")
    .replaceAll("FIREBASE_AUTH_TEST_JWKS", "SUPABASE_AUTH_TEST_JWKS")
    .replaceAll("FIREBASE_JWKS_URL", "SUPABASE_JWKS_URL");
  if (next !== source) await write(relative, next);
}

let cleanup = await read("scripts/cloudflare-runtime-cleanup.test.mjs");
if (!cleanup.includes('"src/lib/api/account-security.ts"')) {
  cleanup = replaceOrThrow(
    cleanup,
    '    "src/lib/native-push.ts",\n    "src/routes/auth.callback.tsx",',
    '    "src/lib/native-push.ts",\n    "src/lib/api/account-security.ts",\n    "src/routes/auth.callback.tsx",',
    "cleanup allow account-security",
  );
}
cleanup = replaceOrThrow(
  cleanup,
  /    if \(!allowedAuthFiles\.has\(relativePath\)\) \{[\s\S]*?\n    \}/,
  `    if (relativePath.startsWith("src/") && !allowedAuthFiles.has(relativePath)) {
      assert.doesNotMatch(
        source,
        /@supabase\\/supabase-js|@\\/lib\\/supabase-auth|\\bsupabaseAuth\\b|VITE_SUPABASE_/,
        relativePath,
      );
    }`,
  "cleanup frontend boundary",
);
await write("scripts/cloudflare-runtime-cleanup.test.mjs", cleanup);

let audit = await read("scripts/retired-backend-runtime-audit.mjs");
if (!audit.includes('"src/lib/api/account-security.ts"')) {
  audit = replaceOrThrow(
    audit,
    '  "src/lib/native-push.ts",\n  "src/routes/auth.callback.tsx",',
    '  "src/lib/native-push.ts",\n  "src/lib/api/account-security.ts",\n  "src/routes/auth.callback.tsx",',
    "audit allow account-security",
  );
}
audit = replaceOrThrow(
  audit,
  /    collect\(content, path, \[[\s\S]*?\n    if \(!allowedSupabaseAuthFiles\.has\(path\)\) \{[\s\S]*?\n    \}/,
  `    collect(content, path, [
      ["firebase-runtime-reference", /firebase(?:\\/auth|Auth|_AUTH|_PROJECT|\\.googleapis)/gi],
    ]);

    const referencesSupabaseClient =
      /@supabase\\/supabase-js|@\\/lib\\/supabase-auth|\\bsupabaseAuth\\b/.test(content);
    if (referencesSupabaseClient) {
      collect(content, path, [
        ["retired-supabase-data-transport", /\\.from\\s*\\(|\\.rpc\\s*\\(|\\.storage(?:\\.|\\[)|\\.channel\\s*\\(/g],
      ]);
    }

    if (path.startsWith("src/") && !allowedSupabaseAuthFiles.has(path)) {
      collect(content, path, [
        ["supabase-auth-outside-boundary", /@supabase\\/supabase-js|@\\/lib\\/supabase-auth|\\bsupabaseAuth\\b|VITE_SUPABASE_/g],
      ]);
    }`,
  "audit scoped transport rules",
);
await write("scripts/retired-backend-runtime-audit.mjs", audit);

console.log("Supabase Auth follow-up boundary fixes applied.");
