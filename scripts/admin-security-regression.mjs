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
const adminOverview = read("src/routes/admin.index.tsx");
const adminUsers = read("src/routes/admin.users.tsx");
const adminPending = read("src/routes/admin.pending.tsx");
const adminReports = read("src/routes/admin.reports.tsx");
const adminReviews = read("src/routes/admin.reviews.tsx");
const adminMessageReports = read("src/routes/admin.message-reports.tsx");
const bottomDock = read("src/components/shell/BottomDock.tsx");
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

// These invariants keep the six admin recovery stages permanent in the security gate.
expect(
  "admin overview preserves successful metrics and exposes retry",
  adminOverview.includes("const [hasLoaded, setHasLoaded]") &&
    adminOverview.includes("const requestIdRef = useRef(0)") &&
    adminOverview.includes("const loadMetrics = useCallback") &&
    adminOverview.includes("error && !hasLoaded") &&
    adminOverview.includes("onAction={() => void loadMetrics()}") &&
    !/setError\(result\.error\.message\);[\s\S]{0,160}setMetrics\(EMPTY_METRICS\)/.test(
      adminOverview,
    ),
);
expect(
  "pending listing queue preserves successful data and deduplicates decisions",
  adminPending.includes("const [hasLoaded, setHasLoaded]") &&
    adminPending.includes("const loadRequestIdRef = useRef(0)") &&
    adminPending.includes("const actionInFlightRef = useRef<Set<string>>(new Set())") &&
    adminPending.includes("actionInFlightRef.current.has(actionKey)") &&
    adminPending.includes("imagesError") &&
    adminPending.includes("onRetryImages") &&
    !/setError\(result\.error\);[\s\S]{0,120}setListings\(\[\]\)/.test(adminPending),
);
expect(
  "listing report queue separates load and action failures",
  adminReports.includes("const [hasLoaded, setHasLoaded]") &&
    adminReports.includes("const [loadError, setLoadError]") &&
    adminReports.includes("const [actionMessage, setActionMessage]") &&
    adminReports.includes("const actionInFlightRef = useRef<Set<string>>(new Set())") &&
    adminReports.includes("loadError && !hasLoaded") &&
    !/setLoadError\(result\.error\);[\s\S]{0,120}setReports\(\[\]\)/.test(adminReports),
);
expect(
  "seller review queue preserves data and deduplicates moderation",
  adminReviews.includes("const [hasLoaded, setHasLoaded]") &&
    adminReviews.includes("const [loadError, setLoadError]") &&
    adminReviews.includes("const actionInFlightRef = useRef<Set<string>>(new Set())") &&
    adminReviews.includes("actionInFlightRef.current.has(review.id)") &&
    adminReviews.includes("loadError && !hasLoaded") &&
    !/setLoadError\(result\.error\);[\s\S]{0,120}setReviews\(\[\]\)/.test(adminReviews),
);
expect(
  "message report queue preserves data and deduplicates moderation",
  adminMessageReports.includes("const [hasLoaded, setHasLoaded]") &&
    adminMessageReports.includes("const [loadError, setLoadError]") &&
    adminMessageReports.includes("const actionInFlightRef = useRef<Set<string>>(new Set())") &&
    adminMessageReports.includes("actionInFlightRef.current.has(report.id)") &&
    adminMessageReports.includes("loadError && !hasLoaded") &&
    !/setLoadError\(result\.error\);[\s\S]{0,120}setReports\(\[\]\)/.test(
      adminMessageReports,
    ),
);
expect(
  "user management separates load and action errors and deduplicates sensitive writes",
  adminUsers.includes("const [hasLoaded, setHasLoaded]") &&
    adminUsers.includes("const [loadError, setLoadError]") &&
    adminUsers.includes("const [actionError, setActionError]") &&
    adminUsers.includes("const actionInFlightRef = useRef(false)") &&
    adminUsers.includes("if (actionInFlightRef.current) return") &&
    adminUsers.includes("const refreshUsers = useCallback") &&
    adminUsers.includes("loadError && !hasLoaded") &&
    adminUsers.includes("finally {") &&
    !/setLoadError\(result\.error\.message\);[\s\S]{0,120}setUsers\(\[\]\)/.test(adminUsers),
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

const primaryTargets = ["/", "/categories", "/add-listing", "/chats", "/more"];
for (const target of primaryTargets) {
  expect(`bottom navigation preserves ${target}`, bottomDock.includes(`to: "${target}"`));
}
expect("admin routes remain outside public navigation", primaryNavigation.includes('"/admin"'));

if (failures.length > 0) {
  process.stderr.write("Admin security regression failed:\n\n");
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exit(1);
}

process.stdout.write(`Admin security regression passed (${assertions} invariants).\n`);
