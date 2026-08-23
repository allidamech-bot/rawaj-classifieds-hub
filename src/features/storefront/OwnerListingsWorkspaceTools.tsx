import { Link } from "@tanstack/react-router";
import {
  ArrowDownAZ,
  BellRing,
  ChevronDown,
  CheckSquare,
  Clock3,
  FileWarning,
  ImageOff,
  Megaphone,
  Plus,
  Search,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ListingExpiryOption } from "@/lib/api/listing-expiry";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

export type OwnerListingSort =
  "updated_desc" | "updated_asc" | "price_desc" | "price_asc" | "views_desc";

export type OwnerPerformanceWindow = "all" | "30" | "90";

export function filterAndSortOwnerListings(
  listings: ClassifiedListing[],
  query: string,
  sort: OwnerListingSort,
): ClassifiedListing[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? listings.filter((listing) =>
        [
          listing.title,
          listing.description,
          listing.categoryNameAr,
          listing.governorateNameAr,
          listing.districtAr,
        ]
          .filter((value): value is string => typeof value === "string")
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
      )
    : listings;

  return [...filtered].sort((left, right) => {
    if (sort === "updated_asc") return timestamp(left.updatedAt) - timestamp(right.updatedAt);
    if (sort === "price_desc") {
      return sortablePrice(right.price, -1) - sortablePrice(left.price, -1);
    }
    if (sort === "price_asc") {
      return (
        sortablePrice(left.price, Number.MAX_SAFE_INTEGER) -
        sortablePrice(right.price, Number.MAX_SAFE_INTEGER)
      );
    }
    if (sort === "views_desc") {
      const difference = (right.recordedViewCount ?? 0) - (left.recordedViewCount ?? 0);
      return difference || timestamp(right.updatedAt) - timestamp(left.updatedAt);
    }
    return timestamp(right.updatedAt) - timestamp(left.updatedAt);
  });
}

export function filterOwnerPerformanceWindow(
  listings: ClassifiedListing[],
  window: OwnerPerformanceWindow,
): ClassifiedListing[] {
  if (window === "all") return listings;
  const cutoff = Date.now() - Number(window) * 86_400_000;
  return listings.filter((listing) => {
    const parsed = Date.parse(listing.publishedAt || listing.createdAt);
    return Number.isFinite(parsed) && parsed >= cutoff;
  });
}

export function OwnerWorkspaceInsights({
  listings,
  onTabChange,
}: {
  listings: ClassifiedListing[];
  onTabChange: (tab: "approved" | "needs_edit") => void;
}) {
  const { text } = useUiPreferences();
  const [expanded, setExpanded] = useState(false);
  const urgentExpiry = listings.filter((listing) => {
    if (listing.status !== "approved" || !listing.expiresAt) return false;
    const days = daysUntilExpiry(listing.expiresAt);
    return days !== null && days >= 0 && days <= 3;
  }).length;
  const needsAction = listings.filter(
    (listing) => listing.status === "draft" || listing.status === "rejected",
  ).length;
  const unread = listings.reduce((total, listing) => total + (listing.unreadMessageCount ?? 0), 0);
  const editableMissingImages = listings.filter(
    (listing) =>
      (listing.status === "draft" || listing.status === "rejected") && !listing.primaryImageUrl,
  ).length;
  const approvedMissingImages = listings.filter(
    (listing) => listing.status === "approved" && !listing.primaryImageUrl,
  ).length;

  const alerts: Array<{ key: string; content: ReactNode }> = [];
  if (urgentExpiry > 0) {
    alerts.push({
      key: "urgent-expiry",
      content: (
        <button type="button" data-tone="danger" onClick={() => onTabChange("approved")}>
          <Clock3 aria-hidden="true" />
          <span>
            {text(
              `${urgentExpiry} إعلان يحتاج تجديداً عاجلاً`,
              `${urgentExpiry} listing(s) need urgent renewal`,
            )}
          </span>
        </button>
      ),
    });
  }
  if (needsAction > 0) {
    alerts.push({
      key: "needs-action",
      content: (
        <button type="button" data-tone="warning" onClick={() => onTabChange("needs_edit")}>
          <FileWarning aria-hidden="true" />
          <span>
            {text(`${needsAction} إعلان يحتاج تدخلك`, `${needsAction} listing(s) need your action`)}
          </span>
        </button>
      ),
    });
  }
  if (unread > 0) {
    alerts.push({
      key: "unread",
      content: (
        <Link to="/chats" data-tone="info">
          <BellRing aria-hidden="true" />
          <span>{text(`${unread} رسالة غير مقروءة`, `${unread} unread message(s)`)}</span>
        </Link>
      ),
    });
  }
  if (editableMissingImages > 0) {
    alerts.push({
      key: "editable-no-image",
      content: (
        <button type="button" data-tone="neutral" onClick={() => onTabChange("needs_edit")}>
          <ImageOff aria-hidden="true" />
          <span>
            {text(
              `${editableMissingImages} مسودة أو إعلان مرفوض بدون صورة`,
              `${editableMissingImages} editable listing(s) without an image`,
            )}
          </span>
        </button>
      ),
    });
  }
  if (approvedMissingImages > 0) {
    alerts.push({
      key: "approved-no-image",
      content: (
        <button type="button" data-tone="neutral" onClick={() => onTabChange("approved")}>
          <ImageOff aria-hidden="true" />
          <span>
            {text(
              `${approvedMissingImages} إعلان نشط بدون صورة`,
              `${approvedMissingImages} live listing(s) without an image`,
            )}
          </span>
        </button>
      ),
    });
  }

  if (alerts.length === 0) return null;

  const visibleAlerts = expanded ? alerts : alerts.slice(0, 3);
  const hiddenCount = alerts.length - visibleAlerts.length;

  return (
    <section
      className="rawaj-owner-smart-insights"
      aria-label={text("تنبيهات ذكية", "Smart alerts")}
    >
      {visibleAlerts.map((alert) => (
        <div className="rawaj-owner-smart-insights__item" key={alert.key}>
          {alert.content}
        </div>
      ))}
      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          className="rawaj-owner-smart-insights__more"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? text("عرض الأقل", "Show less")
            : text(`+${hiddenCount} تنبيهات`, `+${hiddenCount} more`)}
        </button>
      ) : null}
    </section>
  );
}

