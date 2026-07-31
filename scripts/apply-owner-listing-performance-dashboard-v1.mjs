import { readFile, rm, writeFile } from "node:fs/promises";

const typesPath = "src/lib/classifieds-types.ts";
const listingsApiPath = "src/lib/api/listings.ts";
const workerPath = "cloudflare/worker/src/marketplace-private.ts";
const routePath = "src/routes/profile/listings.tsx";
const fixturePath = "e2e/rawaj-e2e-owner-listing-lifecycle-fixture.ts";
const journeyPath = "e2e/authenticated-owner-listing-lifecycle-journey.spec.ts";
const packagePath = "package.json";
const testPath = "scripts/owner-listing-performance-dashboard-v1.test.mjs";
const applyPath = "scripts/apply-owner-listing-performance-dashboard-v1.mjs";
const workflowPath = ".github/workflows/apply-owner-listing-performance-dashboard-v1.yml";

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Expected one ${label}, found multiple.`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

let types = await readFile(typesPath, "utf8");
types = replaceOnce(
  types,
  "  expiryDays?: 30 | 60 | 90 | null;\n  createdAt: string;",
  `  expiryDays?: 30 | 60 | 90 | null;\n  recordedViewCount?: number;\n  favoriteCount?: number;\n  conversationCount?: number;\n  unreadMessageCount?: number;\n  lastInquiryAt?: string | null;\n  createdAt: string;`,
  "owner listing performance fields",
);
await writeFile(typesPath, types, "utf8");

let listingsApi = await readFile(listingsApiPath, "utf8");
listingsApi = replaceOnce(
  listingsApi,
  `    expiryDays: expiryDays === 30 || expiryDays === 60 || expiryDays === 90 ? expiryDays : null,\n    createdAt: text(row.createdAt ?? row.created_at),`,
  `    expiryDays: expiryDays === 30 || expiryDays === 60 || expiryDays === 90 ? expiryDays : null,\n    recordedViewCount: optionalMetric(\n      row.recordedViewCount ?? row.recorded_view_count ?? row.owner_recorded_view_count,\n    ),\n    favoriteCount: optionalMetric(\n      row.favoriteCount ?? row.favorite_count ?? row.owner_favorite_count,\n    ),\n    conversationCount: optionalMetric(\n      row.conversationCount ?? row.conversation_count ?? row.owner_conversation_count,\n    ),\n    unreadMessageCount: optionalMetric(\n      row.unreadMessageCount ??\n        row.unread_message_count ??\n        row.owner_unread_message_count,\n    ),\n    lastInquiryAt: nullableText(\n      row.lastInquiryAt ?? row.last_inquiry_at ?? row.owner_last_inquiry_at,\n    ),\n    createdAt: text(row.createdAt ?? row.created_at),`,
  "listing performance mapper",
);
listingsApi = replaceOnce(
  listingsApi,
  `function numberValue(value: unknown, fallback = 0): number {\n  return numberOrNull(value) ?? fallback;\n}\n`,
  `function numberValue(value: unknown, fallback = 0): number {\n  return numberOrNull(value) ?? fallback;\n}\n\nfunction optionalMetric(value: unknown): number | undefined {\n  if (value === undefined) return undefined;\n  return Math.max(0, Math.trunc(numberValue(value)));\n}\n`,
  "optional performance metric helper",
);
await writeFile(listingsApiPath, listingsApi, "utf8");

let worker = await readFile(workerPath, "utf8");
worker = replaceOnce(
  worker,
  `    \`SELECT id, owner_id, category_id, subcategory_id, governorate_id, location_node_id,\n      title, description, price, currency, price_type, listing_condition, status,\n      district_ar, contact_name, contact_options, details, is_featured, featured_until,\n      published_at, archived_at, reserved_at, expires_at, renewed_at, expiry_days,\n      created_at, updated_at,\n      (SELECT li.media_asset_id FROM listing_images li WHERE li.listing_id = listings.id\n        ORDER BY li.sort_order, li.id LIMIT 1) AS primary_media_asset_id\n      FROM listings WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 200\`,\n  )\n    .bind(auth.userId)`,
  `    \`SELECT l.id, l.owner_id, l.category_id, l.subcategory_id, l.governorate_id,\n      l.location_node_id, l.title, l.description, l.price, l.currency, l.price_type,\n      l.listing_condition, l.status, l.district_ar, l.contact_name, l.contact_options,\n      l.details, l.is_featured, l.featured_until, l.published_at, l.archived_at,\n      l.reserved_at, l.expires_at, l.renewed_at, l.expiry_days, l.created_at, l.updated_at,\n      COALESCE(rv.recorded_view_count, 0) AS owner_recorded_view_count,\n      COALESCE(fv.favorite_count, 0) AS owner_favorite_count,\n      COALESCE(cv.conversation_count, 0) AS owner_conversation_count,\n      COALESCE(um.unread_message_count, 0) AS owner_unread_message_count,\n      cv.last_inquiry_at AS owner_last_inquiry_at,\n      (SELECT li.media_asset_id FROM listing_images li WHERE li.listing_id = l.id\n        ORDER BY li.sort_order, li.id LIMIT 1) AS primary_media_asset_id\n      FROM listings l\n      LEFT JOIN (\n        SELECT listing_id, SUM(view_count) AS recorded_view_count\n          FROM recent_listing_views WHERE user_id <> ? GROUP BY listing_id\n      ) rv ON rv.listing_id = l.id\n      LEFT JOIN (\n        SELECT listing_id, COUNT(*) AS favorite_count\n          FROM favorites WHERE user_id <> ? GROUP BY listing_id\n      ) fv ON fv.listing_id = l.id\n      LEFT JOIN (\n        SELECT listing_id, COUNT(*) AS conversation_count,\n          MAX(COALESCE(last_message_at, updated_at)) AS last_inquiry_at\n          FROM conversations WHERE seller_id = ? AND listing_id IS NOT NULL\n          GROUP BY listing_id\n      ) cv ON cv.listing_id = l.id\n      LEFT JOIN (\n        SELECT c.listing_id, COUNT(*) AS unread_message_count\n          FROM conversations c\n          JOIN conversation_messages cm ON cm.conversation_id = c.id\n          WHERE c.seller_id = ? AND cm.sender_id <> ?\n            AND cm.read_at IS NULL AND cm.deleted_at IS NULL\n          GROUP BY c.listing_id\n      ) um ON um.listing_id = l.id\n      WHERE l.owner_id = ? ORDER BY l.updated_at DESC LIMIT 200\`,\n  )\n    .bind(\n      auth.userId,\n      auth.userId,\n      auth.userId,\n      auth.userId,\n      auth.userId,\n      auth.userId,\n    )`,
  "owner listings performance query",
);
worker = replaceOnce(
  worker,
  `    expiryDays: nullableNumber(row.expiry_days),\n    primaryImageUrl: nullableString(row.primary_media_asset_id)`,
  `    expiryDays: nullableNumber(row.expiry_days),\n    recordedViewCount: optionalMetric(row.owner_recorded_view_count),\n    favoriteCount: optionalMetric(row.owner_favorite_count),\n    conversationCount: optionalMetric(row.owner_conversation_count),\n    unreadMessageCount: optionalMetric(row.owner_unread_message_count),\n    lastInquiryAt:\n      row.owner_last_inquiry_at === undefined\n        ? undefined\n        : nullableString(row.owner_last_inquiry_at),\n    primaryImageUrl: nullableString(row.primary_media_asset_id)`,
  "worker listing performance mapper",
);
worker = replaceOnce(
  worker,
  `function numberValue(value: unknown, fallback = 0): number {\n  const number = typeof value === "number" ? value : Number(value);\n  return Number.isFinite(number) ? number : fallback;\n}\n`,
  `function numberValue(value: unknown, fallback = 0): number {\n  const number = typeof value === "number" ? value : Number(value);\n  return Number.isFinite(number) ? number : fallback;\n}\n\nfunction optionalMetric(value: unknown): number | undefined {\n  if (value === undefined) return undefined;\n  return Math.max(0, Math.trunc(numberValue(value)));\n}\n`,
  "worker optional metric helper",
);
await writeFile(workerPath, worker, "utf8");

