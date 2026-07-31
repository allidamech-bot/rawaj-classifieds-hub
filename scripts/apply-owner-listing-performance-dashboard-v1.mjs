import { readFile, rm, writeFile } from "node:fs/promises";

const typesPath = "src/lib/classifieds-types.ts";
const listingsApiPath = "src/lib/api/listings.ts";
const workerPath = "cloudflare/worker/src/marketplace-private.ts";
const routePath = "src/routes/profile/listings.tsx";
const fixturePath = "e2e/rawaj-e2e-owner-listing-lifecycle-fixture.ts";
const journeyPath = "e2e/authenticated-owner-listing-lifecycle-journey.spec.ts";
const packagePath = "package.json";
const applyPath = "scripts/apply-owner-listing-performance-dashboard-v1.mjs";
const workflowPath = ".github/workflows/apply-owner-listing-performance-dashboard-v1.yml";
const componentsFragmentPath = "scripts/owner-performance-components-v1.fragment.tsx";
const expiryFragmentPath = "scripts/owner-expiry-insight-v1.fragment.tsx";

const lines = (...items) => items.join("\n");

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Expected one ${label}, found multiple.`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

const [componentsFragment, expiryFragment] = await Promise.all([
  readFile(componentsFragmentPath, "utf8"),
  readFile(expiryFragmentPath, "utf8"),
]);

let types = await readFile(typesPath, "utf8");
types = replaceOnce(
  types,
  lines("  expiryDays?: 30 | 60 | 90 | null;", "  createdAt: string;"),
  lines(
    "  expiryDays?: 30 | 60 | 90 | null;",
    "  recordedViewCount?: number;",
    "  favoriteCount?: number;",
    "  conversationCount?: number;",
    "  unreadMessageCount?: number;",
    "  lastInquiryAt?: string | null;",
    "  createdAt: string;",
  ),
  "owner listing performance fields",
);
await writeFile(typesPath, types, "utf8");

let listingsApi = await readFile(listingsApiPath, "utf8");
listingsApi = replaceOnce(
  listingsApi,
  lines(
    "    expiryDays: expiryDays === 30 || expiryDays === 60 || expiryDays === 90 ? expiryDays : null,",
    "    createdAt: text(row.createdAt ?? row.created_at),",
  ),
  lines(
    "    expiryDays: expiryDays === 30 || expiryDays === 60 || expiryDays === 90 ? expiryDays : null,",
    "    recordedViewCount: optionalMetric(",
    "      row.recordedViewCount ?? row.recorded_view_count ?? row.owner_recorded_view_count,",
    "    ),",
    "    favoriteCount: optionalMetric(",
    "      row.favoriteCount ?? row.favorite_count ?? row.owner_favorite_count,",
    "    ),",
    "    conversationCount: optionalMetric(",
    "      row.conversationCount ?? row.conversation_count ?? row.owner_conversation_count,",
    "    ),",
    "    unreadMessageCount: optionalMetric(",
    "      row.unreadMessageCount ??",
    "        row.unread_message_count ??",
    "        row.owner_unread_message_count,",
    "    ),",
    "    lastInquiryAt: nullableText(",
    "      row.lastInquiryAt ?? row.last_inquiry_at ?? row.owner_last_inquiry_at,",
    "    ),",
    "    createdAt: text(row.createdAt ?? row.created_at),",
  ),
  "listing performance mapper",
);
listingsApi = replaceOnce(
  listingsApi,
  lines(
    "function numberValue(value: unknown, fallback = 0): number {",
    "  return numberOrNull(value) ?? fallback;",
    "}",
  ),
  lines(
    "function numberValue(value: unknown, fallback = 0): number {",
    "  return numberOrNull(value) ?? fallback;",
    "}",
    "",
    "function optionalMetric(value: unknown): number | undefined {",
    "  if (value === undefined) return undefined;",
    "  return Math.max(0, Math.trunc(numberValue(value)));",
    "}",
  ),
  "optional performance metric helper",
);
await writeFile(listingsApiPath, listingsApi, "utf8");

let worker = await readFile(workerPath, "utf8");
worker = replaceOnce(
  worker,
  lines(
    "    `SELECT id, owner_id, category_id, subcategory_id, governorate_id, location_node_id,",
    "      title, description, price, currency, price_type, listing_condition, status,",
    "      district_ar, contact_name, contact_options, details, is_featured, featured_until,",
    "      published_at, archived_at, reserved_at, expires_at, renewed_at, expiry_days,",
    "      created_at, updated_at,",
    "      (SELECT li.media_asset_id FROM listing_images li WHERE li.listing_id = listings.id",
    "        ORDER BY li.sort_order, li.id LIMIT 1) AS primary_media_asset_id",
    "      FROM listings WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 200`,",
    "  )",
    "    .bind(auth.userId)",
  ),
  lines(
    "    `SELECT l.id, l.owner_id, l.category_id, l.subcategory_id, l.governorate_id,",
    "      l.location_node_id, l.title, l.description, l.price, l.currency, l.price_type,",
    "      l.listing_condition, l.status, l.district_ar, l.contact_name, l.contact_options,",
    "      l.details, l.is_featured, l.featured_until, l.published_at, l.archived_at,",
    "      l.reserved_at, l.expires_at, l.renewed_at, l.expiry_days, l.created_at, l.updated_at,",
    "      COALESCE(rv.recorded_view_count, 0) AS owner_recorded_view_count,",
    "      COALESCE(fv.favorite_count, 0) AS owner_favorite_count,",
    "      COALESCE(cv.conversation_count, 0) AS owner_conversation_count,",
    "      COALESCE(um.unread_message_count, 0) AS owner_unread_message_count,",
    "      cv.last_inquiry_at AS owner_last_inquiry_at,",
    "      (SELECT li.media_asset_id FROM listing_images li WHERE li.listing_id = l.id",
    "        ORDER BY li.sort_order, li.id LIMIT 1) AS primary_media_asset_id",
    "      FROM listings l",
    "      LEFT JOIN (",
    "        SELECT listing_id, SUM(view_count) AS recorded_view_count",
    "          FROM recent_listing_views WHERE user_id <> ? GROUP BY listing_id",
    "      ) rv ON rv.listing_id = l.id",
    "      LEFT JOIN (",
    "        SELECT listing_id, COUNT(*) AS favorite_count",
    "          FROM favorites WHERE user_id <> ? GROUP BY listing_id",
    "      ) fv ON fv.listing_id = l.id",
    "      LEFT JOIN (",
    "        SELECT listing_id, COUNT(*) AS conversation_count,",
    "          MAX(COALESCE(last_message_at, updated_at)) AS last_inquiry_at",
    "          FROM conversations WHERE seller_id = ? AND listing_id IS NOT NULL",
    "          GROUP BY listing_id",
    "      ) cv ON cv.listing_id = l.id",
    "      LEFT JOIN (",
    "        SELECT c.listing_id, COUNT(*) AS unread_message_count",
    "          FROM conversations c",
    "          JOIN conversation_messages cm ON cm.conversation_id = c.id",
    "          WHERE c.seller_id = ? AND cm.sender_id <> ?",
    "            AND cm.read_at IS NULL AND cm.deleted_at IS NULL",
    "          GROUP BY c.listing_id",
    "      ) um ON um.listing_id = l.id",
    "      WHERE l.owner_id = ? ORDER BY l.updated_at DESC LIMIT 200`,",
    "  )",
    "    .bind(",
    "      auth.userId,",
    "      auth.userId,",
    "      auth.userId,",
    "      auth.userId,",
    "      auth.userId,",
    "      auth.userId,",
    "    )",
  ),
  "owner listings performance query",
);
worker = replaceOnce(
  worker,
  lines(
    "    expiryDays: nullableNumber(row.expiry_days),",
    "    primaryImageUrl: nullableString(row.primary_media_asset_id)",
  ),
  lines(
    "    expiryDays: nullableNumber(row.expiry_days),",
    "    recordedViewCount: optionalMetric(row.owner_recorded_view_count),",
    "    favoriteCount: optionalMetric(row.owner_favorite_count),",
    "    conversationCount: optionalMetric(row.owner_conversation_count),",
    "    unreadMessageCount: optionalMetric(row.owner_unread_message_count),",
    "    lastInquiryAt:",
    "      row.owner_last_inquiry_at === undefined",
    "        ? undefined",
    "        : nullableString(row.owner_last_inquiry_at),",
    "    primaryImageUrl: nullableString(row.primary_media_asset_id)",
  ),
  "worker listing performance mapper",
);
worker = replaceOnce(
  worker,
  lines(
    "function numberValue(value: unknown, fallback = 0): number {",
    '  const number = typeof value === "number" ? value : Number(value);',
    "  return Number.isFinite(number) ? number : fallback;",
    "}",
  ),
  lines(
    "function numberValue(value: unknown, fallback = 0): number {",
    '  const number = typeof value === "number" ? value : Number(value);',
    "  return Number.isFinite(number) ? number : fallback;",
    "}",
    "",
    "function optionalMetric(value: unknown): number | undefined {",
    "  if (value === undefined) return undefined;",
    "  return Math.max(0, Math.trunc(numberValue(value)));",
    "}",
  ),
  "worker optional metric helper",
);
await writeFile(workerPath, worker, "utf8");

