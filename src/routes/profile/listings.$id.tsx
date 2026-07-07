import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  ListingStudioMessage,
  ListingStudioSection,
} from "@/features/listing-studio/listing-studio";
import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";
import {
  detectCategoryFieldKind,
  mergeCategoryDetails,
  readCategoryDetails,
  type CategoryFieldKind,
  type CategorySpecificDetails,
} from "@/lib/category-fields";
import {
  checkListingContentSafety,
  isSafePhoneValue,
  normalizeContactValue,
} from "@/lib/content-safety";
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
} from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { fetchListingLocationNodeId } from "@/lib/api/listing-location-read";
import { listingStatusLabel } from "@/lib/status-labels";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";
import type { PriceType } from "@/types";

export const Route = createFileRoute("/profile/listings/$id")({
  head: () => ({
    meta: [{ title: "تعديل الإعلان | رَوَاج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
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
  const [locationNodeId, setLocationNodeId] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("fixed");
  const [condition, setCondition] = useState<ListingCondition>("not_applicable");
  const [contactName, setContactName] = useState("");
  const [contact, setContact] = useState({ phone: true, whatsapp: false });
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [categoryDetails, setCategoryDetails] = useState<CategorySpecificDetails>({});

  const category = categories.find((item) => item.id === categoryId);
  const categoryFieldKind = detectCategoryFieldKind(category, listing);
  const governorate = governorates.find((item) => item.id === governorateId);
  const currentSubcategories = useMemo(
    () => subcategories.filter((item) => item.categoryId === categoryId),
    [subcategories, categoryId],
  );
  const selectedImagePreviews = useMemo(
    () =>
      selectedImages.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        url: URL.createObjectURL(file),
      })),
    [selectedImages],
  );

  const isEditable = listing?.status === "draft" || listing?.status === "rejected";
  const isPendingReview = listing?.status === "pending_review";
  const isResubmittable = listing?.status === "draft" || listing?.status === "rejected";
  const isDeletable = listing?.status === "draft" || listing?.status === "rejected";

  useEffect(() => {
    if (auth.status !== "signedIn" || !auth.profile?.id) return;
    const profileId = auth.profile.id;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setSetupError(null);

      const [listingResult, locationResult, refsResult] = await Promise.all([
        fetchOwnerListingDetail(profileId, id),
        fetchListingLocationNodeId(profileId, id),
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
      setSubcategoryId(listingResult.data.subcategoryId);
      setGovernorateId(listingResult.data.governorateId);
      setDistrict(listingResult.data.districtAr ?? "");
      setLocationNodeId(locationResult.ok ? (locationResult.data ?? "") : "");
      setPrice(listingResult.data.price?.toString() ?? "");
      setPriceType(listingResult.data.priceType);
      setCondition(listingResult.data.condition);
      setContactName(listingResult.data.contactName ?? "");
      setPhone(readDetailString(listingResult.data.details, "phone"));
      setWhatsapp(readDetailString(listingResult.data.details, "whatsapp"));
      setCategoryDetails(readCategoryDetails(listingResult.data.details));
      setContact(
        Object.keys(listingResult.data.contactOptions || {}).length > 0
          ? {
              phone: Boolean(listingResult.data.contactOptions.phone),
              whatsapp: Boolean(listingResult.data.contactOptions.whatsapp),
            }
          : { phone: true, whatsapp: false },
      );

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [auth.status, id, auth.profile?.id]);

  useEffect(
    () => () => {
      selectedImagePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [selectedImagePreviews],
  );

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

    const validation = validateContactAndContent({
      title,
      description,
      contactName,
      contact,
      phone,
      whatsapp,
      categoryKind: categoryFieldKind,
      categoryDetails,
      existingDetails: listing.details,
      text,
    });
    if (!validation.ok) {
      setSaving(false);
      setSavingError(validation.message);
      return;
    }

    const result = await updateOwnerListing(auth.profile?.id ?? null, listing.id, {
      categoryId: categoryId || undefined,
      subcategoryId: subcategoryId ?? null,
      governorateId: governorateId || undefined,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      price: price ? Number(price) : null,
      priceType,
      condition,
      districtAr: locationNodeId ? `@${locationNodeId}` : district || undefined,
      contactName: contactName.trim() || undefined,
      contactOptions: contact,
      details: validation.details,
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
    locationNodeId,
    contactName,
    contact,
    phone,
    whatsapp,
    categoryFieldKind,
    categoryDetails,
    text,
  ]);

  const handleResubmit = useCallback(async () => {
    if (!listing || !isResubmittable) return;
    setResubmitting(true);
    setSavingError(null);
    setSavingSuccess(null);

    const validation = validateContactAndContent({
      title,
      description,
      contactName,
      contact,
      phone,
      whatsapp,
      categoryKind: categoryFieldKind,
      categoryDetails,
      existingDetails: listing.details,
      text,
    });
    if (!validation.ok) {
      setResubmitting(false);
      setSavingError(validation.message);
      return;
    }

    const result = await resubmitOwnerListing(auth.profile?.id ?? null, listing.id, {
      categoryId: categoryId || undefined,
      subcategoryId: subcategoryId ?? null,
      governorateId: governorateId || undefined,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      price: price ? Number(price) : null,
      priceType,
      condition,
      districtAr: locationNodeId ? `@${locationNodeId}` : district || undefined,
      contactName: contactName.trim() || undefined,
      contactOptions: contact,
      details: validation.details,
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
    locationNodeId,
    contactName,
    contact,
    phone,
    whatsapp,
    categoryFieldKind,
    categoryDetails,
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
    for (const [index, file] of selectedImages.entries()) {
      const result = await uploadListingImage({
        userId: auth.profile?.id ?? null,
        listing,
        file,
        sortOrder: images.length + index,
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
        <main className="container-wide mobile-page-bottom pt-10">
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
        <main className="container-wide mobile-page-bottom pt-10">
          <div className="rawaj-surface rounded-[1.5rem] p-10 text-center">
            <p className="text-sm font-semibold text-foreground">
              {text("الإعلان غير متاح", "Listing unavailable")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {setupError?.message ??
                text("تعذر تحميل هذا الإعلان.", "Could not load this listing.")}
            </p>
            <Link to="/profile" className="rawaj-button-primary mt-4 px-4 py-2">
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
      <main className="container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">
        <div className="rawaj-hero-surface mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[1.45rem] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rawaj-chip border-primary/10 bg-card/80 px-2.5 py-1 text-primary">
              {listingStatusLabel(listing.status, language, true)}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/listings/$id"
              params={{ id: listing.id }}
              className="rawaj-chip px-3 py-2 font-semibold text-primary transition hover:border-gold/40"
            >
              {text("عرض العام", "View public")}
            </Link>
            <Link
              to="/profile"
              className="rawaj-chip bg-card-warm/75 px-3 py-2 font-semibold text-muted-foreground transition hover:border-gold/40 hover:text-primary"
            >
              {text("إعلاناتي", "My listings")}
            </Link>
          </div>
        </div>

        {isPendingReview && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "هذا الإعلان قيد المراجعة ولا يمكن تعديله حتى قرار الإدارة. يمكنك حذفه فقط أو إعادة إرساله بعد الرفض.",
                "This listing is under review and cannot be edited until the admin decision. You can only delete it or resubmit it if rejected.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.rejectionReason && (
          <div className="mb-4">
            <ListingStudioMessage tone="danger">{listing.rejectionReason}</ListingStudioMessage>
          </div>
        )}

        {savingSuccess && (
          <div className="mb-4">
            <ListingStudioMessage tone="success">{savingSuccess}</ListingStudioMessage>
          </div>
        )}
        {savingError && (
          <div className="mb-4">
            <ListingStudioMessage tone="danger">{savingError}</ListingStudioMessage>
          </div>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
          <div className="space-y-4">
            <ListingStudioSection title={text("ماذا تبيع؟", "What are you selling?")}>
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
              <CategorySpecificFields
                kind={categoryFieldKind}
                values={categoryDetails}
                disabled={!isEditable}
                onChange={setCategoryDetails}
                text={text}
              />
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
            </ListingStudioSection>

            <ListingStudioSection title={text("القسم والموقع", "Category and location")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={text("القسم", "Category")}>
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setSubcategoryId(null);
                      setCategoryDetails({});
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
              <div className="mt-3">
                <Field label={text("الموقع", "Location")}>
                  <CanonicalLocationSelector
                    value={locationNodeId || null}
                    disabled={!isEditable}
                    onChange={(id, node) => {
                      setLocationNodeId(id ?? "");
                      if (node?.legacyGovernorateId) {
                        setGovernorateId(node.legacyGovernorateId);
                      }
                      setDistrict(node?.legacyDistrictAr ?? "");
                    }}
                  />
                </Field>
                {!locationNodeId && district ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {text("الموقع القديم المحفوظ: ", "Saved legacy location: ")}
                    {district}
                  </p>
                ) : null}
              </div>
            </ListingStudioSection>

            <ListingStudioSection title={text("التواصل", "Contact")}>
              <Field label={text("اسم التواصل", "Contact name")}>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="input"
                  disabled={!isEditable}
                />
              </Field>
              {contact.phone && (
                <Field label={text("رقم الهاتف", "Phone number")}>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    className="input"
                    disabled={!isEditable}
                    placeholder="+963 ..."
                  />
                </Field>
              )}
              {contact.whatsapp && (
                <Field label={text("رقم واتساب", "WhatsApp number")}>
                  <input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    className="input"
                    disabled={!isEditable}
                    placeholder="+963 ..."
                  />
                </Field>
              )}
              <div className="mt-3 space-y-2">
                {[
                  { key: "phone" as const, label: text("اتصال هاتفي", "Phone call") },
                  { key: "whatsapp" as const, label: text("واتساب", "WhatsApp") },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between rounded-[1rem] border border-border/70 bg-card/80 p-3.5 transition hover:border-gold/35"
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
                      checked={contact[item.key]}
                      onChange={(e) =>
                        setContact((value) => {
                          if (item.key === "phone" && !e.target.checked) setPhone("");
                          if (item.key === "whatsapp" && !e.target.checked) setWhatsapp("");
                          return { ...value, [item.key]: e.target.checked };
                        })
                      }
                      disabled={!isEditable}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                ))}
              </div>
            </ListingStudioSection>

            <ListingStudioSection title={text("الصور والتفاصيل", "Photos and details")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative overflow-hidden rounded-[1.05rem] border border-border/70 bg-card p-1 shadow-soft"
                  >
                    {image.publicUrl ? (
                      <img
                        src={image.publicUrl}
                        alt={image.altAr ?? listing.title}
                        loading="lazy"
                        decoding="async"
                        className="aspect-[4/3] w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="aspect-[4/3] w-full rounded-lg bg-card" />
                    )}
                    {index === 0 && (
                      <span className="absolute start-2 top-2 rounded-full bg-primary/90 px-2.5 py-1 text-[9px] font-semibold text-primary-foreground shadow-soft backdrop-blur">
                        {text("الصورة الرئيسية", "Primary")}
                      </span>
                    )}
                    {isEditable && (
                      <button
                        type="button"
                        disabled={imagesLoading || uploading}
                        onClick={() => handleDeleteImage(image)}
                        className="absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-destructive shadow-soft backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground"
                        aria-label={text("حذف الصورة", "Delete photo")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {isEditable && (
                  <label className="group flex cursor-pointer flex-col items-center justify-center rounded-[1.1rem] border border-dashed border-border bg-card-warm/65 p-5 text-center text-muted-foreground transition hover:border-brand-orange/45 hover:bg-card">
                    <Camera className="h-6 w-6" />
                    <span className="mt-1 text-[10px] font-bold">
                      {text("إضافة صور", "Add photos")}
                    </span>
                    <span className="text-[9px]">
                      {text("JPG · PNG · WebP · 5MB", "JPG · PNG · WebP · 5MB")}
                    </span>
                    <input
                      type="file"
                      multiple
                      disabled={uploading || imagesLoading}
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold">
                      {text("صور مختارة", "Selected photos")} ({selectedImages.length})
                    </p>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => setSelectedImages([])}
                      className="rawaj-chip px-3 py-1.5 font-semibold text-muted-foreground disabled:opacity-50"
                    >
                      {text("تفريغ الاختيار", "Clear selection")}
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selectedImagePreviews.map((preview, index) => (
                      <div
                        key={preview.id}
                        className="overflow-hidden rounded-[1rem] border border-border/70 bg-card text-[10px] shadow-soft"
                      >
                        <img
                          src={preview.url}
                          alt={preview.file.name}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[4/3] w-full object-cover"
                        />
                        <div className="p-2">
                          <p className="truncate font-bold">{preview.file.name}</p>
                          <p className="text-muted-foreground">
                            {(preview.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                          {index === 0 && (
                            <p className="mt-1 font-bold text-gold">
                              {text("ستظهر أولاً بعد الرفع", "Will appear first after upload")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={uploading || imagesLoading}
                      onClick={handleUploadImages}
                      className="rawaj-button-primary rounded-[0.9rem] px-3 py-2 text-[10px] disabled:opacity-50"
                    >
                      {uploading
                        ? text("جارٍ الرفع...", "Uploading...")
                        : text("رفع الصور", "Upload photos")}
                    </button>
                  </div>
                </div>
              )}
              {uploadError && (
                <div className="mt-2">
                  <ListingStudioMessage tone="danger">{uploadError}</ListingStudioMessage>
                </div>
              )}
            </ListingStudioSection>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24">
            <ListingStudioSection title={text("إجراءات", "Actions")}>
              <div className="space-y-2">
                {isEditable && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="w-full rounded-[1rem] bg-emerald-trust px-3 py-3 text-xs font-semibold text-emerald-trust-foreground shadow-soft transition hover:brightness-[0.98] disabled:opacity-50"
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
                    className="rawaj-button-primary w-full rounded-[1rem] px-3 py-3 disabled:opacity-50"
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
                    className="w-full rounded-[1rem] border border-destructive/15 bg-card/80 px-3 py-3 text-xs font-semibold text-destructive transition hover:bg-destructive/5 disabled:opacity-50"
                  >
                    {deleting
                      ? text("جارٍ الحذف...", "Deleting...")
                      : text("حذف الإعلان", "Delete listing")}
                  </button>
                )}
                {listing.status === "approved" && (
                  <p className="rounded-[1rem] border border-border/65 bg-card-warm/65 p-3.5 text-[11px] leading-5 text-muted-foreground">
                    {text(
                      "لا يمكن تعديل إعلان معتمد حالياً.",
                      "Approved listings cannot be edited currently.",
                    )}
                  </p>
                )}
              </div>
            </ListingStudioSection>
            <ListingStudioSection title={text("معلومات", "Info")}>
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
            </ListingStudioSection>
          </aside>
        </div>
      </main>
      <style>{`.input{width:100%;min-height:2.75rem;border-radius:1rem;background:color-mix(in srgb,var(--card) 88%,transparent);border:1px solid var(--border);padding:.68rem .8rem;font-size:.875rem;color:var(--foreground);outline:none;transition:border-color .18s ease,box-shadow .18s ease,background .18s ease}.input:focus{border-color:var(--brand-orange);background:var(--card);box-shadow:0 0 0 3px color-mix(in srgb,var(--brand-orange) 12%,transparent)}.input:disabled{opacity:.62;cursor:not-allowed}`}</style>
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
      <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CategorySpecificFields({
  kind,
  values,
  disabled,
  onChange,
  text,
}: {
  kind: CategoryFieldKind;
  values: CategorySpecificDetails;
  disabled: boolean;
  onChange: (value: CategorySpecificDetails) => void;
  text: (ar: string, en: string) => string;
}) {
  const patch = (next: Partial<CategorySpecificDetails>) => onChange({ ...values, ...next });

  if (kind === "real_estate") {
    return (
      <div className="mt-4 rounded-[1.15rem] border border-border/60 bg-card-warm/65 p-3.5">
        <h4 className="mb-3 text-xs font-semibold text-primary">
          {text("تفاصيل العقار", "Real estate details")}
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={text("نوع العقار", "Property type")}>
            <select
              disabled={disabled}
              value={values.property_type ?? ""}
              onChange={(event) => patch({ property_type: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="apartment">{text("شقة", "Apartment")}</option>
              <option value="house">{text("منزل", "House")}</option>
              <option value="villa">{text("فيلا", "Villa")}</option>
              <option value="land">{text("أرض", "Land")}</option>
              <option value="shop">{text("محل", "Shop")}</option>
              <option value="office">{text("مكتب", "Office")}</option>
              <option value="warehouse">{text("مستودع", "Warehouse")}</option>
              <option value="other">{text("أخرى", "Other")}</option>
            </select>
          </Field>
          <Field label={text("الغرض", "Purpose")}>
            <select
              disabled={disabled}
              value={values.listing_purpose ?? ""}
              onChange={(event) => patch({ listing_purpose: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="sale">{text("بيع", "Sale")}</option>
              <option value="rent">{text("إيجار", "Rent")}</option>
            </select>
          </Field>
          <NumberField
            label={text("غرف النوم", "Bedrooms")}
            value={values.bedrooms}
            disabled={disabled}
            onChange={(bedrooms) => patch({ bedrooms })}
            min={0}
            max={30}
          />
          <NumberField
            label={text("الحمامات", "Bathrooms")}
            value={values.bathrooms}
            disabled={disabled}
            onChange={(bathrooms) => patch({ bathrooms })}
            min={0}
            max={30}
          />
          <NumberField
            label={text("المساحة م²", "Area sqm")}
            value={values.area_sqm}
            disabled={disabled}
            onChange={(area_sqm) => patch({ area_sqm })}
            min={1}
            max={100000}
          />
          <NumberField
            label={text("الطابق", "Floor")}
            value={values.floor}
            disabled={disabled}
            onChange={(floor) => patch({ floor })}
            min={-5}
            max={200}
          />
          <CheckboxField
            label={text("مفروش", "Furnished")}
            checked={values.furnished ?? false}
            disabled={disabled}
            onChange={(furnished) => patch({ furnished })}
          />
          <CheckboxField
            label={text("موقف سيارة", "Parking")}
            checked={values.parking ?? false}
            disabled={disabled}
            onChange={(parking) => patch({ parking })}
          />
        </div>
      </div>
    );
  }

  if (kind === "vehicles") {
    return (
      <div className="mt-4 rounded-[1.15rem] border border-border/60 bg-card-warm/65 p-3.5">
        <h4 className="mb-3 text-xs font-semibold text-primary">
          {text("تفاصيل السيارة", "Vehicle details")}
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={text("الشركة", "Make")}>
            <input
              disabled={disabled}
              value={values.make ?? ""}
              onChange={(event) => patch({ make: event.target.value })}
              maxLength={60}
              className="input"
            />
          </Field>
          <Field label={text("الطراز", "Model")}>
            <input
              disabled={disabled}
              value={values.model ?? ""}
              onChange={(event) => patch({ model: event.target.value })}
              maxLength={60}
              className="input"
            />
          </Field>
          <NumberField
            label={text("السنة", "Year")}
            value={values.year}
            disabled={disabled}
            onChange={(year) => patch({ year })}
            min={1900}
            max={new Date().getFullYear() + 1}
          />
          <NumberField
            label={text("المسافة كم", "Mileage km")}
            value={values.mileage_km}
            disabled={disabled}
            onChange={(mileage_km) => patch({ mileage_km })}
            min={0}
            max={2000000}
          />
          <Field label={text("الوقود", "Fuel")}>
            <select
              disabled={disabled}
              value={values.fuel_type ?? ""}
              onChange={(event) => patch({ fuel_type: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="gasoline">{text("بنزين", "Gasoline")}</option>
              <option value="diesel">{text("ديزل", "Diesel")}</option>
              <option value="hybrid">{text("هايبرد", "Hybrid")}</option>
              <option value="electric">{text("كهرباء", "Electric")}</option>
              <option value="other">{text("أخرى", "Other")}</option>
            </select>
          </Field>
          <Field label={text("ناقل الحركة", "Transmission")}>
            <select
              disabled={disabled}
              value={values.transmission ?? ""}
              onChange={(event) => patch({ transmission: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="automatic">{text("أوتوماتيك", "Automatic")}</option>
              <option value="manual">{text("يدوي", "Manual")}</option>
            </select>
          </Field>
          <Field label={text("حالة السيارة", "Vehicle condition")}>
            <select
              disabled={disabled}
              value={values.vehicle_condition ?? ""}
              onChange={(event) => patch({ vehicle_condition: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="new">{text("جديدة", "New")}</option>
              <option value="used">{text("مستعملة", "Used")}</option>
            </select>
          </Field>
          <Field label={text("اللون", "Color")}>
            <input
              disabled={disabled}
              value={values.color ?? ""}
              onChange={(event) => patch({ color: event.target.value })}
              maxLength={40}
              className="input"
            />
          </Field>
        </div>
      </div>
    );
  }

  return null;
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
  min,
  max,
}: {
  label: string;
  value?: number;
  disabled: boolean;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
}) {
  return (
    <Field label={label}>
      <input
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : undefined)}
        type="number"
        min={min}
        max={max}
        className="input"
      />
    </Field>
  );
}

function CheckboxField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-[1rem] border border-border/70 bg-card/80 px-3 py-2.5 text-xs font-semibold">
      {label}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    </label>
  );
}

function readDetailString(details: Record<string, unknown>, key: string) {
  const value = details[key];
  return typeof value === "string" ? value : "";
}

function validateContactAndContent({
  title,
  description,
  contactName,
  contact,
  phone,
  whatsapp,
  categoryKind,
  categoryDetails,
  existingDetails,
  text,
}: {
  title: string;
  description: string;
  contactName: string;
  contact: Record<"phone" | "whatsapp", boolean>;
  phone: string;
  whatsapp: string;
  categoryKind: CategoryFieldKind;
  categoryDetails: CategorySpecificDetails;
  existingDetails: Record<string, unknown>;
  text: (ar: string, en: string) => string;
}): { ok: true; details: Record<string, unknown> } | { ok: false; message: string } {
  const normalizedPhone = normalizeContactValue(phone);
  const normalizedWhatsapp = normalizeContactValue(whatsapp);

  if (contact.phone && !isSafePhoneValue(normalizedPhone)) {
    return {
      ok: false,
      message: text(
        "أدخل رقم هاتف صالحا قبل حفظ الإعلان.",
        "Enter a valid phone number before saving.",
      ),
    };
  }

  if (contact.whatsapp && !isSafePhoneValue(normalizedWhatsapp)) {
    return {
      ok: false,
      message: text(
        "أدخل رقم واتساب صالحا قبل حفظ الإعلان.",
        "Enter a valid WhatsApp number before saving.",
      ),
    };
  }

  const contentCheck = checkListingContentSafety([
    title,
    description,
    contactName,
    existingDetails,
  ]);
  if (contentCheck.blocked) {
    return {
      ok: false,
      message:
        contentCheck.messageAr ??
        text("راجع نص الإعلان قبل الحفظ.", "Review the listing text before saving."),
    };
  }

  const details = { ...existingDetails };
  delete details.phone;
  delete details.whatsapp;
  delete details.content_flags;

  if (contact.phone) details.phone = normalizedPhone;
  if (contact.whatsapp) details.whatsapp = normalizedWhatsapp;
  if (contentCheck.flags.length > 0) details.content_flags = contentCheck.flags;

  return { ok: true, details: mergeCategoryDetails(details, categoryKind, categoryDetails) };
}