let route = await readFile(routePath, "utf8");
route = replaceOnce(
  route,
  `import {\n  BadgePercent,\n  BookmarkCheck,\n  CircleCheckBig,\n  Eye,\n  Pencil,\n  Plus,\n  Star,\n  Trash2,\n} from "lucide-react";`,
  `import {\n  AlertTriangle,\n  BadgePercent,\n  BellRing,\n  BookmarkCheck,\n  CircleCheckBig,\n  Clock3,\n  Eye,\n  Heart,\n  MessageCircle,\n  Pencil,\n  Plus,\n  Star,\n  Trash2,\n  TrendingUp,\n} from "lucide-react";`,
  "owner performance icon imports",
);
route = replaceOnce(
  route,
  `  const latestDraft = useMemo(\n    () =>\n      listings\n        .filter((listing) => listing.status === "draft")\n        .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0] ?? null,\n    [listings],\n  );`,
  `  const latestDraft = useMemo(\n    () =>\n      listings\n        .filter((listing) => listing.status === "draft")\n        .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0] ?? null,\n    [listings],\n  );\n  const performanceSummary = useMemo(\n    () => summarizeOwnerListingPerformance(listings),\n    [listings],\n  );`,
  "owner performance summary memo",
);
route = replaceOnce(
  route,
  `        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">`,
  `        <OwnerPerformanceOverview summary={performanceSummary} />\n\n        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">`,
  "owner performance overview placement",
);
route = replaceOnce(
  route,
  `function TabButton({`,
  `interface OwnerPerformanceSummary {\n  trackedListings: number;\n  recordedViews: number;\n  favorites: number;\n  conversations: number;\n  unreadMessages: number;\n  expiringSoon: number;\n}\n\ninterface OwnerExpiryInsight {\n  tone: "safe" | "warning" | "danger" | "neutral";\n  title: string;\n  description: string;\n}\n\nfunction summarizeOwnerListingPerformance(\n  listings: ClassifiedListing[],\n): OwnerPerformanceSummary {\n  return listings.reduce<OwnerPerformanceSummary>(\n    (summary, listing) => {\n      if (!isPerformanceEligibleListing(listing)) return summary;\n      summary.trackedListings += 1;\n      summary.recordedViews += listing.recordedViewCount ?? 0;\n      summary.favorites += listing.favoriteCount ?? 0;\n      summary.conversations += listing.conversationCount ?? 0;\n      summary.unreadMessages += listing.unreadMessageCount ?? 0;\n      const daysRemaining =\n        listing.status === "approved" ? daysUntilExpiry(listing.expiresAt) : null;\n      if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7) {\n        summary.expiringSoon += 1;\n      }\n      return summary;\n    },\n    {\n      trackedListings: 0,\n      recordedViews: 0,\n      favorites: 0,\n      conversations: 0,\n      unreadMessages: 0,\n      expiringSoon: 0,\n    },\n  );\n}\n\nfunction OwnerPerformanceOverview({ summary }: { summary: OwnerPerformanceSummary }) {\n  const { text } = useUiPreferences();\n  const metrics = [\n    {\n      key: "views",\n      label: text("المشاهدات المسجلة", "Recorded views"),\n      value: summary.recordedViews,\n      icon: <Eye className="h-4 w-4" />,\n    },\n    {\n      key: "favorites",\n      label: text("مرات الإضافة للمفضلة", "Favorites"),\n      value: summary.favorites,\n      icon: <Heart className="h-4 w-4" />,\n    },\n    {\n      key: "conversations",\n      label: text("محادثات الإعلانات", "Listing conversations"),\n      value: summary.conversations,\n      icon: <MessageCircle className="h-4 w-4" />,\n    },\n    {\n      key: "unread",\n      label: text("رسائل غير مقروءة", "Unread messages"),\n      value: summary.unreadMessages,\n      icon: <BellRing className="h-4 w-4" />,\n    },\n  ];\n\n  return (\n    <section\n      data-owner-performance-overview="true"\n      aria-label={text("ملخص أداء الإعلانات", "Listing performance summary")}\n      className="rawaj-color-card rawaj-world-blue rounded-[1.4rem] p-4 sm:p-5"\n    >\n      <div className="flex flex-wrap items-start justify-between gap-3">\n        <div>\n          <p className="flex items-center gap-2 text-sm font-extrabold text-foreground">\n            <TrendingUp className="h-4 w-4 text-primary" />\n            {text("أداء إعلاناتك", "Your listing performance")}\n          </p>\n          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">\n            {text(\n              "إجمالي النشاط الحقيقي للإعلانات المعتمدة والمغلقة. المشاهدات تشمل المستخدمين المسجلين فقط.",\n              "Real activity across approved and closed listings. Views include signed-in users only.",\n            )}\n          </p>\n        </div>\n        <span className="rounded-full bg-primary/8 px-3 py-1 text-[10px] font-bold text-primary">\n          {text("إعلانات متتبعة", "Tracked listings")}: {formatOwnerMetric(summary.trackedListings)}\n        </span>\n      </div>\n      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">\n        {metrics.map((metric) => (\n          <div\n            key={metric.key}\n            data-owner-summary-metric={metric.key}\n            className="rounded-xl bg-card/80 p-3 hairline"\n          >\n            <div className="flex items-center gap-1.5 text-primary">{metric.icon}</div>\n            <p className="mt-2 text-xl font-extrabold text-foreground">\n              {formatOwnerMetric(metric.value)}\n            </p>\n            <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">\n              {metric.label}\n            </p>\n          </div>\n        ))}\n      </div>\n      {summary.trackedListings === 0 ? (\n        <p className="mt-3 rounded-xl bg-muted-surface p-3 text-[11px] text-muted-foreground">\n          {text(\n            "ستظهر بيانات الأداء بعد اعتماد أول إعلان وبدء تفاعل المستخدمين معه.",\n            "Performance data appears after your first listing is approved and receives activity.",\n          )}\n        </p>\n      ) : summary.expiringSoon > 0 ? (\n        <p\n          data-owner-expiry-alert="warning"\n          className="mt-3 flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-[11px] font-bold text-foreground"\n        >\n          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />\n          {text(\n            `لديك ${formatOwnerMetric(summary.expiringSoon)} إعلان ينتهي خلال 7 أيام ويحتاج مراجعة المدة.`,\n            `${formatOwnerMetric(summary.expiringSoon)} listing(s) expire within 7 days and need attention.`,\n          )}\n        </p>\n      ) : (\n        <p\n          data-owner-expiry-alert="safe"\n          className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-trust/10 p-3 text-[11px] font-semibold text-foreground"\n        >\n          <CircleCheckBig className="h-4 w-4 shrink-0 text-emerald-trust" />\n          {text(\n            "لا توجد إعلانات معتمدة تنتهي خلال الأيام السبعة القادمة.",\n            "No approved listings expire within the next seven days.",\n          )}\n        </p>\n      )}\n    </section>\n  );\n}\n\nfunction OwnerListingPerformance({\n  listing,\n  language,\n}: {\n  listing: ClassifiedListing;\n  language: Language;\n}) {\n  const { text } = useUiPreferences();\n  if (!isPerformanceEligibleListing(listing)) return null;\n  const metrics = [\n    {\n      key: "views",\n      label: text("مشاهدات", "Views"),\n      value: listing.recordedViewCount ?? 0,\n      icon: <Eye className="h-3.5 w-3.5" />,\n    },\n    {\n      key: "favorites",\n      label: text("مفضلة", "Favorites"),\n      value: listing.favoriteCount ?? 0,\n      icon: <Heart className="h-3.5 w-3.5" />,\n    },\n    {\n      key: "conversations",\n      label: text("محادثات", "Conversations"),\n      value: listing.conversationCount ?? 0,\n      icon: <MessageCircle className="h-3.5 w-3.5" />,\n    },\n    {\n      key: "unread",\n      label: text("غير مقروء", "Unread"),\n      value: listing.unreadMessageCount ?? 0,\n      icon: <BellRing className="h-3.5 w-3.5" />,\n    },\n  ];\n\n  return (\n    <div\n      data-owner-listing-performance="true"\n      className="rounded-xl bg-primary/[0.035] p-2.5 hairline"\n    >\n      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">\n        {metrics.map((metric) => (\n          <div\n            key={metric.key}\n            data-owner-metric={metric.key}\n            className={\`rounded-lg bg-card px-2.5 py-2 ${\n              metric.key === "unread" && metric.value > 0 ? "ring-1 ring-warning/35" : ""\n            }\`}\n          >\n            <p className="flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">\n              {metric.icon}\n              {metric.label}\n            </p>\n            <p className="mt-1 text-sm font-extrabold text-foreground">\n              {formatOwnerMetric(metric.value)}\n            </p>\n          </div>\n        ))}\n      </div>\n      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">\n        <p className="text-[9px] leading-4 text-muted-foreground">\n          {text(\n            "المشاهدات المسجلة لا تشمل الزوار غير المسجلين.",\n            "Recorded views do not include signed-out visitors.",\n          )}\n          {listing.lastInquiryAt\n            ? ` · ${text("آخر استفسار", "Last inquiry")}: ${formatSavedAt(\n                listing.lastInquiryAt,\n                language,\n              )}`\n            : ""}\n        </p>\n        {(listing.unreadMessageCount ?? 0) > 0 ? (\n          <Link\n            to="/chats"\n            className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-warning/10 px-2.5 py-1 text-[10px] font-bold text-foreground"\n          >\n            <BellRing className="h-3.5 w-3.5 text-warning" />\n            {text("فتح الرسائل", "Open messages")}\n          </Link>\n        ) : null}\n      </div>\n    </div>\n  );\n}\n\nfunction ownerListingExpiryInsight(\n  listing: ClassifiedListing,\n  text: (ar: string, en: string) => string,\n): OwnerExpiryInsight | null {\n  if (listing.status !== "approved" && listing.status !== "expired") return null;\n  if (listing.status === "expired") {\n    return {\n      tone: "danger",\n      title: text("انتهت صلاحية الإعلان", "Listing expired"),\n      description: text(\n        "أعد تفعيل الإعلان وأرسله للمراجعة إذا كان ما زال متاحاً.",\n        "Reactivate and resubmit the listing if it is still available.",\n      ),\n    };\n  }\n  if (!listing.expiresAt) {\n    return {\n      tone: "safe",\n      title: text("بدون انتهاء تلقائي", "No automatic expiry"),\n      description: text(\n        "سيبقى الإعلان منشوراً حتى تغيّر حالته أو تحدد مدة صلاحية.",\n        "The listing remains published until you change its status or set an expiry period.",\n      ),\n    };\n  }\n  const daysRemaining = daysUntilExpiry(listing.expiresAt);\n  if (daysRemaining === null) return null;\n  if (daysRemaining <= 0) {\n    return {\n      tone: "danger",\n      title: text("تنتهي صلاحية الإعلان اليوم", "Listing expires today"),\n      description: text(\n        "جدد المدة الآن لتجنب اختفاء الإعلان من النتائج.",\n        "Renew the duration now to prevent the listing from leaving search results.",\n      ),\n    };\n  }\n  if (daysRemaining <= 3) {\n    return {\n      tone: "danger",\n      title: text(\n        `ينتهي الإعلان خلال ${formatOwnerMetric(daysRemaining)} يوم`,\n        `Listing expires in ${formatOwnerMetric(daysRemaining)} day(s)`,\n      ),\n      description: text(\n        "هذا تنبيه عاجل: راجع توفر الإعلان وجدّد المدة.",\n        "Urgent: confirm availability and renew the listing duration.",\n      ),\n    };\n  }\n  if (daysRemaining <= 7) {\n    return {\n      tone: "warning",\n      title: text(\n        `متبقي ${formatOwnerMetric(daysRemaining)} يوم على انتهاء الإعلان`,\n        `${formatOwnerMetric(daysRemaining)} day(s) remain`,\n      ),\n      description: text(\n        "راجع الإعلان وجدّد المدة قبل انتهائها.",\n        "Review the listing and renew it before expiry.",\n      ),\n    };\n  }\n  return {\n    tone: "neutral",\n    title: text(\n      `متبقي ${formatOwnerMetric(daysRemaining)} يوم`,\n      `${formatOwnerMetric(daysRemaining)} day(s) remaining`,\n    ),\n    description: text(\n      "مدة الإعلان فعالة حالياً.",\n      "The listing duration is currently active.",\n    ),\n  };\n}\n\nfunction ownerExpiryInsightClassName(tone: OwnerExpiryInsight["tone"]): string {\n  if (tone === "danger") return "border-destructive/25 bg-destructive/10 text-destructive";\n  if (tone === "warning") return "border-warning/30 bg-warning/10 text-foreground";\n  if (tone === "safe") return "border-emerald-trust/25 bg-emerald-trust/10 text-foreground";\n  return "border-border/70 bg-muted-surface text-foreground";\n}\n\nfunction daysUntilExpiry(value: string | null | undefined): number | null {\n  if (!value) return null;\n  const timestamp = Date.parse(value);\n  if (!Number.isFinite(timestamp)) return null;\n  return Math.ceil((timestamp - Date.now()) / 86_400_000);\n}\n\nfunction isPerformanceEligibleListing(listing: ClassifiedListing): boolean {\n  return listing.status === "approved" || isClosedListingStatus(listing.status);\n}\n\nfunction formatOwnerMetric(value: number): string {\n  return Math.max(0, Math.trunc(value)).toLocaleString("en-US");\n}\n\nfunction TabButton({`,
  "owner performance components",
);
route = replaceOnce(
  route,
  `  const lifecycleConfirmationCopy = pendingLifecycleConfirmation\n    ? ownerLifecycleConfirmationCopy(pendingLifecycleConfirmation, text)\n    : null;`,
  `  const lifecycleConfirmationCopy = pendingLifecycleConfirmation\n    ? ownerLifecycleConfirmationCopy(pendingLifecycleConfirmation, text)\n    : null;\n  const expiryInsight = ownerListingExpiryInsight(listing, text);`,
  "owner expiry insight binding",
);
route = replaceOnce(
  route,
  `          {listing.expiresAt && (\n            <p\n              className={\`rounded-lg p-2 text-[11px] font-semibold ${\n                listing.status === "expired"\n                  ? "bg-destructive/10 text-destructive"\n                  : "bg-warning/10 text-foreground"\n              }\`}\n            >\n              {listing.status === "expired"\n                ? text("انتهى الإعلان", "Listing expired")\n                : text("موعد انتهاء الإعلان", "Listing expiry")}\n              : {formatSavedAt(listing.expiresAt, language)}\n            </p>\n          )}`,
  `          {expiryInsight ? (\n            <div\n              data-owner-expiry-insight={expiryInsight.tone}\n              className={\`rounded-xl border p-2.5 ${ownerExpiryInsightClassName(\n                expiryInsight.tone,\n              )}\`}\n            >\n              <p className="flex items-center gap-1.5 text-[11px] font-extrabold">\n                <Clock3 className="h-3.5 w-3.5" />\n                {expiryInsight.title}\n              </p>\n              <p className="mt-1 text-[10px] leading-4 opacity-80">\n                {expiryInsight.description}\n                {listing.expiresAt\n                  ? ` · ${text("التاريخ", "Date")}: ${formatSavedAt(\n                      listing.expiresAt,\n                      language,\n                    )}`\n                  : ""}\n              </p>\n            </div>\n          ) : null}`,
  "owner expiry insight panel",
);
route = replaceOnce(
  route,
  `          </p>\n          {listing.status === "rejected" && (`,
  `          </p>\n          <OwnerListingPerformance listing={listing} language={language} />\n          {listing.status === "rejected" && (`,
  "per-listing performance panel",
);
await writeFile(routePath, route, "utf8");