let route = await readFile(routePath, "utf8");
route = replaceOnce(
  route,
  lines(
    "import {",
    "  BadgePercent,",
    "  BookmarkCheck,",
    "  CircleCheckBig,",
    "  Eye,",
    "  Pencil,",
    "  Plus,",
    "  Star,",
    "  Trash2,",
    '} from "lucide-react";',
  ),
  lines(
    "import {",
    "  AlertTriangle,",
    "  BadgePercent,",
    "  BellRing,",
    "  BookmarkCheck,",
    "  CircleCheckBig,",
    "  Clock3,",
    "  Eye,",
    "  Heart,",
    "  MessageCircle,",
    "  Pencil,",
    "  Plus,",
    "  Star,",
    "  Trash2,",
    "  TrendingUp,",
    '} from "lucide-react";',
  ),
  "owner performance icon imports",
);
route = replaceOnce(
  route,
  lines(
    "  const latestDraft = useMemo(",
    "    () =>",
    "      listings",
    '        .filter((listing) => listing.status === "draft")',
    "        .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0] ?? null,",
    "    [listings],",
    "  );",
  ),
  lines(
    "  const latestDraft = useMemo(",
    "    () =>",
    "      listings",
    '        .filter((listing) => listing.status === "draft")',
    "        .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0] ?? null,",
    "    [listings],",
    "  );",
    "  const performanceSummary = useMemo(",
    "    () => summarizeOwnerListingPerformance(listings),",
    "    [listings],",
    "  );",
  ),
  "owner performance summary memo",
);
route = replaceOnce(
  route,
  '        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">',
  lines(
    "        <OwnerPerformanceOverview summary={performanceSummary} />",
    "",
    '        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">',
  ),
  "owner performance overview placement",
);
route = replaceOnce(
  route,
  "function TabButton({",
  `${componentsFragment.trimEnd()}\nfunction TabButton({`,
  "owner performance components",
);
route = replaceOnce(
  route,
  lines(
    "  const lifecycleConfirmationCopy = pendingLifecycleConfirmation",
    "    ? ownerLifecycleConfirmationCopy(pendingLifecycleConfirmation, text)",
    "    : null;",
  ),
  lines(
    "  const lifecycleConfirmationCopy = pendingLifecycleConfirmation",
    "    ? ownerLifecycleConfirmationCopy(pendingLifecycleConfirmation, text)",
    "    : null;",
    "  const expiryInsight = ownerListingExpiryInsight(listing, text);",
  ),
  "owner expiry insight binding",
);
route = replaceOnce(
  route,
  lines(
    "          {listing.expiresAt && (",
    "            <p",
    "              className={`rounded-lg p-2 text-[11px] font-semibold ${",
    '                listing.status === "expired"',
    '                  ? "bg-destructive/10 text-destructive"',
    '                  : "bg-warning/10 text-foreground"',
    "              }`}",
    "            >",
    '              {listing.status === "expired"',
    '                ? text("انتهى الإعلان", "Listing expired")',
    '                : text("موعد انتهاء الإعلان", "Listing expiry")}',
    "              : {formatSavedAt(listing.expiresAt, language)}",
    "            </p>",
    "          )}",
  ),
  expiryFragment.trim(),
  "owner expiry insight panel",
);
route = replaceOnce(
  route,
  lines("          </p>", '          {listing.status === "rejected" && ('),
  lines(
    "          </p>",
    "          <OwnerListingPerformance listing={listing} language={language} />",
    '          {listing.status === "rejected" && (',
  ),
  "per-listing performance panel",
);
await writeFile(routePath, route, "utf8");

