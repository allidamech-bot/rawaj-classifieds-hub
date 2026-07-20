import { readFile, writeFile } from "node:fs/promises";

const path = "scripts/apply-admin-actions-integrity-repair.mjs";
const source = await readFile(path, "utf8");
const startMarker = "const inventoryDoc = `";
const endMarker = "\nawait writeFile(\"docs/admin-actions-inventory.md\", inventoryDoc);";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error("Could not locate the admin inventory documentation block.");
}

const documentation = `# RAWAJ Admin Actions Inventory

This inventory covers the complete generated /admin/* route surface at the audited baseline.

## Routes (16)

1. /admin — protected layout and permission-scoped navigation
2. /admin/ — command center and retry/navigation actions
3. /admin/pending — pending listing review
4. /admin/listings — listing decisions
5. /admin/data-quality — scans, filters, pagination, and issue decisions
6. /admin/reviews — seller review and review-report moderation
7. /admin/reports — listing reports
8. /admin/message-reports — reported messages
9. /admin/safety — safety cases, evidence, escalation, and status changes
10. /admin/verifications — seller verification requests and private evidence
11. /admin/users — account status, restrictions, and staff roles
12. /admin/promotions — promotion requests and private receipts
13. /admin/ad-placements — placement CRUD, image upload, status, and delete confirmation
14. /admin/campaigns — campaign and creative management
15. /admin/audit — filters, retry, and pagination
16. /admin/owner-controls — owner-only system controls

## Integrity rules

- A record cannot receive two conflicting mutations concurrently.
- Mutation controls stay disabled until the authoritative server state is reloaded.
- Private evidence links are generated one at a time and expose loading/error state.
- Every sensitive mutation carries an expected timestamp/version when its RPC requires one.
- Route visibility and direct route access both require the persisted permission.
- Critical frontend RPC names and payload keys are checked against the migration ledger.
- Production-safe verification uses static contracts and CI; no destructive production mutation is required.

The contract test prints the exact current counts for buttons, links, forms, and filter/field controls on every run.
`;

const replacement = `const inventoryDoc = ${JSON.stringify(documentation)};`;
await writeFile(path, source.slice(0, start) + replacement + source.slice(end));
