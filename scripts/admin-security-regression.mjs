import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const migrations = readdirSync(join(root, "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => read(`supabase/migrations/${name}`))
  .join("\n");

const authTypes = read("src/lib/auth-types.ts");
const adminShell = read("src/routes/admin.tsx");
const adminUsers = read("src/routes/admin.users.tsx");
const adminPending = read("src/routes/admin.pending.tsx");
const adminReviews = read("src/routes/admin.reviews.tsx");
const bottomNav = read("src/components/BottomNav.tsx");
const primaryNavigation = read("src/lib/primary-navigation.ts");

const failures = [];
let assertions = 0;

function expect(label, condition) {
  assertions += 1;
  if (!condition) failures.push(label);
}

function roleBlock(role, nextRole) {
  const start = authTypes.indexOf(`  ${role}: {`);
  const end = nextRole
    ? authTypes.indexOf(`  ${nextRole}: {`, start + 1)
    : authTypes.indexOf("};", start + 1);
  return start >= 0 && end > start ? authTypes.slice(start, end) : "";
}

const owner = roleBlock("owner", "admin");
const admin = roleBlock("admin", "moderator");
const moderator = roleBlock("moderator", "seller");
const seller = roleBlock("seller", "user");

expect("owner keeps owner controls", owner.includes("canManageOwnerControls: true"));
expect("owner keeps system settings", owner.includes("canManageSystemSettings: true"));
expect("admin cannot manage owner controls", admin.includes("canManageOwnerControls: false"));
expect("admin cannot manage system settings", admin.includes("canManageSystemSettings: false"));
expect("moderator cannot manage users", moderator.includes("canManageUsers: false"));
expect("moderator cannot ban users", moderator.includes("canBanUsers: false"));
expect("moderator cannot view audit logs", moderator.includes("canViewAuditLogs: false"));
expect("seller cannot access admin", seller.includes("canViewAdminDashboard: false"));

expect(
  "admin users route uses user permission",
  adminUsers.includes('hasPermission("canManageUsers")'),
);
expect(
  "pending moderation uses listing permission",
  adminPending.includes('hasPermission("canModerateListings")'),
);
expect(
  "review moderation separates review permission",
  adminReviews.includes('hasPermission("canManageReviews")'),
);
expect(
  "review reports separate report permission",
  adminReviews.includes('hasPermission("canManageReports")'),
);
expect(
  "admin navigation filters by permission",
  adminShell.includes("auth.hasPermission(tab.permission)"),
);

for (const permission of [
  "canManageUsers",
  "canModerateListings",
  "canManageReports",
  "canManageReviews",
  "canManageVerifications",
  "canManagePromotions",
  "canManageAdPlacements",
  "canManageAdCampaigns",
  "canViewAuditLogs",
  "canManageSystemSettings",
]) {
  expect(`role matrix declares ${permission}`, authTypes.includes(`${permission}: boolean`));
}

expect("sensitive migrations enable RLS", /enable row level security/i.test(migrations));
expect("owner-sensitive RPCs recheck owner", migrations.includes("current_user_has_role('owner')"));
expect("stale write guards exist", /stale_[a-z_]+/i.test(migrations));
expect("sensitive mutations write audit events", migrations.includes("rawaj_insert_audit_log"));

const primaryTargets = ["/", "/categories", "/add-listing", "/offers", "/more"];
for (const target of primaryTargets) {
  expect(`bottom navigation preserves ${target}`, bottomNav.includes(`to: "${target}"`));
}
expect("admin routes remain outside public navigation", primaryNavigation.includes('"/admin"'));

if (failures.length > 0) {
  process.stderr.write("Admin security regression failed:\n\n");
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(`Admin security regression passed (${assertions} invariants).\n`);