export function OwnerListingsToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  performanceWindow,
  onPerformanceWindowChange,
  totalCount,
  shownCount,
  canSelect,
  selectedCount,
  allVisibleSelected,
  onToggleVisibleSelection,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  sort: OwnerListingSort;
  onSortChange: (value: OwnerListingSort) => void;
  performanceWindow: OwnerPerformanceWindow;
  onPerformanceWindowChange: (value: OwnerPerformanceWindow) => void;
  totalCount: number;
  shownCount: number;
  canSelect: boolean;
  selectedCount: number;
  allVisibleSelected: boolean;
  onToggleVisibleSelection: () => void;
}) {
  const { text } = useUiPreferences();
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <section
      className="rawaj-owner-listings-toolbar"
      aria-label={text("أدوات إدارة الإعلانات", "Listing management tools")}
    >
      <label className="rawaj-owner-listings-toolbar__search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={text(
            "ابحث بعنوان الإعلان أو وصفه أو موقعه",
            "Search title, description, or location",
          )}
          aria-label={text("البحث في إعلاناتي", "Search my listings")}
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label={text("مسح البحث", "Clear search")}
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
      </label>

      <button
        type="button"
        className="rawaj-owner-listings-toolbar__filter-toggle"
        aria-expanded={filtersOpen}
        aria-controls="rawaj-owner-listing-filters"
        onClick={() => setFiltersOpen((current) => !current)}
      >
        <SlidersHorizontal aria-hidden="true" />
        <span>{text("تصفية وترتيب", "Filter and sort")}</span>
        <ChevronDown aria-hidden="true" data-open={filtersOpen} />
      </button>

      {filtersOpen ? (
        <div id="rawaj-owner-listing-filters" className="rawaj-owner-listings-toolbar__advanced">
          <label className="rawaj-owner-listings-toolbar__select">
            <ArrowDownAZ aria-hidden="true" />
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as OwnerListingSort)}
              aria-label={text("ترتيب الإعلانات", "Sort listings")}
            >
              <option value="updated_desc">{text("الأحدث تعديلاً", "Recently updated")}</option>
              <option value="updated_asc">{text("الأقدم تعديلاً", "Oldest updated")}</option>
              <option value="price_desc">{text("السعر: الأعلى", "Price: high to low")}</option>
              <option value="price_asc">{text("السعر: الأقل", "Price: low to high")}</option>
              <option value="views_desc">{text("الأكثر مشاهدة", "Most viewed")}</option>
            </select>
          </label>

          <label
            className="rawaj-owner-listings-toolbar__select"
            title={text(
              "الأرقام تراكمية للإعلانات الواقعة ضمن الفترة حسب تاريخ نشرها.",
              "Metrics are lifetime totals for listings published within the selected window.",
            )}
          >
            <SlidersHorizontal aria-hidden="true" />
            <select
              value={performanceWindow}
              onChange={(event) =>
                onPerformanceWindowChange(event.target.value as OwnerPerformanceWindow)
              }
              aria-label={text("نطاق تقرير الأداء", "Performance report scope")}
            >
              <option value="all">{text("أداء كل الفترات", "All-time listing scope")}</option>
              <option value="30">{text("إعلانات آخر 30 يوم", "Listings from last 30 days")}</option>
              <option value="90">{text("إعلانات آخر 90 يوم", "Listings from last 90 days")}</option>
            </select>
          </label>
        </div>
      ) : null}

      {canSelect ? (
        <button
          type="button"
          className="rawaj-owner-listings-toolbar__select-visible"
          onClick={onToggleVisibleSelection}
        >
          {allVisibleSelected ? <CheckSquare aria-hidden="true" /> : <Square aria-hidden="true" />}
          <span>
            {allVisibleSelected
              ? text("إلغاء تحديد الظاهرة", "Unselect visible")
              : text("تحديد الظاهرة", "Select visible")}
          </span>
        </button>
      ) : null}

      <span className="rawaj-owner-listings-toolbar__count">
        {text("المعروض", "Showing")} {shownCount} / {totalCount}
        {selectedCount > 0 ? ` · ${text("المحدد", "Selected")} ${selectedCount}` : ""}
      </span>

      <Link
        to="/advertise"
        className="rawaj-owner-listings-toolbar__advertise"
        aria-label={text("طلب مساحة إعلانية أو حملة", "Request ad space or campaign")}
        title={text("اطلب مساحة إعلانية أو حملة لرواج", "Request RAWAJ ad space or a campaign")}
      >
        <Megaphone aria-hidden="true" />
        <span>{text("إعلان مدفوع", "Advertise")}</span>
      </Link>

      <Link
        to="/add-listing"
        className="rawaj-owner-listings-toolbar__add"
        aria-label={text("إضافة إعلان", "Post listing")}
        title={text("إضافة إعلان", "Post listing")}
      >
        <Plus aria-hidden="true" />
        <span className="sr-only">{text("إضافة إعلان", "Post listing")}</span>
      </Link>
    </section>
  );
}

