import { readFile, rm, writeFile } from "node:fs/promises";

const routePath = "src/routes/profile/listings.tsx";
const packagePath = "package.json";
const testPath = "scripts/listing-lifecycle-completeness-v1.test.mjs";

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Expected one ${label}, found multiple.`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) {
    throw new Error(`Expected one ${label}, found ${matches.length}.`);
  }
  return source.replace(pattern, replacement);
}

let route = await readFile(routePath, "utf8");

route = replaceOnce(
  route,
  'import { BadgePercent, BookmarkCheck, Eye, Pencil, Plus, Star, Trash2 } from "lucide-react";',
  'import {\n  BadgePercent,\n  BookmarkCheck,\n  CircleCheckBig,\n  Eye,\n  Pencil,\n  Plus,\n  Star,\n  Trash2,\n} from "lucide-react";',
  "listing card icon import",
);

route = replaceOnce(
  route,
  "  closeOwnerListing,\n  deleteOwnerListing,",
  "  closeOwnerListing,\n  confirmOwnerListingAvailability,\n  deleteOwnerListing,",
  "lifecycle API imports",
);

route = replaceOnce(
  route,
  'type StoreTab = "approved" | "pending" | "needs_edit" | "closed" | "reviews";\n',
  `type StoreTab = "approved" | "pending" | "needs_edit" | "closed" | "reviews";\n\ntype LifecycleConfirmation =\n  | { action: "close"; targetStatus: OwnerCloseListingStatus }\n  | { action: "reactivate" };\n\ninterface LifecycleConfirmationCopy {\n  title: string;\n  description: string;\n  confirmLabel: string;\n}\n`,
  "lifecycle confirmation types",
);

route = replaceOnce(
  route,
  "  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);\n",
  `  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);\n  const [pendingLifecycleConfirmation, setPendingLifecycleConfirmation] =\n    useState<LifecycleConfirmation | null>(null);\n`,
  "lifecycle confirmation state",
);

route = replaceRegexOnce(
  route,
  /(async function handleClose\([\s\S]*?\n      onChanged\(userId, result\.data\);)/,
  "$1\n      setPendingLifecycleConfirmation(null);",
  "close lifecycle success handler",
);

route = replaceOnce(
  route,
  "  async function handlePriceDrop() {",
  `  async function handleAvailabilityConfirm() {\n    if (lifecycleInFlightRef.current || listing.status !== "approved") return;\n    lifecycleInFlightRef.current = true;\n    setLifecycleError("");\n    setLifecycleBusy(true);\n    try {\n      const result = await confirmOwnerListingAvailability(userId, listing.id);\n      if (!result.ok) {\n        setLifecycleError(result.error.message);\n        return;\n      }\n      onChanged(userId, result.data);\n    } catch (caught) {\n      setLifecycleError(\n        caught instanceof Error\n          ? caught.message\n          : text(\n              "تعذر تأكيد توفر الإعلان.",\n              "Could not confirm listing availability.",\n            ),\n      );\n    } finally {\n      lifecycleInFlightRef.current = false;\n      setLifecycleBusy(false);\n    }\n  }\n\n  async function handlePriceDrop() {`,
  "availability confirmation handler",
);

route = replaceRegexOnce(
  route,
  /(async function handleReactivate\([\s\S]*?\n      onChanged\(userId, result\.data\);)/,
  "$1\n      setPendingLifecycleConfirmation(null);",
  "reactivation success handler",
);

route = replaceOnce(
  route,
  `          {listing.rejectionReason && (\n            <p className="rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">\n              {listing.rejectionReason}\n            </p>\n          )}`,
  `          {listing.status === "rejected" && (\n            <div className="rounded-xl border border-destructive/20 bg-destructive/8 p-3">\n              <p className="text-[11px] font-bold text-destructive">\n                {text("سبب رفض الإعلان", "Listing rejection reason")}\n              </p>\n              <p className="mt-1 text-[11px] leading-5 text-destructive">\n                {listing.rejectionReason ||\n                  text(\n                    "لم تضف الإدارة ملاحظة تفصيلية. راجع بيانات الإعلان والصور ثم أعد إرساله.",\n                    "No detailed admin note was provided. Review the listing data and photos, then resubmit it.",\n                  )}\n              </p>\n              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">\n                {text(\n                  "عدّل الملاحظات المطلوبة واحفظ التغييرات، ثم استخدم زر إعادة الإرسال للمراجعة.",\n                  "Address the requested changes, save them, then use the resubmit-for-review action.",\n                )}\n              </p>\n            </div>\n          )}`,
  "rejection reason guidance",
);

route = replaceOnce(
  route,
  `            {canClose && (\n              <>\n                <select`,
  `            {canClose && (\n              <>\n                <button\n                  type="button"\n                  disabled={lifecycleBusy}\n                  onClick={() => void handleAvailabilityConfirm()}\n                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-trust/10 px-3 py-2 text-[10px] font-bold text-emerald-trust disabled:opacity-60"\n                >\n                  <CircleCheckBig className="h-3.5 w-3.5" />\n                  {lifecycleBusy\n                    ? text("جارٍ التحديث", "Updating")\n                    : text("تأكيد أنه متوفر", "Confirm availability")}\n                </button>\n                <select`,
  "approved listing availability action",
);

for (const targetStatus of ["sold", "rented", "unavailable"]) {
  route = replaceOnce(
    route,
    `onClick={() => void handleClose("${targetStatus}")}`,
    `onClick={() =>\n                    setPendingLifecycleConfirmation({ action: "close", targetStatus: "${targetStatus}" })\n                  }`,
    `${targetStatus} confirmation trigger`,
  );
}

route = replaceOnce(
  route,
  "onClick={() => void handleReactivate()}",
  'onClick={() => setPendingLifecycleConfirmation({ action: "reactivate" })}',
  "reactivation confirmation trigger",
);

route = replaceRegexOnce(
  route,
  /(  const lockedMessage = isClosedListingStatus\(listing\.status\)[\s\S]*?\n        \);)\n\n  return \(/,
  `$1\n\n  const lifecycleConfirmationCopy = pendingLifecycleConfirmation\n    ? ownerLifecycleConfirmationCopy(pendingLifecycleConfirmation, text)\n    : null;\n\n  return (`,
  "lifecycle confirmation copy binding",
);

route = replaceOnce(
  route,
  "      {showDeleteConfirm && (",
  `      {pendingLifecycleConfirmation && lifecycleConfirmationCopy && (\n        <div\n          role="dialog"\n          aria-modal="true"\n          aria-labelledby={\`${"${listing.id}"}-lifecycle-dialog-title\`}\n          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/45 p-4 backdrop-blur-sm"\n        >\n          <div className="rawaj-color-card rawaj-world-orange w-full max-w-sm rounded-[1.5rem] p-6">\n            <h3\n              id={\`${"${listing.id}"}-lifecycle-dialog-title\`}\n              className="text-base font-extrabold text-foreground"\n            >\n              {lifecycleConfirmationCopy.title}\n            </h3>\n            <p className="mt-2 text-sm leading-6 text-muted-foreground">\n              {lifecycleConfirmationCopy.description}\n            </p>\n            {lifecycleError && (\n              <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">\n                {lifecycleError}\n              </p>\n            )}\n            <div className="mt-5 flex gap-3">\n              <button\n                type="button"\n                disabled={lifecycleBusy}\n                onClick={() => {\n                  if (pendingLifecycleConfirmation.action === "reactivate") {\n                    void handleReactivate();\n                  } else {\n                    void handleClose(pendingLifecycleConfirmation.targetStatus);\n                  }\n                }}\n                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"\n              >\n                {lifecycleBusy\n                  ? text("جارٍ التنفيذ…", "Working…")\n                  : lifecycleConfirmationCopy.confirmLabel}\n              </button>\n              <button\n                type="button"\n                disabled={lifecycleBusy}\n                onClick={() => {\n                  setPendingLifecycleConfirmation(null);\n                  setLifecycleError("");\n                }}\n                className="flex-1 rounded-xl bg-muted-surface px-4 py-2.5 text-xs font-bold hairline disabled:opacity-60"\n              >\n                {text("إلغاء", "Cancel")}\n              </button>\n            </div>\n          </div>\n        </div>\n      )}\n\n      {showDeleteConfirm && (`,
  "lifecycle confirmation dialog",
);

route = replaceOnce(
  route,
  "function ReviewsSection({ sellerProfile }: { sellerProfile: PublicSellerProfile | null }) {",
  `function ownerLifecycleConfirmationCopy(\n  confirmation: LifecycleConfirmation,\n  text: (ar: string, en: string) => string,\n): LifecycleConfirmationCopy {\n  if (confirmation.action === "reactivate") {\n    return {\n      title: text("إعادة تفعيل الإعلان؟", "Reactivate this listing?"),\n      description: text(\n        "سيعود الإعلان إلى حالة قيد المراجعة، ولن يظهر للزوار قبل موافقة الإدارة من جديد.",\n        "The listing will return to pending review and will not be public until an admin approves it again.",\n      ),\n      confirmLabel: text("إعادة الإرسال للمراجعة", "Send for review"),\n    };\n  }\n\n  switch (confirmation.targetStatus) {\n    case "sold":\n      return {\n        title: text("تأكيد إغلاق الإعلان كمباع؟", "Mark this listing as sold?"),\n        description: text(\n          "سيختفي الإعلان من النتائج العامة ويُنقل إلى الإعلانات المغلقة. يمكنك إعادة تفعيله لاحقاً وإرساله للمراجعة من جديد.",\n          "The listing will leave public results and move to closed listings. You can reactivate and resubmit it later.",\n        ),\n        confirmLabel: text("نعم، تم البيع", "Yes, mark sold"),\n      };\n    case "rented":\n      return {\n        title: text("تأكيد إغلاق الإعلان كمؤجّر؟", "Mark this listing as rented?"),\n        description: text(\n          "سيختفي الإعلان من النتائج العامة ويُنقل إلى الإعلانات المغلقة. يمكنك إعادة تفعيله لاحقاً وإرساله للمراجعة من جديد.",\n          "The listing will leave public results and move to closed listings. You can reactivate and resubmit it later.",\n        ),\n        confirmLabel: text("نعم، تم التأجير", "Yes, mark rented"),\n      };\n    case "unavailable":\n      return {\n        title: text("تأكيد أن الإعلان لم يعد متاحاً؟", "Mark this listing unavailable?"),\n        description: text(\n          "سيختفي الإعلان من النتائج العامة دون حذفه، ويمكنك إعادة تفعيله لاحقاً بعد مراجعته من الإدارة.",\n          "The listing will be hidden from public results without being deleted, and can be reactivated later after review.",\n        ),\n        confirmLabel: text("تأكيد عدم التوفر", "Confirm unavailable"),\n      };\n  }\n}\n\nfunction ReviewsSection({ sellerProfile }: { sellerProfile: PublicSellerProfile | null }) {`,
  "lifecycle confirmation copy helper",
);

await writeFile(routePath, route, "utf8");

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.scripts["test:listing-lifecycle-completeness"] =
  "node --test scripts/listing-lifecycle-completeness-v1.test.mjs";
if (!packageJson.scripts.precheck.includes("test:listing-lifecycle-completeness")) {
  packageJson.scripts.precheck = packageJson.scripts.precheck.replace(
    "npm run test:listing-studio-v4 &&",
    "npm run test:listing-studio-v4 && npm run test:listing-lifecycle-completeness &&",
  );
}
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

await writeFile(
  testPath,
  `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst [ownerListings, lifecycleApi, worker, packageJson] = await Promise.all([\n  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/api/listing-lifecycle.ts", import.meta.url), "utf8"),\n  readFile(new URL("../cloudflare/worker/src/listing-operations.ts", import.meta.url), "utf8"),\n  readFile(new URL("../package.json", import.meta.url), "utf8"),\n]);\n\ntest("approved owners can explicitly confirm listing availability", () => {\n  assert.match(ownerListings, /confirmOwnerListingAvailability/);\n  assert.match(ownerListings, /async function handleAvailabilityConfirm\\(\\)/);\n  assert.match(ownerListings, /تأكيد أنه متوفر|Confirm availability/);\n  assert.match(lifecycleApi, /export function confirmOwnerListingAvailability/);\n  assert.match(worker, /action === "confirm_availability"/);\n});\n\ntest("closing and reactivation require an explicit confirmation dialog", () => {\n  assert.match(ownerListings, /type LifecycleConfirmation =/);\n  assert.match(ownerListings, /pendingLifecycleConfirmation/);\n  assert.match(ownerListings, /role="dialog"/);\n  assert.match(ownerListings, /aria-modal="true"/);\n  assert.match(ownerListings, /ownerLifecycleConfirmationCopy/);\n  assert.match(ownerListings, /action: "close", targetStatus: "sold"/);\n  assert.match(ownerListings, /action: "close", targetStatus: "rented"/);\n  assert.match(ownerListings, /action: "close", targetStatus: "unavailable"/);\n  assert.match(ownerListings, /action: "reactivate"/);\n  assert.doesNotMatch(\n    ownerListings,\n    /onClick=\\{\\(\\) => void handleClose\\("(?:sold|rented|unavailable)"\\)\\}/,\n  );\n  assert.doesNotMatch(ownerListings, /onClick=\\{\\(\\) => void handleReactivate\\(\\)\\}/);\n});\n\ntest("rejected listings explain the reason and the next corrective step", () => {\n  assert.match(ownerListings, /listing.status === "rejected"/);\n  assert.match(ownerListings, /سبب رفض الإعلان|Listing rejection reason/);\n  assert.match(ownerListings, /إعادة الإرسال للمراجعة|resubmit-for-review/);\n});\n\ntest("lifecycle actions remain single-flight and backend transitions stay constrained", () => {\n  assert.match(ownerListings, /const lifecycleInFlightRef = useRef\\(false\\)/);\n  assert.match(ownerListings, /if \\(lifecycleInFlightRef.current/);\n  assert.match(worker, /Only approved listings may be closed/);\n  assert.match(worker, /Listing cannot be reactivated from its current state/);\n  assert.match(worker, /Available approved listing required/);\n});\n\ntest("the lifecycle completeness contract runs in precheck", () => {\n  const parsed = JSON.parse(packageJson);\n  assert.equal(\n    parsed.scripts["test:listing-lifecycle-completeness"],\n    "node --test scripts/listing-lifecycle-completeness-v1.test.mjs",\n  );\n  assert.match(parsed.scripts.precheck, /test:listing-lifecycle-completeness/);\n});\n`,
  "utf8",
);

await rm("scripts/apply-listing-lifecycle-completeness-v1.mjs", { force: true });
await rm(".github/workflows/apply-listing-lifecycle-completeness-v1.yml", { force: true });