let fixture = await readFile(fixturePath, "utf8");
fixture = replaceOnce(
  fixture,
  `  statusChangedAt: string | null;\n  updatedAt: string;`,
  `  statusChangedAt: string | null;\n  recordedViewCount: number;\n  favoriteCount: number;\n  conversationCount: number;\n  unreadMessageCount: number;\n  lastInquiryAt: string | null;\n  updatedAt: string;`,
  "fixture performance fields",
);
fixture = replaceOnce(
  fixture,
  `function approvedListing(): FixtureListing {\n  return baseListing({\n    id: APPROVED_LISTING_ID,\n    title: "سيارة عائلية معتمدة",\n    description: "إعلان معتمد مخصص لاختبار إدارة دورة حياة الإعلان.",\n    status: "approved",\n    price: 450_000_000,\n    priceType: "fixed",\n    expiryDays: 60,\n    expiresAt: "2026-09-28T12:00:00.000Z",\n    renewedAt: null,\n  });\n}`,
  `function approvedListing(): FixtureListing {\n  return {\n    ...baseListing({\n      id: APPROVED_LISTING_ID,\n      title: "سيارة عائلية معتمدة",\n      description: "إعلان معتمد مخصص لاختبار إدارة دورة حياة الإعلان.",\n      status: "approved",\n      price: 450_000_000,\n      priceType: "fixed",\n      expiryDays: 60,\n      expiresAt: "2026-09-28T12:00:00.000Z",\n      renewedAt: null,\n    }),\n    recordedViewCount: 24,\n    favoriteCount: 5,\n    conversationCount: 3,\n    unreadMessageCount: 2,\n    lastInquiryAt: "2026-07-30T16:45:00.000Z",\n  };\n}`,
  "approved listing performance fixture",
);
fixture = replaceOnce(
  fixture,
  `    expiryDays: values.expiryDays,\n    createdAt: BASE_TIMESTAMP,`,
  `    expiryDays: values.expiryDays,\n    recordedViewCount: 0,\n    favoriteCount: 0,\n    conversationCount: 0,\n    unreadMessageCount: 0,\n    lastInquiryAt: null,\n    createdAt: BASE_TIMESTAMP,`,
  "fixture performance defaults",
);
await writeFile(fixturePath, fixture, "utf8");

