import { createFileRoute } from "@tanstack/react-router";
import { Clock, FileCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  adminFetchPendingListings,
  adminModerateListing,
  fetchListingImages,
} from "@/lib/classifieds-api";
import { categoryDetailDisplayRows, detectCategoryFieldKind } from "@/lib/category-fields";
import type { ClassifiedListing, ClassifiedsError, ListingImage } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName, uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/pending")({
  component: PendingPage,
});

function PendingPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [message, setMessage] = useState("");
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [expandedListingId, setExpandedListingId] = useState<string | null>(null);
  const [imagesByListingId, setImagesByListingId] = useState<Record<string, ListingImage[]>>({});
  const [imagesLoadingId, setImagesLoadingId] = useState<string | null>(null);

  async function loadPending() {
    setLoading(true);
    setError(null);
    const result = await adminFetchPendingListings(auth.canAccessAdmin);
    if (result.ok) setListings(result.data);
    else {
      setError(result.error);
      setListings([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadPending();
  }, [auth.canAccessAdmin]);

  async function moderate(listing: ClassifiedListing, status: "approved" | "rejected") {
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
    const result = await adminModerateListing(auth.canAccessAdmin, {
      listingId: listing.id,
      status,
      reviewerId: auth.profile.id,
      rejectionReason: status === "rejected" ? rejectReasons[listing.id] : null,
    });
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setMessage(
      status === "approved"
        ? text("تم اعتماد الإعلان.", "Listing approved.")
        : text("تم رفض الإعلان.", "Listing rejected."),
    );
    await loadPending();
  }

  async function toggleDetails(listingId: string) {
    const nextId = expandedListingId === listingId ? null : listingId;
    setExpandedListingId(nextId);
    if (!nextId || imagesByListingId[nextId]) return;
    setImagesLoadingId(nextId);
    const result = await fetchListingImages(nextId);
    setImagesLoadingId(null);
    if (result.ok) {
      setImagesByListingId((current) => ({ ...current, [nextId]: result.data }));
    }
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
          <Badge>{text("محمي بالصلاحيات", "Permission protected")}</Badge>
        </div>
        {message && (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{message}</p>
        )}
      </section>

      {loading ? (
        <Panel title={text("جارٍ تحميل طابور المراجعة", "Loading review queue")} />
      ) : error ? (
        <Panel
          title={text("تعذر تحميل طابور المراجعة", "Could not load review queue")}
          body={error.message}
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
          {listings.map((listing) => (
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
              {expandedListingId === listing.id && (
                <PendingListingDetails
                  listing={listing}
                  images={imagesByListingId[listing.id] ?? []}
                  imagesLoading={imagesLoadingId === listing.id}
                />
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={rejectReasons[listing.id] ?? ""}
                  onChange={(event) =>
                    setRejectReasons((current) => ({
                      ...current,
                      [listing.id]: event.target.value,
                    }))
                  }
                  placeholder={text("سبب الرفض عند الحاجة", "Rejection reason when needed")}
                  className="rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => void moderate(listing, "approved")}
                    className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                  >
                    {text("اعتماد", "Approve")}
                  </button>
                  <button
                    onClick={() => void moderate(listing, "rejected")}
                    className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                  >
                    {text("رفض", "Reject")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </div>
  );
}

function PendingListingDetails({
  listing,
  images,
  imagesLoading,
}: {
  listing: ClassifiedListing;
  images: ListingImage[];
  imagesLoading: boolean;
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
        {phone && <DetailItem label={text("رقم الهاتف", "Phone number")} value={phone} />}
        {whatsapp && <DetailItem label={text("رقم واتساب", "WhatsApp number")} value={whatsapp} />}
      </div>
      <div className="mt-3">
        <p className="mb-1 text-xs font-bold">{text("الوصف", "Description")}</p>
        <p className="whitespace-pre-line rounded-lg bg-card p-3 text-xs leading-6">
          {listing.description || "-"}
        </p>
      </div>
      {contentFlags.length > 0 && (
        <div className="mt-3 rounded-lg bg-warning/10 p-3 text-xs leading-6 text-foreground hairline">
          <p className="mb-1 font-bold">{text("أعلام السلامة", "Safety flags")}</p>
          <div className="flex flex-wrap gap-1.5">
            {contentFlags.map((flag) => (
              <span
                key={flag}
                className="rounded-md bg-card px-2 py-1 text-[10px] font-bold text-warning hairline"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3">
        <p className="mb-1 text-xs font-bold">{text("تفاصيل إضافية", "Additional details")}</p>
        {categoryRows.length === 0 && detailsEntries.length === 0 ? (
          <p className="rounded-lg bg-card p-3 text-xs text-muted-foreground">-</p>
        ) : (
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {categoryRows.map(([label, value]) => (
              <DetailItem key={label} label={label} value={value} />
            ))}
            {detailsEntries.map(([key, value]) => (
              <DetailItem key={key} label={key} value={safeDetailValue(value)} />
            ))}
          </dl>
        )}
      </div>
      <div className="mt-3">
        <p className="mb-1 text-xs font-bold">{text("الصور", "Images")}</p>
        {imagesLoading ? (
          <p className="rounded-lg bg-card p-3 text-xs text-muted-foreground">
            {text("جاري تحميل الصور", "Loading images")}
          </p>
        ) : images.length === 0 ? (
          <p className="rounded-lg bg-card p-3 text-xs text-muted-foreground">-</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {images
              .filter((image) => image.publicUrl)
              .map((image) => (
                <img
                  key={image.id}
                  src={image.publicUrl ?? ""}
                  alt={image.altAr ?? listing.title}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] rounded-lg object-cover hairline"
                />
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card px-3 py-2">
      <dt className="text-[10px] font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-xs font-bold text-foreground">{value}</dd>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function detailString(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" ? value : "";
}

function detailStringArray(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function safeDetailValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "-";
  }
}

function contactOptionsLabel(
  options: Record<string, boolean>,
  text: (ar: string, en: string) => string,
) {
  const labels = [
    options.phone ? text("هاتف", "Phone") : null,
    options.whatsapp ? text("واتساب", "WhatsApp") : null,
  ].filter(Boolean);
  return labels.length > 0 ? labels.join(" · ") : "-";
}

function formatDate(value: string, language: Language) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
