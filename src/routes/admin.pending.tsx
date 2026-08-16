import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, FileCheck, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ResilientImage } from "@/components/media/ResilientImage";
import {
  adminFetchPendingListings,
  adminModerateListing,
  fetchListingImages,
} from "@/lib/classifieds-api";
import { categoryDetailDisplayRows, detectCategoryFieldKind } from "@/lib/category-fields";
import type { ClassifiedListing, ClassifiedsError, ListingImage } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName, uiLabel } from "@/lib/i18n";
import { marketLocale } from "@/lib/market-locale";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/pending")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: PendingPage,
});

function PendingPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const canModerateListings = auth.hasPermission("canModerateListings");
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [message, setMessage] = useState("");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [expandedListingId, setExpandedListingId] = useState<string | null>(null);
  const [imagesByListingId, setImagesByListingId] = useState<Record<string, ListingImage[]>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, ClassifiedsError | null>>({});
  const [imagesLoadingIds, setImagesLoadingIds] = useState<Set<string>>(new Set());
  const [actionBusyIds, setActionBusyIds] = useState<Set<string>>(new Set());
  const loadRequestIdRef = useRef(0);
  const actionInFlightRef = useRef<Set<string>>(new Set());
  const imageLoadInFlightRef = useRef<Set<string>>(new Set());

  const loadPending = useCallback(async () => {
    if (!canModerateListings) return;
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await adminFetchPendingListings(canModerateListings);
      if (requestId !== loadRequestIdRef.current) return;
      if (result.ok) {
        setListings(result.data);
        setHasLoaded(true);
      } else {
        setError(result.error);
      }
    } catch (caught) {
      if (requestId !== loadRequestIdRef.current) return;
      setError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل طابور المراجعة.", "Could not load review queue."),
        operation: "admin_pending_load",
      });
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, [canModerateListings, text]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    actionInFlightRef.current.clear();
    imageLoadInFlightRef.current.clear();
    setActionBusyIds(new Set());
    if (!canModerateListings) {
      setListings([]);
      setLoading(false);
      setHasLoaded(false);
      setError(null);
      return;
    }
    setListings([]);
    setLoading(false);
    setHasLoaded(false);
    setError(null);
    void loadPending();
    return () => {
      loadRequestIdRef.current += 1;
      actionInFlightRef.current.clear();
      imageLoadInFlightRef.current.clear();
    };
  }, [canModerateListings, loadPending]);

  async function moderate(listing: ClassifiedListing, status: "approved" | "rejected") {
    const actionKey = listing.id;
    if (actionInFlightRef.current.has(actionKey)) return;
    setMessage("");
    if (!auth.profile?.id) {
      setMessage(
        text("تعذر تحديد حساب المراجع الحالي.", "Could not identify the current reviewer account."),
      );
      return;
    }
    if (status === "rejected" && !rejectReasons[listing.id]?.trim()) {
      setMessage(text("أدخل سبب الرفض قبل تحديث الإعلان.", "Add a rejection reason first."));
      return;
    }

    actionInFlightRef.current.add(actionKey);
    setActionBusyIds((current) => new Set(current).add(actionKey));
    try {
      const result = await adminModerateListing(canModerateListings, {
        listingId: listing.id,
        status,
        reviewerId: auth.profile.id,
        rejectionReason: status === "rejected" ? rejectReasons[listing.id] : null,
        expectedUpdatedAt: listing.updatedAt,
      });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setListings((current) => current.filter((item) => item.id !== listing.id));
      setExpandedListingId((current) => (current === listing.id ? null : current));
      setRejectReasons((current) => {
        const next = { ...current };
        delete next[listing.id];
        return next;
      });
      setMessage(
        status === "approved"
          ? text("تم اعتماد الإعلان.", "Listing approved.")
          : text("تم رفض الإعلان.", "Listing rejected."),
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحديث حالة الإعلان.", "Could not update listing status."),
      );
    } finally {
      actionInFlightRef.current.delete(actionKey);
      setActionBusyIds((current) => {
        const next = new Set(current);
        next.delete(actionKey);
        return next;
      });
    }
  }

  async function loadImages(listingId: string) {
    if (imageLoadInFlightRef.current.has(listingId)) return;
    imageLoadInFlightRef.current.add(listingId);
    setImagesLoadingIds((current) => new Set(current).add(listingId));
    setImageErrors((current) => ({ ...current, [listingId]: null }));
    try {
      const result = await fetchListingImages(listingId);
      if (result.ok) {
        setImagesByListingId((current) => ({ ...current, [listingId]: result.data }));
      } else {
        setImageErrors((current) => ({ ...current, [listingId]: result.error }));
      }
    } catch (caught) {
      setImageErrors((current) => ({
        ...current,
        [listingId]: {
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر تحميل صور الإعلان.", "Could not load listing images."),
          operation: "admin_pending_images",
        },
      }));
    } finally {
      imageLoadInFlightRef.current.delete(listingId);
      setImagesLoadingIds((current) => {
        const next = new Set(current);
        next.delete(listingId);
        return next;
      });
    }
  }

  async function toggleDetails(listingId: string) {
    const nextId = expandedListingId === listingId ? null : listingId;
    setExpandedListingId(nextId);
    if (!nextId || (imagesByListingId[nextId] && !imageErrors[nextId])) return;
    await loadImages(nextId);
  }

  if (!canModerateListings) {
    return (
      <Panel
        title={text("غير مخوّل لمراجعة الإعلانات", "Not authorized to moderate listings")}
        body={text(
          "يتطلب هذا الطابور صلاحية مراجعة الإعلانات المحفوظة في مصفوفة الوصول.",
          "This queue requires the persisted listing moderation permission.",
        )}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-4 hairline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <FileCheck className="h-4 w-4 text-primary" />
              {text("إعلانات قيد المراجعة", "Listings pending review")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "يعرض هذا الطابور الإعلانات الحقيقية التي تنتظر قرارا إداريا.",
                "This queue shows real listings waiting for an admin decision.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{text("محمي بالصلاحيات", "Permission protected")}</Badge>
            <Link
              to={"/admin/listings" as "/admin"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              <ShieldCheck className="h-4 w-4" />
              {text("وحدة القرارات", "Moderation console")}
            </Link>
          </div>
        </div>
        {message ? (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{message}</p>
        ) : null}
      </section>

      {error && hasLoaded ? (
        <div className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          <p>{error.message}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadPending()}
            className="mt-2 rounded-lg bg-card px-3 py-1.5 text-foreground hairline disabled:opacity-60"
          >
            {loading ? text("جارٍ التحديث", "Refreshing") : text("إعادة المحاولة", "Try again")}
          </button>
        </div>
      ) : null}

      {loading && !hasLoaded ? (
        <Panel title={text("جارٍ تحميل طابور المراجعة", "Loading review queue")} />
      ) : error && !hasLoaded ? (
        <Panel
          title={text("تعذر تحميل طابور المراجعة", "Could not load review queue")}
          body={error.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void loadPending()}
        />
      ) : listings.length === 0 ? (
        <Panel
          title={text("لا توجد إعلانات بانتظار المراجعة", "No listings awaiting review")}
          body={text(
            "عند إرسال إعلانات جديدة للمراجعة ستظهر هنا.",
            "New submitted listings will appear here.",
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {listings.map((listing) => {
            const actionBusy = actionBusyIds.has(listing.id);
            return (
              <article key={listing.id} className="rounded-2xl bg-card p-4 hairline">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold">{listing.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {listing.id} ·{" "}
                      {categoryName(
                        listing.categoryId,
                        listing.categoryNameAr ?? undefined,
                        language,
                      )}{" "}
                      ·{" "}
                      {governorateName(
                        listing.governorateId,
                        listing.governorateNameAr ?? undefined,
                        language,
                      )}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {text("صاحب الإعلان:", "Listing owner:")} {listing.ownerId} ·{" "}
                      {text("الإرسال:", "Submitted:")} {formatDate(listing.createdAt, language)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-1 text-[10px] font-bold text-warning">
                    <Clock className="h-3 w-3" />
                    {uiLabel(listing.status, language)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleDetails(listing.id)}
                  className="mt-3 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold text-foreground"
                >
                  {expandedListingId === listing.id
                    ? text("إخفاء التفاصيل", "Hide details")
                    : text("عرض التفاصيل الكاملة", "View full details")}
                </button>
                {expandedListingId === listing.id ? (
                  <PendingListingDetails
                    listing={listing}
                    images={imagesByListingId[listing.id] ?? []}
                    imagesLoading={imagesLoadingIds.has(listing.id)}
                    imagesError={imageErrors[listing.id]?.message ?? null}
                    onRetryImages={() => void loadImages(listing.id)}
                  />
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    value={rejectReasons[listing.id] ?? ""}
                    disabled={actionBusy}
                    onChange={(event) =>
                      setRejectReasons((current) => ({
                        ...current,
                        [listing.id]: event.target.value,
                      }))
                    }
                    placeholder={text("سبب الرفض عند الحاجة", "Rejection reason when needed")}
                    className="rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline disabled:opacity-60"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionBusy}
                      aria-busy={actionBusy}
                      onClick={() => void moderate(listing, "approved")}
                      className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground disabled:opacity-60"
                    >
                      {actionBusy ? text("جارٍ التحديث", "Updating") : text("اعتماد", "Approve")}
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy}
                      aria-busy={actionBusy}
                      onClick={() => void moderate(listing, "rejected")}
                      className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60"
                    >
                      {actionBusy ? text("جارٍ التحديث", "Updating") : text("رفض", "Reject")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function PendingListingDetails({
  listing,
  images,
  imagesLoading,
  imagesError,
  onRetryImages,
}: {
  listing: ClassifiedListing;
  images: ListingImage[];
  imagesLoading: boolean;
  imagesError: string | null;
  onRetryImages: () => void;
}) {
  const { language, text } = useUiPreferences();
  const hiddenDetailKeys = new Set(["phone", "whatsapp", "content_flags"]);
  const categoryRows = categoryDetailDisplayRows(
    detectCategoryFieldKind(null, listing),
    listing.details,
    text,
  );
  const detailsEntries = Object.entries(listing.details).filter(
    ([key, value]) =>
      !hiddenDetailKeys.has(key) &&
      !categoryRows.some(([label]) => label === key) &&
      ![
        "property_type",
        "listing_purpose",
        "bedrooms",
        "bathrooms",
        "area_sqm",
        "floor",
        "furnished",
        "parking",
        "make",
        "model",
        "year",
        "mileage_km",
        "fuel_type",
        "transmission",
        "vehicle_condition",
        "color",
      ].includes(key) &&
      value !== undefined &&
      value !== null &&
      value !== "",
  );
  const phone = detailString(listing.details, "phone");
  const whatsapp = detailString(listing.details, "whatsapp");
  const contentFlags = detailStringArray(listing.details, "content_flags");

  return (
    <section className="mt-3 rounded-xl bg-muted-surface p-3 hairline">
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <DetailItem label={text("العنوان", "Title")} value={listing.title} />
        <DetailItem
          label={text("القسم", "Category")}
          value={categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
        />
        <DetailItem
          label={text("المحافظة", "Governorate")}
          value={governorateName(
            listing.governorateId,
            listing.governorateNameAr ?? undefined,
            language,
          )}
        />
        <DetailItem label={text("المنطقة", "District")} value={listing.districtAr ?? "-"} />
        <DetailItem
          label={text("السعر", "Price")}
          value={formatPriceLocalized(
            listing.price ?? 0,
            listing.priceType,
            language,
            listing.currency,
          )}
        />
        <DetailItem
          label={text("الحالة", "Condition")}
          value={uiLabel(listing.condition, language)}
        />
        <DetailItem
          label={text("اسم التواصل", "Contact name")}
          value={listing.contactName ?? "-"}
        />
        <DetailItem
          label={text("خيارات التواصل", "Contact options")}
          value={contactOptionsLabel(listing.contactOptions, text)}
        />
        {phone ? <DetailItem label={text("رقم الهاتف", "Phone number")} value={phone} /> : null}
        {whatsapp ? (
          <DetailItem label={text("رقم واتساب", "WhatsApp number")} value={whatsapp} />
        ) : null}
      </div>
      <div className="mt-3">
        <p className="mb-1 text-xs font-bold">{text("الوصف", "Description")}</p>
        <p className="whitespace-pre-line rounded-lg bg-card p-3 text-xs leading-6">
          {listing.description || "-"}
        </p>
      </div>
      {contentFlags.length > 0 ? (
        <div className="mt-3 rounded-lg bg-warning/10 p-3 text-xs leading-6 text-foreground hairline">
          <p className="mb-1 font-bold">{text("أعلام السلامة", "Safety flags")}</p>
          <div className="flex flex-wrap gap-1.5">
            {contentFlags.map((flag) => (
              <span
                key={flag}
                className="rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {categoryRows.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          {categoryRows.map(([label, value]) => (
            <DetailItem key={label} label={label} value={displayValue(value)} />
          ))}
        </div>
      ) : null}
      {detailsEntries.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-bold">{text("تفاصيل إضافية", "Additional details")}</p>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {detailsEntries.map(([key, value]) => (
              <DetailItem key={key} label={key} value={displayValue(value)} />
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-3">
        <p className="mb-1 text-xs font-bold">{text("الصور", "Images")}</p>
        {imagesLoading ? (
          <p className="text-xs text-muted-foreground">
            {text("جارٍ تحميل الصور", "Loading images")}
          </p>
        ) : imagesError ? (
          <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            <p>{imagesError}</p>
            <button
              type="button"
              onClick={onRetryImages}
              className="mt-2 rounded-lg bg-card px-3 py-1.5 font-bold text-foreground hairline"
            >
              {text("إعادة تحميل الصور", "Retry images")}
            </button>
          </div>
        ) : images.length === 0 ? (
          <p className="text-xs text-muted-foreground">{text("لا توجد صور", "No images")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {images.map((image) => {
              const fallback = (
                <div className="grid aspect-square place-items-center rounded-lg bg-card p-2 text-center text-[10px] text-muted-foreground hairline">
                  {text("تعذر عرض الصورة", "Image unavailable")}
                </div>
              );
              return (
                <ResilientImage
                  key={image.id}
                  src={image.publicUrl ?? undefined}
                  alt={image.altAr ?? listing.title}
                  width={320}
                  height={320}
                  className="aspect-square w-full rounded-lg object-cover hairline"
                  fallback={fallback}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted-surface px-2 py-1 text-[10px] font-bold hairline">
      {children}
    </span>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card p-2 hairline">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-xs">{value || "-"}</p>
    </div>
  );
}

function detailString(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" ? value.trim() : "";
}

function detailStringArray(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join("، ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return "-";
}

function contactOptionsLabel(
  options: Record<string, boolean>,
  text: (ar: string, en: string) => string,
) {
  const labels: Record<string, string> = {
    message: text("رسائل", "Messages"),
    phone: text("هاتف", "Phone"),
    whatsapp: text("واتساب", "WhatsApp"),
  };
  const enabled = Object.entries(options)
    .filter(([, value]) => value)
    .map(([key]) => labels[key] ?? key);
  return enabled.length > 0 ? enabled.join("، ") : "-";
}

function formatDate(value: string, language: Language) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(marketLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}