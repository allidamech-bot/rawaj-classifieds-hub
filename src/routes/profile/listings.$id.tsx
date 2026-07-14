import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Camera, RefreshCw, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  ListingStudioCompletionCard,
  ListingStudioHero,
  ListingStudioMessage,
  ListingStudioPreview,
  ListingStudioQualityPanel,
  ListingStudioSection,
  ListingStudioTrustStrip,
} from "@/features/listing-studio/listing-studio";
import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";
import { ListingTaxonomySelector } from "@/features/listing-studio/ListingTaxonomySelector";
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
  assignOwnerListingTaxonomy,
  deleteListingImage,
  deleteOwnerListing,
  fetchListingImages,
  fetchOwnerListingTaxonomyAssignment,
  isOwnerDeletableStatus,
  reorderListingImages,
  fetchOwnerListingDetail,
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicSubcategories,
  fetchPublicTaxonomyNodes,
  submitOwnerListingForReview,
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
  TaxonomyNode,
} from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { fetchListingLocationNodeId } from "@/lib/api/listing-location-read";
import { listingStatusLabel } from "@/lib/status-labels";
import { resolveTaxonomyListingSearch } from "@/lib/taxonomy";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";
import type { PriceType } from "@/types";

type EditImageUploadState = "pending" | "uploading" | "failed";

interface EditUploadImageEntry {
  id: string;
  file: File;
  state: EditImageUploadState;
  error?: string;
  url: string;
}

const MAX_IMAGES = 6;