let fixture = await readFile(fixturePath, "utf8");
fixture = replaceOnce(
  fixture,
  lines("  statusChangedAt: string | null;", "  updatedAt: string;"),
  lines(
    "  statusChangedAt: string | null;",
    "  recordedViewCount: number;",
    "  favoriteCount: number;",
    "  conversationCount: number;",
    "  unreadMessageCount: number;",
    "  lastInquiryAt: string | null;",
    "  updatedAt: string;",
  ),
  "fixture performance fields",
);
fixture = replaceOnce(
  fixture,
  lines(
    "function approvedListing(): FixtureListing {",
    "  return baseListing({",
    "    id: APPROVED_LISTING_ID,",
    '    title: "سيارة عائلية معتمدة",',
    '    description: "إعلان معتمد مخصص لاختبار إدارة دورة حياة الإعلان.",',
    '    status: "approved",',
    "    price: 450_000_000,",
    '    priceType: "fixed",',
    "    expiryDays: 60,",
    '    expiresAt: "2026-09-28T12:00:00.000Z",',
    "    renewedAt: null,",
    "  });",
    "}",
  ),
  lines(
    "function approvedListing(): FixtureListing {",
    "  return {",
    "    ...baseListing({",
    "      id: APPROVED_LISTING_ID,",
    '      title: "سيارة عائلية معتمدة",',
    '      description: "إعلان معتمد مخصص لاختبار إدارة دورة حياة الإعلان.",',
    '      status: "approved",',
    "      price: 450_000_000,",
    '      priceType: "fixed",',
    "      expiryDays: 60,",
    '      expiresAt: "2026-09-28T12:00:00.000Z",',
    "      renewedAt: null,",
    "    }),",
    "    recordedViewCount: 24,",
    "    favoriteCount: 5,",
    "    conversationCount: 3,",
    "    unreadMessageCount: 2,",
    '    lastInquiryAt: "2026-07-30T16:45:00.000Z",',
    "  };",
    "}",
  ),
  "approved listing performance fixture",
);
fixture = replaceOnce(
  fixture,
  lines("    expiryDays: values.expiryDays,", "    createdAt: BASE_TIMESTAMP,"),
  lines(
    "    expiryDays: values.expiryDays,",
    "    recordedViewCount: 0,",
    "    favoriteCount: 0,",
    "    conversationCount: 0,",
    "    unreadMessageCount: 0,",
    "    lastInquiryAt: null,",
    "    createdAt: BASE_TIMESTAMP,",
  ),
  "fixture performance defaults",
);
await writeFile(fixturePath, fixture, "utf8");

