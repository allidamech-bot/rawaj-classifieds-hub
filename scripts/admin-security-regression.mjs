import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const migrationsDir = join(root, "supabase", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n");

const authTypes = read("src/lib/auth-types.ts");
const adminShell = read("src/routes/admin.tsx");
const adminUsers = read("src/routes/admin.users.tsx");
const adminPending = read("src/routes/admin.pending.tsx");
const adminOwnerControls = read("src/routes/admin.owner-controls.tsx");
const adminSafety = read("src/routes/admin.safety.tsx");
const routeTree = read("src/routeTree.gen.ts");
const primaryNavigation = read("src/lib/primary-navigation.ts");
const bottomNav = read("src/components/BottomNav.tsx");

const failures = [];
let assertionCount = 0;
function expect(label, condition) {
  assertionCount += 1;
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

expect("owner must manage owner controls", owner.includes("canManageOwnerControls: true"));
expect("owner must manage system settings", owner.includes("canManageSystemSettings: true"));
expect("admin must not manage owner controls", admin.includes("canManageOwnerControls: false"));
expect("admin must not manage system settings", admin.includes("canManageSystemSettings: false"));
expect("moderator must not manage users", moderator.includes("canManageUsers: false"));
expect("moderator must not ban users", moderator.includes("canBanUsers: false"));
expect("moderator must not view full audit logs", moderator.includes("canViewAuditLogs: false"));

expect(
  "admin users route must require user-management permission",
  adminUsers.includes('hasPermission("canManageUsers")'),
);
expect(
  "pending moderation route must require moderation permission",
  adminPending.includes('hasPermission("canModerateListings")'),
);
expect(
  "owner controls route must require system-settings permission",
  adminOwnerControls.includes('hasPermission("canManageSystemSettings")'),
);
expect(
  "safety route must require report-management permission",
  adminSafety.includes('hasPermission("canManageReports")'),
);
expect(
  "admin shell must filter tabs by permission",
  adminShell.includes("auth.hasPermission(tab.permission)"),
);
expect(
  "owner controls navigation must be permission-gated",
  adminShell.includes('permission: "canManageSystemSettings"'),
);
expect(
  "campaign navigation must be permission-gated",
  adminShell.includes('permission: "canManageAdCampaigns"'),
);
expect("route tree must contain owner controls", routeTree.includes("admin/owner-controls"));
expect("route tree must contain campaigns", routeTree.includes("admin/campaigns"));

expect(
  "owner control table must use RLS",
  migrations.includes("alter table public.owner_system_controls enable row level security"),
);
expect(
  "owner system RPC must re-check owner role",
  migrations.includes("not public.current_user_has_role('owner')"),
);
expect("owner controls must reject stale writes", migrations.includes("stale_system_control"));
expect(
  "owner control changes must be audited",
  migrations.includes("owner_system_control.changed"),
);
expect(
  "emergency read-only must be database-enforced",
  migrations.includes("system_control_active:emergency_read_only"),
);
expect(
  "listing freeze trigger must exist",
  migrations.includes("rawaj_listings_system_control_guard"),
);
expect(
  "message freeze trigger must exist",
  migrations.includes("rawaj_messages_system_control_guard"),
);
expect(
  "promotion freeze trigger must exist",
  migrations.includes("rawaj_promotions_system_control_guard"),
);
expect(
  "verification freeze trigger must exist",
  migrations.includes("rawaj_verifications_system_control_guard"),
);

expect(
  "safety cases must use RLS",
  migrations.includes("alter table public.safety_cases enable row level security"),
);
expect("safety cases must reject stale writes", migrations.includes("stale_safety_case"));
expect(
  "closing safety cases must require resolution note",
  migrations.includes("A resolution note is required to close a safety case."),
);
expect("safety escalation must be audited", migrations.includes("safety_case.escalated_to_owner"));
expect("safety notes must be audited", migrations.includes("safety_case.note_added"));
expect("safety links must be audited", migrations.includes("safety_case.link_added"));

expect(
  "ad placements must use RLS",
  migrations.includes("alter table public.ad_placements enable row level security"),
);
expect("ad placements must reject stale writes", migrations.includes("stale_ad_placement"));
expect(
  "ad placement mutations must be audited",
  migrations.includes("ad_placement.status_changed"),
);
expect(
  "campaigns must use RLS",
  migrations.includes("alter table public.ad_campaigns enable row level security"),
);
expect("campaigns must reject stale writes", migrations.includes("stale_campaign"));
expect(
  "campaign lifecycle changes must be audited",
  migrations.includes("campaign.status_changed"),
);
expect("campaign metrics must come from event rows", migrations.includes("ad_campaign_events"));

expect(
  "listing moderation must reject stale actions",
  migrations.includes("stale_listing_version"),
);
expect(
  "listing moderation must require decision reasons",
  /reason[^\n]{0,120}required|required[^\n]{0,120}reason/i.test(migrations),
);
expect("listing moderation must write audit events", migrations.includes("rawaj_insert_audit_log"));
expect(
  "owner targets must have a reusable database guard",
  migrations.includes("rawaj_assert_not_owner_target"),
);
expect("owner-target guard must raise owner_protected", migrations.includes("owner_protected"));

const primaryTargets = ["/", "/categories", "/add-listing", "/offers", "/more"];
for (const target of primaryTargets) {
  expect(`primary navigation must preserve ${target}`, bottomNav.includes(`to: "${target}"`));
}
expect(
  "public BottomNav must remain exactly five items",
  (bottomNav.match(/\bto:\s*"/g) ?? []).length === 5,
);
expect(
  "admin routes must stay hidden from public BottomNav",
  primaryNavigation.includes('"/admin"'),
);

if (failures.length > 0) {
  console.error("Admin security regression failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Admin security regression passed (${assertionCount} invariants).`);