let journey = await readFile(journeyPath, "utf8");
journey = replaceOnce(
  journey,
  `    let approvedCard = ownerCard(page, APPROVED_TITLE);\n    await expect(approvedCard).toBeVisible({ timeout: 30_000 });\n`,
  `    let approvedCard = ownerCard(page, APPROVED_TITLE);\n    await expect(approvedCard).toBeVisible({ timeout: 30_000 });\n\n    const performanceOverview = page.locator('[data-owner-performance-overview="true"]');\n    await expect(performanceOverview).toBeVisible();\n    await expect(performanceOverview.locator('[data-owner-summary-metric="views"]')).toContainText(\n      "24",\n    );\n    await expect(\n      performanceOverview.locator('[data-owner-summary-metric="favorites"]'),\n    ).toContainText("5");\n    await expect(\n      performanceOverview.locator('[data-owner-summary-metric="conversations"]'),\n    ).toContainText("3");\n    await expect(performanceOverview.locator('[data-owner-summary-metric="unread"]')).toContainText(\n      "2",\n    );\n\n    const listingPerformance = approvedCard.locator(\n      '[data-owner-listing-performance="true"]',\n    );\n    await expect(listingPerformance.locator('[data-owner-metric="views"]')).toContainText("24");\n    await expect(listingPerformance.locator('[data-owner-metric="favorites"]')).toContainText("5");\n    await expect(listingPerformance.locator('[data-owner-metric="conversations"]')).toContainText(\n      "3",\n    );\n    await expect(listingPerformance.locator('[data-owner-metric="unread"]')).toContainText("2");\n`,
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

await writeFile(
  testPath,
  `import assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport test from "node:test";\n\nconst [types, listingsApi, worker, route, fixture, journey, packageJson] = await Promise.all([\n  readFile(new URL("../src/lib/classifieds-types.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),\n  readFile(new URL("../cloudflare/worker/src/marketplace-private.ts", import.meta.url), "utf8"),\n  readFile(new URL("../src/routes/profile/listings.tsx", import.meta.url), "utf8"),\n  readFile(new URL("../e2e/rawaj-e2e-owner-listing-lifecycle-fixture.ts", import.meta.url), "utf8"),\n  readFile(new URL("../e2e/authenticated-owner-listing-lifecycle-journey.spec.ts", import.meta.url), "utf8"),\n  readFile(new URL("../package.json", import.meta.url), "utf8"),\n]);\n\ntest("owner listing contracts expose real performance metrics", () => {\n  for (const field of [\n    "recordedViewCount",\n    "favoriteCount",\n    "conversationCount",\n    "unreadMessageCount",\n    "lastInquiryAt",\n  ]) {\n    assert.match(types, new RegExp(field));\n    assert.match(listingsApi, new RegExp(field));\n    assert.match(worker, new RegExp(field));\n  }\n});\n\ntest("owner query aggregates existing social and messaging data without schema changes", () => {\n  assert.match(worker, /SUM\\(view_count\\) AS recorded_view_count/);\n  assert.match(worker, /recent_listing_views WHERE user_id <> \\?/);\n  assert.match(worker, /COUNT\\(\\*\\) AS favorite_count/);\n  assert.match(worker, /conversations WHERE seller_id = \\?/);\n  assert.match(worker, /cm\\.read_at IS NULL AND cm\\.deleted_at IS NULL/);\n  assert.match(worker, /MAX\\(COALESCE\\(last_message_at, updated_at\\)\\)/);\n  assert.doesNotMatch(worker, /CREATE TABLE owner_listing_performance/);\n});\n\ntest("owner UI renders summary, per-listing metrics, unread action, and expiry guidance", () => {\n  assert.match(route, /data-owner-performance-overview="true"/);\n  assert.match(route, /data-owner-listing-performance="true"/);\n  for (const metric of ["views", "favorites", "conversations", "unread"]) {\n    assert.match(route, new RegExp(\\`data-owner-metric={metric.key}\\`));\n  }\n  assert.match(route, /to="\\/chats"/);\n  assert.match(route, /ownerListingExpiryInsight/);\n  assert.match(route, /daysRemaining <= 3/);\n  assert.match(route, /daysRemaining <= 7/);\n  assert.match(route, /المشاهدات المسجلة لا تشمل الزوار غير المسجلين/);\n});\n\ntest("browser fixture verifies exact owner performance values", () => {\n  assert.match(fixture, /recordedViewCount: 24/);\n  assert.match(fixture, /favoriteCount: 5/);\n  assert.match(fixture, /conversationCount: 3/);\n  assert.match(fixture, /unreadMessageCount: 2/);\n  assert.match(journey, /data-owner-summary-metric/);\n  assert.match(journey, /data-owner-listing-performance/);\n});\n\ntest("owner performance contract runs in precheck", () => {\n  const parsed = JSON.parse(packageJson);\n  assert.equal(\n    parsed.scripts["test:owner-listing-performance"],\n    "node --test scripts/owner-listing-performance-dashboard-v1.test.mjs",\n  );\n  assert.match(parsed.scripts.precheck, /test:owner-listing-performance/);\n});\n`,
  "utf8",
);

await rm(applyPath);
await rm(workflowPath);