let journey = await readFile(journeyPath, "utf8");
journey = replaceOnce(
  journey,
  lines(
    "    let approvedCard = ownerCard(page, APPROVED_TITLE);",
    "    await expect(approvedCard).toBeVisible({ timeout: 30_000 });",
  ),
  lines(
    "    let approvedCard = ownerCard(page, APPROVED_TITLE);",
    "    await expect(approvedCard).toBeVisible({ timeout: 30_000 });",
    "",
    '    const performanceOverview = page.locator(\'[data-owner-performance-overview="true"]\');',
    "    await expect(performanceOverview).toBeVisible();",
    "    await expect(performanceOverview.locator('[data-owner-summary-metric=\"views\"]')).toContainText(",
    '      "24",',
    "    );",
    "    await expect(",
    "      performanceOverview.locator('[data-owner-summary-metric=\"favorites\"]'),",
    '    ).toContainText("5");',
    "    await expect(",
    "      performanceOverview.locator('[data-owner-summary-metric=\"conversations\"]'),",
    '    ).toContainText("3");',
    "    await expect(performanceOverview.locator('[data-owner-summary-metric=\"unread\"]')).toContainText(",
    '      "2",',
    "    );",
    "",
    "    const listingPerformance = approvedCard.locator(",
    '      \'[data-owner-listing-performance="true"]\',',
    "    );",
    '    await expect(listingPerformance.locator(\'[data-owner-metric="views"]\')).toContainText("24");',
    '    await expect(listingPerformance.locator(\'[data-owner-metric="favorites"]\')).toContainText("5");',
    "    await expect(listingPerformance.locator('[data-owner-metric=\"conversations\"]')).toContainText(",
    '      "3",',
    "    );",
    '    await expect(listingPerformance.locator(\'[data-owner-metric="unread"]\')).toContainText("2");',
  ),
  "owner performance browser assertions",
);
await writeFile(journeyPath, journey, "utf8");

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.scripts["test:owner-listing-performance"] =
  "node --test scripts/owner-listing-performance-dashboard-v1.test.mjs";
if (!packageJson.scripts.precheck.includes("test:owner-listing-performance")) {
  packageJson.scripts.precheck = packageJson.scripts.precheck.replace(
    "npm run test:listing-lifecycle-completeness &&",
    "npm run test:listing-lifecycle-completeness && npm run test:owner-listing-performance &&",
  );
}
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

await Promise.all([
  rm(applyPath),
  rm(workflowPath),
  rm(componentsFragmentPath),
  rm(expiryFragmentPath),
]);
