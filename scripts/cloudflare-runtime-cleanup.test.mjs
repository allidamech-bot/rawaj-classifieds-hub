import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");
const vendor = "supabase";

async function walk(relativeDirectory) {
  const directory = new URL(`${relativeDirectory}/`, root);
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(relativePath)));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)) output.push(relativePath);
  }
  return output;
}

test("retired backend directories, inventories, and compatibility modules are removed", async () => {
  for (const relativePath of [
    vendor,
    `${vendor}-runtime-inventory.json`,
    `${vendor}-runtime-inventory-v2.json`,
    "cloudflare/migration",
    `src/lib/${vendor}.ts`,
    "src/lib/api/account-identity.ts",
  ]) {
    await assert.rejects(access(new URL(relativePath, root)), { code: "ENOENT" }, relativePath);
  }
});

test("Supabase is restricted to authentication while data and storage remain on Cloudflare", async () => {
  const [packageSource, packageLock] = await Promise.all([
    read("package.json"),
    read("package-lock.json"),
  ]);
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.dependencies?.["@supabase/supabase-js"] ?? "", /^\^2\./);
  assert.equal(packageJson.dependencies?.firebase, undefined);
  assert.doesNotMatch(packageLock, /node_modules\/firebase(?:\/|")/);

  const allowedAuthFiles = new Set([
    "src/lib/supabase-auth.ts",
    "src/lib/auth-context.ts",
    "src/lib/auth-recovery-session.ts",
    "src/lib/auth.tsx",
    "src/lib/cloudflare-auth.ts",
    "src/lib/native-push.ts",
    "src/lib/api/account-security.ts",
    "src/routes/auth.callback.tsx",
    "src/routes/reset-password.tsx",
    "cloudflare/worker/src/auth.ts",
  ]);
  const runtimeFiles = [...(await walk("src")), ...(await walk("cloudflare/worker/src"))];
  for (const relativePath of runtimeFiles) {
    const source = await read(relativePath);
    assert.doesNotMatch(
      source,
      /firebase(?:\/auth|Auth|_AUTH|_PROJECT|\.googleapis)/i,
      relativePath,
    );
    if (relativePath.startsWith("src/") && !allowedAuthFiles.has(relativePath)) {
      assert.doesNotMatch(
        source,
        /@supabase\/supabase-js|@\/lib\/supabase-auth|\bsupabaseAuth\b|VITE_SUPABASE_/,
        relativePath,
      );
    }
  }

  for (const relativePath of allowedAuthFiles) {
    const source = await read(relativePath);
    assert.doesNotMatch(
      source,
      /\.from\s*\(|\.rpc\s*\(|\.storage(?:\.|\[)|\.channel\s*\(/,
      relativePath,
    );
  }
});

test("current documentation replaces retired operational runbooks", async () => {
  for (const relativePath of [
    "docs/cloudflare/current-architecture.md",
    "docs/cloudflare/local-validation.md",
  ]) {
    await access(new URL(relativePath, root));
  }
  for (const relativePath of [
    `docs/${vendor}-auth-foundation.md`,
    "docs/cloudflare/migration-status-and-plan.md",
    "docs/database-migration-status.md",
    "docs/production-audit-runbook.md",
  ]) {
    await assert.rejects(access(new URL(relativePath, root)), { code: "ENOENT" }, relativePath);
  }
});

test("notifications and chat use bounded Cloudflare polling without realtime channels", async () => {
  const [unread, notifications, liveChat] = await Promise.all([
    read("src/lib/unread-activity.tsx"),
    read("src/routes/notifications.tsx"),
    read("src/features/communication/useLiveChatWorkspace.ts"),
  ]);
  assert.match(unread, /window\.setInterval\(refreshWhenVisible, 30_000\)/);
  assert.match(notifications, /window\.setInterval\(\(\) => void refreshWhenVisible\(\), 15_000\)/);
  assert.match(liveChat, /window\.setInterval\(refreshWhenVisible, 15_000\)/);
  for (const source of [unread, notifications, liveChat]) {
    assert.doesNotMatch(source, /\.channel\s*\(|removeChannel|getClient\s*\(/);
    assert.match(source, /visibilitychange/);
  }
});

test("native push account stability is derived from Supabase Auth", async () => {
  const source = await read("src/lib/native-push.ts");
  assert.match(source, /import \{ supabaseAuth \} from "@\/lib\/supabase-auth"/);
  assert.match(source, /client\.auth\.getSession\(\)/);
  assert.doesNotMatch(source, /firebaseAuth|getAuthenticatedUserId|getClient\s*\(/);
});

test("CSP and runtime provider fail closed on Cloudflare only", async () => {
  const [server, config] = await Promise.all([
    read("src/server.ts"),
    read("src/lib/public-data/config.ts"),
  ]);
  assert.doesNotMatch(server, new RegExp(vendor, "i"));
  assert.match(server, /https:\/\/api\.rawa-j\.com/);
  assert.match(config, /provider: "cloudflare"/);
  assert.match(config, /export type PublicDataProviderName = "cloudflare"/);
  assert.doesNotMatch(config, /VITE_PUBLIC_DATA_PROVIDER/);
});

test("legacy imported identities fail closed while Supabase identities use the canonical provider", async () => {
  const [migration, auth] = await Promise.all([
    read("cloudflare/d1/migrations/0015_retire_legacy_auth_provider.sql"),
    read("cloudflare/worker/src/auth.ts"),
  ]);
  assert.match(migration, /SET auth_provider = 'legacy_import'/);
  assert.match(auth, /auth_provider = 'supabase'/);
  assert.doesNotMatch(auth, /auth_provider = 'firebase'/);
});

test("public listing detail and all admin workspaces use Cloudflare implementations", async () => {
  const [detail, availability] = await Promise.all([
    read("src/features/listing-detail/public-listing-detail-page-data.ts"),
    read("src/lib/admin-availability.ts"),
  ]);
  assert.match(detail, /fetchPublicSellerProfile\(listing\.ownerId\)/);
  assert.match(detail, /fetchPublicListingTaxonomyAssignment\(listing\.id\)/);
  assert.match(detail, /fetchPublicListingLocationPath\(listing\.id\)/);
  assert.doesNotMatch(detail, /cloudflareMode|Promise\.resolve\(\{ ok: true as const, data: null/);
  assert.doesNotMatch(availability, /:\s*false/);
});
