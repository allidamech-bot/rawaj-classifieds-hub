import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  deleteListingImage,
  deleteOwnerListing,
  fetchListingImages,
  fetchOwnerListingDetail,
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicSubcategories,
  resubmitOwnerListing,
  updateOwnerListing,
  uploadListingImage,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedSubcategory,
  ListingCondition,
  ListingImage,
  ListingStatus,
} from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";
import type { PriceType } from "@/types";

export const Route = createFileRoute("/profile/listings/$id")({
  head: () => ({ meta: [{ title: "تعديل الإعلان | رَوَاج" }] }),
  component: ManageListingPage,
});

function ManageListingPage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const navigate = Route.useNavigate();
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<ClassifiedsError | null>(null);
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [savingSuccess, setSavingSuccess] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [governorateId, setGovernorateId] = useState("");
  const [district, setDistrict] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("fixed");
  const [condition, setCondition] = useState<ListingCondition>("not_applicable");
  const [contactName, setContactName] = useState("");
  const [contact, setContact] = useState({ message: true, phone: true, whatsapp: false });

  const category = categories.find((item) => item.id === categoryId);
  const governorate = governorates.find((item) => item.id === governorateId);
  const currentSubcategories = useMemo(
    () => subcategories.filter((item) => item.categoryId === categoryId),
    [subcategories, categoryId],
  );

  const isEditable =
    listing?.status === "draft" ||
    listing?.status === "pending_review" ||
    listing?.status === "rejected";
  const isResubmittable = listing?.status === "draft" || listing?.status === "rejected";
  const isDeletable = listing?.status === "draft" || listing?.status === "rejected";

  useEffect(() => {
    if (auth.status !== "signedIn" || !auth.profile?.id) return;
    const profileId = auth.profile.id;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setSetupError(null);

      const [listingResult, refsResult] = await Promise.all([
        fetchOwnerListingDetail(profileId, id),
        Promise.all([
          fetchPublicCategories(),
          fetchPublicGovernorates(),
          fetchPublicSubcategories(),
        ]),
      ]);

      if (cancelled) return;
      if (!refsResult[0].ok) {
        setSetupError(refsResult[0].error);
        setLoading(false);
        return;
      }
      if (!refsResult[1].ok) {
        setSetupError(refsResult[1].error);
        setLoading(false);
        return;
      }
      if (!refsResult[2].ok) {
        setSetupError(refsResult[2].error);
        setLoading(false);
        return;
      }

      if (!listingResult.ok) {
        setSetupError(listingResult.error);
        setLoading(false);
        return;
      }

      setListing(listingResult.data);
      setCategories(refsResult[0].data);
      setGovernorates(refsResult[1].data);
      setSubcategories(refsResult[2].data);

      setTitle(listingResult.data.title);
      setDescription(listingResult.data.description);
      setCategoryId(listingResult.data.categoryId);
      setSubcategoryId(null);
      setGovernorateId(listingResult.data.governorateId);
      setDistrict(listingResult.data.districtAr ?? "");
      setPrice(listingResult.data.price?.toString() ?? "");
      setPriceType(listingResult.data.priceType);
      setCondition(listingResult.data.condition);
      setContactName(listingResult.data.contactName ?? "");
      setContact(
        Object.keys(listingResult.data.contactOptions || {}).length > 0
          ? {
              message: Boolean(listingResult.data.contactOptions.message),
              phone: Boolean(listingResult.data.contactOptions.phone),
              whatsapp: Boolean(listingResult.data.contactOptions.whatsapp),
            }
          : { message: true, phone: true, whatsapp: false },
      );

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [auth.status, id, auth.profile?.id]);

  async function loadImages() {
    if (!auth.profile?.id) return;
    setImagesLoading(true);
    const result = await fetchListingImages(id);
    if (result.ok) setImages(result.data);
    setImagesLoading(false);
  }

  const handleSave = useCallback(async () => {
    if (!listing || !isEditable) return;
    setSaving(true);
    setSavingError(null);
    setSavingSuccess(null);

    const result = await updateOwnerListing(auth.profile?.id ?? null, listing.id, {
      categoryId: categoryId || undefined,
      subcategoryId: subcategoryId ?? null,
      governorateId: governorateId || undefined,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      price: price ? Number(price) : null,
      priceType,
      condition,
      districtAr: district || undefined,
      contactName: contactName.trim() || undefined,
      contactOptions: contact,
    });

    setSaving(false);
    if (result.ok) {
      setListing(result.data);
      setSavingSuccess(text("تم حفظ التعديلات.", "Changes saved."));
    } else {
      setSavingError(result.error.message);
    }
  }, [
    listing,
    isEditable,
    auth.profile?.id,
    categoryId,
    subcategoryId,
    governorateId,
    title,
    description,
    price,
    priceType,
    condition,
    district,
    contactName,
    contact,
    text,
  ]);

  const handleResubmit = useCallback(async () => {
    if (!listing || !isResubmittable) return;
    setResubmitting(true);
    setSavingError(null);
    setSavingSuccess(null);

    const result = await resubmitOwnerListing(auth.profile?.id ?? null, listing.id, {
      categoryId: categoryId || undefined,
      subcategoryId: subcategoryId ?? null,
      governorateId: governorateId || undefined,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      price: price ? Number(price) : null,
      priceType,
      condition,
      districtAr: district || undefined,
      contactName: contactName.trim() || undefined,
      contactOptions: contact,
    });

    setResubmitting(false);
    if (result.ok) {
      setListing(result.data);
      setSavingSuccess(text("تم إعادة إرسال الإعلان للمراجعة.", "Listing resubmitted for review."));
    } else {
      setSavingError(result.error.message);
    }
  }, [
    listing,
    isResubmittable,
    auth.profile?.id,
    categoryId,
    subcategoryId,
    governorateId,
    title,
    description,
    price,
    priceType,
    condition,
    district,
    contactName,
    contact,
    text,
  ]);

  const handleDelete = useCallback(async () => {
    if (!listing || !isDeletable) return;
    if (!confirm(text("حذف الإعلان نهائياً؟", "Delete this listing permanently?"))) return;

    setDeleting(true);
    const result = await deleteOwnerListing(auth.profile?.id ?? null, listing.id);
    setDeleting(false);
    if (result.ok) {
      void navigate({ to: "/profile" });
    } else {
      setSavingError(result.error.message);
    }
  }, [listing, isDeletable, auth.profile?.id, navigate, text]);

  useEffect(() => {
    if (!listing) return;
    void loadImages();
  }, [listing]);

  async function handleUploadImages() {
    if (!listing || selectedImages.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const errors: string[] = [];
    for (const file of selectedImages) {
      const result = await uploadListingImage({
        userId: auth.profile?.id ?? null,
        listing,
        file,
        sortOrder: images.length,
        altAr: title.trim() || listing.title,
      });
      if (!result.ok) errors.push(result.error.message);
      else if (result.data) setImages((value) => [...value, result.data]);
    }
    setSelectedImages([]);
    setUploading(false);
    if (errors.length > 0) setUploadError(errors[0]);
  }

  function handleDeleteImage(image: ListingImage) {
    void (async () => {
      setImagesLoading(true);
      const result = await deleteListingImage(auth.profile?.id ?? null, listing!.id, image);
      setImagesLoading(false);
      if (result.ok) {
        setImages((value) => value.filter((item) => item.id !== image.id));
      } else {
        setUploadError(result.error.message);
      }
    })();
  }

  if (loading) {
    return (
      <>
        <PageHeader title={text("تعديل الإعلان", "Edit listing")} />
        <main className="container-wide pt-10">
          <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground hairline">
            {text("جارٍ تحميل بيانات الإعلان.", "Loading listing data.")}
          </div>
        </main>
      </>
    );
  }

  if (setupError || !listing) {
    return (
      <>
        <PageHeader title={text("تعديل الإعلان", "Edit listing")} />
        <main className="container-wide pt-10">
          <div className="rounded-2xl bg-card p-10 text-center hairline">
            <p className="text-sm font-semibold text-foreground">
              {text("الإعلان غير متاح", "Listing unavailable")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {setupError?.message ??
                text("تعذر تحميل هذا الإعلان.", "Could not load this listing.")}
            </p>
            <Link
              to="/profile"
              className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              {text("العودة لحسابي", "Back to my account")}
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("تعديل الإعلان", "Edit listing")} back to="/profile" />
      <main className="container-wide pt-4 pb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline">
              {statusLabel(listing.status, language)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/listings/$id"
              params={{ id: listing.id }}
              className="inline-flex items-center gap-1 rounded-xl bg-card px-3 py-2 text-[11px] font-bold hairline transition hover:bg-secondary"
            >
              {text("عرض العام", "View public")}
            </Link>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1 rounded-xl bg-muted-surface px-3 py-2 text-[11px] font-bold transition hover:bg-secondary"
            >
              {text("إعلاناتي", "My listings")}
            </Link>
          </div>
        </div>

        {listing.rejectionReason && (
          <p className="mb-4 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
            {listing.rejectionReason}
          </p>
        )}

        {savingSuccess && (
          <p className="mb-4 rounded-xl bg-emerald-trust/10 p-3 text-center text-xs font-bold text-emerald-trust hairline">
            {savingSuccess}
          </p>
        )}
        {savingError && (
          <p className="mb-4 rounded-xl bg-destructive/10 p-3 text-center text-xs font-bold text-destructive hairline">
            {savingError}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <section className="rounded-2xl bg-card p-4 hairline shadow-soft">
              <h3 className="mb-3 text-sm font-extrabold">
                {text("تفاصيل الإعلان", "Listing details")}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={text("عنوان الإعلان", "Listing title")}>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input"
                    disabled={!isEditable}
                  />
                </Field>
                <Field label={text("الحالة", "Condition")}>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ListingCondition)}
                    className="input"
                    disabled={!isEditable}
                  >
                    <option value="not_applicable">{text("غير محدد", "Not specified")}</option>
                    <option value="new">{text("جديد", "New")}</option>
                    <option value="like_new">{text("شبه جديد", "Like new")}</option>
                    <option value="used">{text("مستعمل", "Used")}</option>
                    <option value="for_parts">{text("للقطع", "For parts")}</option>
                  </select>
                </Field>
              </div>
              <Field label={text("الوصف", "Description")} className="mt-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="input resize-none"
                  disabled={!isEditable}
                />
              </Field>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={text("السعر", "Price")}>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    type="number"
                    className="input"
                    disabled={!isEditable}
                  />
                </Field>
                <Field label={text("نوع السعر", "Price type")}>
                  <select
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value as PriceType)}
                    className="input"
                    disabled={!isEditable}
                  >
                    <option value="fixed">{text("ثابت", "Fixed")}</option>
                    <option value="negotiable">{text("قابل للتفاوض", "Negotiable")}</option>
                    <option value="contact">{text("عند التواصل", "On contact")}</option>
                    <option value="free">{text("مجاني", "Free")}</option>
                    <option value="exchange">{text("للمبادلة", "Exchange")}</option>
                  </select>
                </Field>
              </div>
            </section>

            <section className="rounded-2xl bg-card p-4 hairline shadow-soft">
              <h3 className="mb-3 text-sm font-extrabold">{text("الموقع", "Location")}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={text("القسم", "Category")}>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSubcategoryId(null);
                    }}
                    className="input"
                    disabled={!isEditable}
                  >
                    <option value="">{text("اختر", "Choose")}</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {categoryName(item.id, item.nameAr, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={text("القسم الفرعي", "Subcategory")}>
                  <select
                    value={subcategoryId ?? ""}
                    onChange={(e) => setSubcategoryId(e.target.value || null)}
                    className="input"
                    disabled={!isEditable || !categoryId}
                  >
                    <option value="">{text("اختر", "Choose")}</option>
                    {currentSubcategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nameAr}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={text("المحافظة", "Governorate")}>
                  <select
                    value={governorateId}
                    onChange={(e) => {
                      setGovernorateId(e.target.value);
                      setDistrict("");
                    }}
                    className="input"
                    disabled={!isEditable}
                  >
                    <option value="">{text("اختر", "Choose")}</option>
                    {governorates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {governorateName(item.id, item.nameAr, language)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={text("المنطقة", "District")}>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    disabled={!isEditable || !governorate}
                    className="input disabled:opacity-50"
                  >
                    <option value="">{text("اختر", "Choose")}</option>
                    {governorate?.districtsAr.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            <section className="rounded-2xl bg-card p-4 hairline shadow-soft">
              <h3 className="mb-3 text-sm font-extrabold">
                {text("طريقة التواصل", "Contact method")}
              </h3>
              <Field label={text("اسم التواصل", "Contact name")}>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="input"
                  disabled={!isEditable}
                />
              </Field>
              <div className="mt-3 space-y-2">
                {[
                  { key: "message", label: text("رسائل داخل التطبيق", "In-app messages") },
                  { key: "phone", label: text("اتصال هاتفي", "Phone call") },
                  { key: "whatsapp", label: text("واتساب", "WhatsApp") },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between rounded-xl bg-card p-3 hairline"
                  >
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {text(
                          "تُستخدم وفق إعدادات الخصوصية والمراجعة.",
                          "Used according to privacy and review settings.",
                        )}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={contact[item.key as keyof typeof contact]}
                      onChange={(e) =>
                        setContact((value) => ({ ...value, [item.key]: e.target.checked }))
                      }
                      disabled={!isEditable}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-2xl bg-card p-4 hairline shadow-soft">
              <h3 className="mb-3 text-sm font-extrabold">
                {text("صور الإعلان", "Listing photos")}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {images.map((image) => (
                  <div key={image.id} className="relative rounded-xl bg-muted-surface p-1">
                    {image.publicUrl ? (
                      <img
                        src={image.publicUrl}
                        alt={image.altAr ?? listing.title}
                        className="aspect-[4/3] w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="aspect-[4/3] w-full rounded-lg bg-card" />
                    )}
                    {isEditable && (
                      <button
                        type="button"
                        disabled={imagesLoading}
                        onClick={() => handleDeleteImage(image)}
                        className="absolute top-1 end-1 grid h-7 w-7 place-items-center rounded-full bg-destructive/90 text-destructive-foreground transition hover:bg-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {isEditable && (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl bg-muted-surface p-4 text-center text-muted-foreground">
                    <Camera className="h-6 w-6" />
                    <span className="mt-1 text-[10px] font-bold">
                      {text("إضافة صورة", "Add photo")}
                    </span>
                    <span className="text-[9px]">
                      {text("JPG · PNG · WebP · 5MB", "JPG · PNG · WebP · 5MB")}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) =>
                        setSelectedImages(Array.from(e.target.files ?? []).slice(0, 6))
                      }
                    />
                  </label>
                )}
              </div>
              {selectedImages.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold">
                    {text("صور مختارة", "Selected photos")} ({selectedImages.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedImages.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${index}`}
                        className="rounded-lg bg-card p-2 text-[10px]"
                      >
                        <p className="truncate font-bold">{file.name}</p>
                        <p className="text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={handleUploadImages}
                      className="rounded-lg bg-primary px-3 py-2 text-[10px] font-bold text-primary-foreground disabled:opacity-50"
                    >
                      {uploading
                        ? text("جارٍ الرفع...", "Uploading...")
                        : text("رفع الصور", "Upload photos")}
                    </button>
                  </div>
                </div>
              )}
              {uploadError && <p className="mt-2 text-[10px] text-destructive">{uploadError}</p>}
            </section>
          </div>

          <aside className="space-y-3">
            <section className="rounded-2xl bg-card p-4 hairline shadow-soft">
              <h3 className="mb-2 text-sm font-extrabold">{text("إجراءات", "Actions")}</h3>
              <div className="space-y-2">
                {isEditable && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="w-full rounded-xl bg-emerald-trust px-3 py-2.5 text-xs font-bold text-emerald-trust-foreground disabled:opacity-50"
                  >
                    {saving
                      ? text("جارٍ الحفظ...", "Saving...")
                      : text("حفظ التعديلات", "Save changes")}
                  </button>
                )}
                {isResubmittable && (
                  <button
                    type="button"
                    disabled={resubmitting}
                    onClick={handleResubmit}
                    className="w-full rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {resubmitting
                      ? text("جارٍ الإرسال...", "Submitting...")
                      : text("إعادة إرسال للمراجعة", "Resubmit for review")}
                  </button>
                )}
                {isDeletable && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleDelete}
                    className="w-full rounded-xl bg-card px-3 py-2.5 text-xs font-bold text-destructive hairline transition hover:bg-destructive/5 disabled:opacity-50"
                  >
                    {deleting
                      ? text("جارٍ الحذف...", "Deleting...")
                      : text("حذف الإعلان", "Delete listing")}
                  </button>
                )}
                {listing.status === "approved" && (
                  <p className="rounded-xl bg-muted-surface p-3 text-[11px] text-muted-foreground">
                    {text(
                      "لا يمكن تعديل إعلان معتمد حالياً.",
                      "Approved listings cannot be edited currently.",
                    )}
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-2xl bg-card p-4 hairline">
              <h3 className="mb-2 text-sm font-extrabold">{text("معلومات", "Info")}</h3>
              <dl className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{text("رقم الإعلان", "Listing ID")}</dt>
                  <dd className="font-mono font-semibold">{listing.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{text("أنشئ", "Created")}</dt>
                  <dd className="font-semibold">
                    {new Date(listing.createdAt).toLocaleDateString(
                      language === "ar" ? "ar-SY" : "en-US",
                      {
                        dateStyle: "short",
                      },
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">{text("محدث", "Updated")}</dt>
                  <dd className="font-semibold">
                    {new Date(listing.updatedAt).toLocaleDateString(
                      language === "ar" ? "ar-SY" : "en-US",
                      {
                        dateStyle: "short",
                      },
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </main>
      <style>{`.input{width:100%;border-radius:.75rem;background:var(--card);border:1px solid var(--border);padding:.625rem .75rem;font-size:.875rem;color:var(--foreground);outline:none}.input:focus{border-color:var(--ring)}`}</style>
    </>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`mb-3 block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function statusLabel(status: ListingStatus, language: Language) {
  switch (status) {
    case "draft":
      return language === "ar" ? "مسودة" : "Draft";
    case "pending_review":
      return language === "ar" ? "قيد المراجعة" : "Pending review";
    case "approved":
      return language === "ar" ? "إعلان معتمد" : "Approved listing";
    case "rejected":
      return language === "ar" ? "مرفوض" : "Rejected";
    case "archived":
      return language === "ar" ? "مؤرشف" : "Archived";
    case "expired":
      return language === "ar" ? "منتهي" : "Expired";
    default:
      return status;
  }
}