export function OwnerBulkActionBar({
  selectedCount,
  expiryOption,
  busy,
  feedback,
  onExpiryOptionChange,
  onRenew,
  onConfirmAvailability,
  onClear,
}: {
  selectedCount: number;
  expiryOption: ListingExpiryOption;
  busy: boolean;
  feedback: string;
  onExpiryOptionChange: (value: ListingExpiryOption) => void;
  onRenew: () => void;
  onConfirmAvailability: () => void;
  onClear: () => void;
}) {
  const { text } = useUiPreferences();
  if (selectedCount === 0 && !feedback) return null;

  return (
    <section className="rawaj-owner-bulk-actions" aria-live="polite">
      {selectedCount > 0 ? (
        <div>
          <strong>
            {text(`${selectedCount} إعلان محدد`, `${selectedCount} selected listing(s)`)}
          </strong>
          <span>
            {text(
              "الإجراءات الجماعية تطبق على الإعلانات المعتمدة فقط.",
              "Bulk actions apply to approved listings only.",
            )}
          </span>
        </div>
      ) : null}
      {selectedCount > 0 ? (
        <div className="rawaj-owner-bulk-actions__controls">
          <select
            value={String(expiryOption)}
            disabled={busy}
            aria-label={text("مدة التجديد الجماعي", "Bulk renewal period")}
            onChange={(event) =>
              onExpiryOptionChange(
                event.target.value === "never"
                  ? "never"
                  : (Number(event.target.value) as 30 | 60 | 90),
              )
            }
          >
            <option value="30">{text("تجديد 30 يوم", "Renew 30 days")}</option>
            <option value="60">{text("تجديد 60 يوم", "Renew 60 days")}</option>
            <option value="90">{text("تجديد 90 يوم", "Renew 90 days")}</option>
            <option value="never">{text("بدون انتهاء", "No automatic expiry")}</option>
          </select>
          <button type="button" disabled={busy} onClick={onRenew}>
            {busy ? text("جارٍ التنفيذ", "Working") : text("تطبيق التجديد", "Apply renewal")}
          </button>
          <button type="button" disabled={busy} onClick={onConfirmAvailability}>
            {text("تأكيد التوفر", "Confirm availability")}
          </button>
          <button type="button" disabled={busy} onClick={onClear} data-tone="neutral">
            <X aria-hidden="true" />
            {text("مسح", "Clear")}
          </button>
        </div>
      ) : null}
      {feedback ? <p>{feedback}</p> : null}
    </section>
  );
}

function sortablePrice(value: number | null, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysUntilExpiry(value: string): number | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.ceil((parsed - Date.now()) / 86_400_000);
}