function fileFingerprint(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

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
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [savingSuccess, setSavingSuccess] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<EditUploadImageEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const selectedImagesRef = useRef<EditUploadImageEntry[]>([]);
  const imagesRef = useRef<ListingImage[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [reorderingImages, setReorderingImages] = useState(false);
  const setupRequestIdRef = useRef(0);
  const imagesRequestIdRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const resubmitInFlightRef = useRef(false);
  const deleteInFlightRef = useRef(false);
  const uploadAllInFlightRef = useRef(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [taxonomyNodeId, setTaxonomyNodeId] = useState("");
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
  const selectedTaxonomyNode = taxonomyNodes.find((item) => item.id === taxonomyNodeId);
  const categoryFieldKind = detectCategoryFieldKind(category, listing);
  const governorate = governorates.find((item) => item.id === governorateId);
  const currentSubcategories = useMemo(
    () => subcategories.filter((item) => item.categoryId === categoryId),
    [subcategories, categoryId],
  );

  const isEditable = listing?.status === "draft" || listing?.status === "rejected";
  const isPendingReview = listing?.status === "pending_review";
  const isResubmittable = listing?.status === "draft" || listing?.status === "rejected";
  const isDeletable = Boolean(listing && isOwnerDeletableStatus(listing.status));
  const studioScore =
    [
      taxonomyNodes.length > 0 ? Boolean(selectedTaxonomyNode?.isLeaf) : Boolean(categoryId),
      title.trim().length >= 8,
      description.trim().length >= 30,
      Boolean(price) || priceType !== "fixed",
      Boolean(locationNodeId) || Boolean(governorateId && district),
    ].filter(Boolean).length * 20;

  const loadSetup = useCallback(async () => {
    if (auth.status !== "signedIn" || !auth.profile?.id) return;
    const profileId = auth.profile.id;
    const requestId = ++setupRequestIdRef.current;
    setLoading(true);
    setSetupError(null);

    const [listingResult, locationResult, taxonomyAssignmentResult, refsResult] = await Promise.all(
      [
        fetchOwnerListingDetail(profileId, id),
        fetchListingLocationNodeId(profileId, id),
        fetchOwnerListingTaxonomyAssignment(profileId, id),
        Promise.all([
          fetchPublicCategories(),
          fetchPublicGovernorates(),
          fetchPublicSubcategories(),
          fetchPublicTaxonomyNodes(),
        ]),
      ],
    );

    if (requestId !== setupRequestIdRef.current) return;
    setLoading(false);
    if (!refsResult[0].ok) {
      setSetupError(refsResult[0].error);
      return;
    }
    if (!refsResult[1].ok) {
      setSetupError(refsResult[1].error);
      return;
    }
    if (!refsResult[2].ok) {
      setSetupError(refsResult[2].error);
      return;
    }
    if (!listingResult.ok) {
      setSetupError(listingResult.error);
      return;
    }

    setListing(listingResult.data);
    setCategories(refsResult[0].data);
    setGovernorates(refsResult[1].data);
    setSubcategories(refsResult[2].data);
    setTaxonomyNodes(refsResult[3].ok ? refsResult[3].data : []);

    const fallbackTaxonomyNodeId = readDetailString(
      listingResult.data.details,
      "_taxonomy_node_id",
    );
    setTaxonomyNodeId(
      taxonomyAssignmentResult.ok
        ? (taxonomyAssignmentResult.data?.taxonomyNodeId ?? fallbackTaxonomyNodeId)
        : fallbackTaxonomyNodeId,
    );
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
  }, [auth.profile?.id, auth.status, id]);

  useEffect(() => {
    setupRequestIdRef.current += 1;
    setListing(null);
    setSetupError(null);
    void loadSetup();
    return () => {
      setupRequestIdRef.current += 1;
    };
  }, [loadSetup]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      selectedImagesRef.current.forEach((entry) => URL.revokeObjectURL(entry.url));
    },
    [],
  );

  const loadImages = useCallback(async () => {
    if (!auth.profile?.id) return;
    const requestId = ++imagesRequestIdRef.current;
    setImagesLoading(true);
    setImagesError(null);
    const result = await fetchListingImages(id);
    if (requestId !== imagesRequestIdRef.current) return;
    setImagesLoading(false);
    if (!result.ok) {
      setImagesError(result.error.message);
      return;
    }
    imagesRef.current = result.data;
    setImages(result.data);
  }, [auth.profile?.id, id]);

  const handleSave = useCallback(async () => {
    if (!listing || !isEditable || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
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

    const details = { ...validation.details };
    if (taxonomyNodeId) details._taxonomy_node_id = taxonomyNodeId;
    else delete details._taxonomy_node_id;

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
      details,
    });

    if (result.ok && taxonomyNodeId) {
      const taxonomyResult = await assignOwnerListingTaxonomy(
        auth.profile?.id ?? null,
        result.data.id,
        taxonomyNodeId,
      );
      if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
        setSaving(false);
        setListing(result.data);
        setSavingError(taxonomyResult.error.message);
        return;
      }
    }

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
    taxonomyNodeId,
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
    if (!listing || !isResubmittable || resubmitInFlightRef.current) return;
    resubmitInFlightRef.current = true;
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

    const details = { ...validation.details };
    if (taxonomyNodeId) details._taxonomy_node_id = taxonomyNodeId;
    else delete details._taxonomy_node_id;

    const saveResult = await updateOwnerListing(auth.profile?.id ?? null, listing.id, {
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
      details,
    });

    if (!saveResult.ok) {
      setResubmitting(false);
      setSavingError(saveResult.error.message);
      return;
    }

    if (taxonomyNodeId) {
      const taxonomyResult = await assignOwnerListingTaxonomy(
        auth.profile?.id ?? null,
        saveResult.data.id,
        taxonomyNodeId,
      );
      if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
        setResubmitting(false);
        setListing(saveResult.data);
        setSavingError(taxonomyResult.error.message);
        return;
      }
    }

    const result = await submitOwnerListingForReview(auth.profile?.id ?? null, saveResult.data.id);

    setResubmitting(false);
    if (result.ok) {
      setListing(result.data);
      setSavingSuccess(text("تم إعادة إرسال الإعلان للمراجعة.", "Listing resubmitted for review."));
    } else {
      setListing(saveResult.data);
      setSavingError(result.error.message);
    }
  }, [
    listing,
    isResubmittable,
    auth.profile?.id,
    categoryId,
    subcategoryId,
    taxonomyNodeId,
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
    if (!listing || !isDeletable || deleteInFlightRef.current) return;
    if (!confirm(text("حذف الإعلان نهائياً؟", "Delete this listing permanently?"))) return;

    deleteInFlightRef.current = true;
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
    return () => {
      imagesRequestIdRef.current += 1;
    };
  }, [listing, loadImages]);

  useEffect(() => {
    if (!saving) saveInFlightRef.current = false;
  }, [saving]);

  useEffect(() => {
    if (!resubmitting) resubmitInFlightRef.current = false;
  }, [resubmitting]);

  useEffect(() => {
    if (!deleting) deleteInFlightRef.current = false;
  }, [deleting]);

  useEffect(() => {
    if (!uploading) uploadAllInFlightRef.current = false;
  }, [uploading]);

  function handleImageSelection(files: FileList | null) {
    const nextFiles = Array.from(files ?? []);
    setSelectedImages((current) => {
      const capacity = Math.max(0, MAX_IMAGES - images.length - current.length);
      const existing = new Set(current.map((entry) => fileFingerprint(entry.file)));
      const unique = nextFiles
        .filter(
          (file, index, files) =>
            !existing.has(fileFingerprint(file)) &&
            files.findIndex((item) => fileFingerprint(item) === fileFingerprint(file)) === index,
        )
        .slice(0, capacity)
        .map((file) => ({
          id: `${fileFingerprint(file)}-${crypto.randomUUID()}`,
          file,
          state: "pending" as const,
          url: URL.createObjectURL(file),
        }));
      const next = [...current, ...unique];
      selectedImagesRef.current = next;
      return next;
    });
    if (images.length + selectedImagesRef.current.length + nextFiles.length > MAX_IMAGES) {
      setUploadError(text("الحد الأقصى 6 صور للإعلان.", "A listing can have up to 6 photos."));
    } else {
      setUploadError(null);
    }
  }

  function removeSelectedImage(entryId: string) {
    const entry = selectedImagesRef.current.find((item) => item.id === entryId);
    if (!entry || entry.state === "uploading") return;
    URL.revokeObjectURL(entry.url);
    const next = selectedImagesRef.current.filter((item) => item.id !== entryId);
    selectedImagesRef.current = next;
    setSelectedImages(next);
  }

  function moveSelectedPendingImage(entryId: string, direction: -1 | 1) {
    if (uploading || reorderingImages) return;
    const current = selectedImagesRef.current;
    const index = current.findIndex((item) => item.id === entryId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    selectedImagesRef.current = next;
    setSelectedImages(next);
  }

  function clearSelectedImages() {
    selectedImagesRef.current.forEach((entry) => URL.revokeObjectURL(entry.url));
    selectedImagesRef.current = [];
    setSelectedImages([]);
    setUploadError(null);
  }

  async function uploadSelectedImage(entryId: string) {
    if (!listing) return;
    const entry = selectedImagesRef.current.find((item) => item.id === entryId);
    if (!entry || entry.state === "uploading") return;
    const uploadingEntries = selectedImagesRef.current.map((item) =>
      item.id === entryId ? { ...item, state: "uploading" as const, error: undefined } : item,
    );
    selectedImagesRef.current = uploadingEntries;
    setSelectedImages(uploadingEntries);
    const result = await uploadListingImage({
      userId: auth.profile?.id ?? null,
      listing,
      file: entry.file,
      sortOrder: imagesRef.current.length,
      altAr: title.trim() || listing.title,
    });
    const latest = selectedImagesRef.current.find((item) => item.id === entryId);
    if (!latest) return;
    if (!result.ok) {
      const failed = selectedImagesRef.current.map((item) =>
        item.id === entryId
          ? { ...item, state: "failed" as const, error: result.error.message }
          : item,
      );
      selectedImagesRef.current = failed;
      setSelectedImages(failed);
      setUploadError(result.error.message);
      return;
    }
    const nextImages = [...imagesRef.current, result.data];
    imagesRef.current = nextImages;
    setImages(nextImages);
    URL.revokeObjectURL(latest.url);
    const remaining = selectedImagesRef.current.filter((item) => item.id !== entryId);
    selectedImagesRef.current = remaining;
    setSelectedImages(remaining);
  }

  async function retrySelectedImage(entryId: string) {
    await uploadSelectedImage(entryId);
  }

  async function handleUploadImages() {
    if (!listing || selectedImagesRef.current.length === 0 || uploadAllInFlightRef.current) return;
    uploadAllInFlightRef.current = true;
    setUploading(true);
    setUploadError(null);
    for (const entry of [...selectedImagesRef.current]) {
      await uploadSelectedImage(entry.id);
    }
    setUploading(false);
  }

  async function moveExistingImage(imageId: string, direction: -1 | 1) {
    if (!listing || !isEditable || imagesLoading || uploading || reorderingImages) return;
    const current = imagesRef.current;
    const index = current.findIndex((image) => image.id === imageId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return;

    const previous = [...current];
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    imagesRef.current = next;
    setImages(next);
    setReorderingImages(true);
    setUploadError(null);

    const result = await reorderListingImages(
      auth.profile?.id ?? null,
      listing.id,
      next.map((image, sortOrder) => ({ id: image.id, sortOrder })),
    );
    setReorderingImages(false);
    if (!result.ok) {
      imagesRef.current = previous;
      setImages(previous);
      setUploadError(result.error.message);
      return;
    }
    imagesRef.current = result.data;
    setImages(result.data);
  }

  function handleDeleteImage(image: ListingImage) {
    void (async () => {
      setImagesLoading(true);
      const result = await deleteListingImage(auth.profile?.id ?? null, listing!.id, image);
      setImagesLoading(false);
      if (result.ok) {
        const nextImages = imagesRef.current.filter((item) => item.id !== image.id);
        imagesRef.current = nextImages;
        setImages(nextImages);
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
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => void loadSetup()}
                className="rawaj-button-primary px-4 py-2"
              >
                {text("إعادة المحاولة", "Try again")}
              </button>
              <Link to="/profile" className="rawaj-chip px-4 py-2">
                {text("العودة لحسابي", "Back to my account")}
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("تعديل الإعلان", "Edit listing")} back to="/profile" />
      <main className="rawaj-listing-studio-v2 rawaj-listing-studio-v3 rawaj-listing-studio-v2--manage container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">
        <ListingStudioHero
          eyebrow={text("إدارة الإعلان", "Listing management")}
          title={title || text("تعديل الإعلان", "Edit listing")}
          description={text(
            "حدّث المعلومات والصور، راقب حالة الإعلان، ثم احفظه أو أعد إرساله للمراجعة عندما يصبح جاهزاً.",
            "Update information and photos, track listing status, then save or resubmit when it is ready.",
          )}
          status={
            <>
              <span>{listingStatusLabel(listing.status, language, true)}</span>
              <span>
                {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
              </span>
            </>
          }
          actions={
            <>
              {listing.status === "approved" ? (
                <Link to="/listings/$id" params={{ id: listing.id }}>
                  {text("عرض الإعلان العام", "View public listing")}
                </Link>
              ) : null}
              <Link to="/profile/listings">{text("إعلاناتي", "My listings")}</Link>
            </>
          }
        />
        <ListingStudioTrustStrip text={text} />

        {isPendingReview && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "هذا الإعلان قيد المراجعة ولا يمكن تعديله الآن. بعد قرار الإدارة سيظهر للعامة عند الموافقة، أو يمكنك تعديل سبب الرفض ثم إعادة إرساله إذا رُفض.",
                "This listing is under review and cannot be edited now. After the admin decision it will become public if approved, or you can address the rejection and resubmit if rejected.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.status === "draft" && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "حفظ التعديلات يبقي الإعلان كمسودة خاصة ولا يرسله للمراجعة. عند اكتمال المعلومات اضغط «إعادة إرسال للمراجعة»؛ بعدها يتوقف التعديل حتى قرار الإدارة.",
                "Saving changes keeps this listing as a private draft and does not submit it for review. When ready, choose “Resubmit for review”; editing then pauses until the admin decision.",
              )}
            </ListingStudioMessage>
          </div>
        )}

        {listing.status === "rejected" && (
          <div className="mb-4">
            <ListingStudioMessage tone="warning">
              {text(
                "تعديل الإعلان المرفوض لا يعيده تلقائياً للمراجعة. أصلح سبب الرفض، احفظ تعديلاتك عند الحاجة، ثم اضغط «إعادة إرسال للمراجعة» عندما يصبح جاهزاً.",
                "Editing a rejected listing does not automatically resubmit it. Fix the rejection reason, save changes as needed, then choose “Resubmit for review” when ready.",
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
        {imagesError && (
          <div className="mb-4">
            <ListingStudioMessage tone="danger">
              <span>{imagesError}</span>{" "}
              <button type="button" onClick={() => void loadImages()} className="underline">
                {text("إعادة تحميل الصور", "Retry photos")}
              </button>
            </ListingStudioMessage>
          </div>
        )}

        <div className="rawaj-studio-shell" data-mode="manage">
          <div className="rawaj-studio-shell__content">
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
              {taxonomyNodes.length > 0 ? (
                <div className={!isEditable ? "pointer-events-none opacity-70" : ""}>
                  <ListingTaxonomySelector
                    nodes={taxonomyNodes}
                    selectedNodeId={taxonomyNodeId}
                    language={language}
                    text={text}
                    onSelect={(node, path) => {
                      if (!isEditable) return;
                      setTaxonomyNodeId(node.id);
                      if (!node.isLeaf) {
                        setCategoryId("");
                        setSubcategoryId(null);
                        setCategoryDetails({});
                        return;
                      }
                      const search = resolveTaxonomyListingSearch(node, path);
                      setCategoryId(search.category ?? "");
                      setSubcategoryId(search.taxonomyLegacySubcategoryId ?? null);
                      setCategoryDetails({});
                    }}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={text("القسم", "Category")}>
                    <select
                      value={categoryId}
                      onChange={(e) => {
                        setCategoryId(e.target.value);
                        setSubcategoryId(null);
                        setTaxonomyNodeId("");
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
                      onChange={(e) => {
                        setSubcategoryId(e.target.value || null);
                        setTaxonomyNodeId("");
                      }}
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
              )}
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
              <div className="rawaj-studio-media-grid">
                {images.map((image, index) => (
                  <div key={image.id} className="rawaj-studio-media-card p-1">
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
                    {isEditable && images.length > 1 && (
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <button
                          type="button"
                          disabled={index === 0 || imagesLoading || uploading || reorderingImages}
                          onClick={() => void moveExistingImage(image.id, -1)}
                          className="rawaj-chip min-h-9 justify-center px-2 disabled:opacity-35"
                          aria-label={text("تحريك الصورة للأمام", "Move photo earlier")}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={
                            index === images.length - 1 ||
                            imagesLoading ||
                            uploading ||
                            reorderingImages
                          }
                          onClick={() => void moveExistingImage(image.id, 1)}
                          className="rawaj-chip min-h-9 justify-center px-2 disabled:opacity-35"
                          aria-label={text("تحريك الصورة للخلف", "Move photo later")}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    {isEditable && (
                      <button
                        type="button"
                        disabled={imagesLoading || uploading || reorderingImages}
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
                  <label className="rawaj-studio-media-picker min-h-[9rem]">
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
                      onChange={(e) => {
                        handleImageSelection(e.target.files);
                        e.target.value = "";
                      }}
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
                      onClick={clearSelectedImages}
                      className="rawaj-chip px-3 py-1.5 font-semibold text-muted-foreground disabled:opacity-50"
                    >
                      {text("تفريغ الاختيار", "Clear selection")}
                    </button>
                  </div>
                  <div className="rawaj-studio-media-grid mt-2">
                    {selectedImages.map((preview, index) => (
                      <div
                        key={preview.id}
                        className="overflow-hidden rounded-[1rem] border border-border/70 bg-card text-[10px] shadow-soft"
                      >
                        <div className="relative">
                          <img
                            src={preview.url}
                            alt={preview.file.name}
                            loading="lazy"
                            decoding="async"
                            className="aspect-[4/3] w-full object-cover"
                          />
                          <button
                            type="button"
                            disabled={preview.state === "uploading"}
                            onClick={() => removeSelectedImage(preview.id)}
                            className="absolute end-2 top-2 grid min-h-11 min-w-11 place-items-center rounded-xl bg-card/90 text-destructive shadow-soft disabled:opacity-50"
                            aria-label={text("إزالة الصورة المختارة", "Remove selected photo")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="p-2">
                          <div className="mb-2 flex gap-1">
                            <button
                              type="button"
                              disabled={index === 0 || uploading || preview.state === "uploading"}
                              onClick={() => moveSelectedPendingImage(preview.id, -1)}
                              className="rawaj-icon-button h-8 w-8 disabled:opacity-35"
                              aria-label={text("تحريك الصورة للأمام", "Move photo earlier")}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={
                                index === selectedImages.length - 1 ||
                                uploading ||
                                preview.state === "uploading"
                              }
                              onClick={() => moveSelectedPendingImage(preview.id, 1)}
                              className="rawaj-icon-button h-8 w-8 disabled:opacity-35"
                              aria-label={text("تحريك الصورة للخلف", "Move photo later")}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="truncate font-bold">{preview.file.name}</p>
                          <p className="text-muted-foreground">
                            {(preview.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                          {preview.state === "uploading" ? (
                            <p className="mt-1 font-bold text-primary">
                              {text("جارٍ رفع هذه الصورة", "Uploading this photo")}
                            </p>
                          ) : null}
                          {preview.state === "failed" ? (
                            <div className="mt-2">
                              <p className="line-clamp-2 text-destructive">{preview.error}</p>
                              <button
                                type="button"
                                onClick={() => void retrySelectedImage(preview.id)}
                                className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 font-bold text-destructive"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                {text("إعادة المحاولة", "Retry")}
                              </button>
                            </div>
                          ) : null}
                          {index === 0 && preview.state === "pending" ? (
                            <p className="mt-1 font-bold text-gold">
                              {text("ستظهر أولاً بعد الرفع", "Will appear first after upload")}
                            </p>
                          ) : null}
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

          <aside className="rawaj-studio-shell__aside">
            <ListingStudioCompletionCard
              score={studioScore}
              ready={studioScore === 100}
              title={
                isEditable
                  ? text("راجع التعديلات قبل الحفظ", "Review changes before saving")
                  : text("الإعلان للعرض فقط الآن", "Listing is view-only right now")
              }
              body={
                isEditable
                  ? text(
                      "المعاينة تتحدث مع بيانات الإعلان.",
                      "The preview updates with listing data.",
                    )
                  : text(
                      "حالة الإعلان الحالية تمنع التعديل.",
                      "The current status prevents editing.",
                    )
              }
              text={text}
            />
            <ListingStudioPreview
              imageUrl={images[0]?.publicUrl ?? selectedImages[0]?.url}
              title={title}
              category={category ? categoryName(category.id, category.nameAr, language) : ""}
              price={
                priceType === "free"
                  ? text("مجاني", "Free")
                  : priceType === "contact"
                    ? text("عند التواصل", "On contact")
                    : price
                      ? `${price} SYP`
                      : ""
              }
              location={
                district ||
                (governorate ? governorateName(governorate.id, governorate.nameAr, language) : "")
              }
              imageCount={images.length + selectedImages.length}
              text={text}
            />
            <ListingStudioQualityPanel
              score={studioScore}
              checks={[
                {
                  label: text("القسم محدد", "Category selected"),
                  done:
                    taxonomyNodes.length > 0
                      ? Boolean(selectedTaxonomyNode?.isLeaf)
                      : Boolean(categoryId),
                },
                { label: text("عنوان واضح", "Clear title"), done: title.trim().length >= 8 },
                {
                  label: text("وصف كافٍ", "Useful description"),
                  done: description.trim().length >= 30,
                },
                {
                  label: text("السعر مكتمل", "Price completed"),
                  done: Boolean(price) || priceType !== "fixed",
                },
                {
                  label: text("الموقع مكتمل", "Location completed"),
                  done: Boolean(locationNodeId) || Boolean(governorateId && district),
                },
              ]}
              text={text}
            />
            <ListingStudioSection title={text("إجراءات", "Actions")}>
              <div className="space-y-2">
                {isEditable && (
                  <div className="space-y-1.5">
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
                    <p className="px-1 text-[10px] leading-4 text-muted-foreground">
                      {text(
                        "يحفظ فقط؛ لا يرسل الإعلان للمراجعة.",
                        "Saves only; does not submit the listing for review.",
                      )}
                    </p>
                  </div>
                )}
                {isResubmittable && (
                  <div className="space-y-1.5">
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
                    <p className="px-1 text-[10px] leading-4 text-muted-foreground">
                      {text(
                        "ينقل الإعلان إلى قيد المراجعة ويوقف التعديل حتى القرار.",
                        "Moves the listing into review and pauses editing until a decision.",
                      )}
                    </p>
                  </div>
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
