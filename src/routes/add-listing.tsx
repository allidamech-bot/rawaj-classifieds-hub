import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Info, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  carMakeOptions,
  detectCategoryFieldKind,
  mergeCategoryDetails,
  type CategoryFieldKind,
  type CategorySpecificDetails,
} from "@/lib/category-fields";
import {
  checkListingContentSafety,
  isSafePhoneValue,
  normalizeContactValue,
} from "@/lib/content-safety";
import {
  createOwnerDraftListing,
  deleteListingImage,
  fetchPublicCategories,
  fetchPublicGovernorates,
  submitOwnerListingForReview,
  updateOwnerListing,
  uploadListingImage,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
  ListingImage,
  ListingCondition,
} from "@/lib/classifieds-types";

type ImageUploadState = "pending" | "uploading" | "uploaded" | "failed";

interface UploadImageEntry {
  id: string;
  file: File;
  state: ImageUploadState;
  error?: string;
  attempt: number;
  url: string;
  uploadedImage?: ListingImage;
}
import { categoryName, governorateName } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";
import type { PriceType } from "@/types";

const MAX_IMAGES = 6;

export const Route = createFileRoute("/add-listing")({
  head: () => ({
    meta: [{ title: "أضف إعلاناً | رَوَاج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AddListingPage,
});

function AddListingPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<ClassifiedsError | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [draftListing, setDraftListing] = useState<ClassifiedListing | null>(null);
  const [selectedImages, setSelectedImages] = useState<UploadImageEntry[]>([]);
  const [removingImageIds, setRemovingImageIds] = useState<Set<string>>(() => new Set());
  const [imageSelectionMessage, setImageSelectionMessage] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<PriceType>("fixed");
  const [governorateId, setGovernorateId] = useState("");
  const [district, setDistrict] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState<ListingCondition>("not_applicable");
  const [contactName, setContactName] = useState("");
  const [contact, setContact] = useState({ phone: false, whatsapp: false });
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [categoryDetails, setCategoryDetails] = useState<CategorySpecificDetails>({});
  const submittingRef = useRef(false);
  const selectedImagesRef = useRef<UploadImageEntry[]>([]);
  const imageRetryInFlightRef = useRef<Set<string>>(new Set());
  const imageRemovalInFlightRef = useRef<Set<string>>(new Set());
  const imageUploadOperationRef = useRef<Map<string, number>>(new Map());

  const category = categories.find((item) => item.id === categoryId);
  const categoryFieldKind = detectCategoryFieldKind(category);
  const governorate = governorates.find((item) => item.id === governorateId);
  const normalizedPrice = normalizeNumericInput(price);
  const canContinue = true;
  const canSubmit = step === 4;
  const score = useMemo(
    () =>
      [
        !!categoryId,
        title.trim().length >= 8,
        description.trim().length >= 30,
        !!price || priceType !== "fixed",
        !!governorateId && !!district,
      ].filter(Boolean).length * 20,
    [categoryId, title, description, price, priceType, governorateId, district],
  );
  const steps = [
    text("القسم", "Category"),
    text("الصور", "Photos"),
    text("التفاصيل", "Details"),
    text("التواصل", "Contact"),
    text("المراجعة", "Review"),
  ];
  const selectedImagePreviews = useMemo(
    () =>
      selectedImages.map((entry) => ({
        id: entry.id,
        file: entry.file,
        url: entry.url,
        state: entry.state,
        error: entry.error,
      })),
    [selectedImages],
  );

  useEffect(
    () => () => {
      selectedImagesRef.current.forEach((entry) => URL.revokeObjectURL(entry.url));
    },
    [],
  );

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  function beginImageUploadOperation(id: string) {
    const operation = (imageUploadOperationRef.current.get(id) ?? 0) + 1;
    imageUploadOperationRef.current.set(id, operation);
    selectedImagesRef.current = selectedImagesRef.current.map((entry) =>
      entry.id === id
        ? { ...entry, state: "uploading" as const, error: undefined, attempt: operation }
        : entry,
    );
    setSelectedImages((current) =>
      current.map((entry) =>
        entry.id === id
          ? { ...entry, state: "uploading" as const, error: undefined, attempt: operation }
          : entry,
      ),
    );
    return operation;
  }

  function isCurrentImageUploadOperation(id: string, operation: number) {
    return (
      imageUploadOperationRef.current.get(id) === operation &&
      selectedImagesRef.current.some((entry) => entry.id === id)
    );
  }

  function clearImageUploadOperation(id: string, operation?: number) {
    if (operation === undefined || imageUploadOperationRef.current.get(id) === operation) {
      imageUploadOperationRef.current.delete(id);
    }
  }

  function handleImageSelection(files: FileList | null) {
    const nextFiles = Array.from(files ?? []);
    setImageSelectionMessage(
      nextFiles.length > MAX_IMAGES || selectedImages.length + nextFiles.length > MAX_IMAGES
        ? text(
            "تم اختيار أول 6 صور فقط. يمكنك إزالة صورة واختيار غيرها.",
            "Only up to 6 photos can be selected. Remove one to choose another.",
          )
        : null,
    );
    const existing = new Set(selectedImages.map((entry) => fileFingerprint(entry.file)));
    setSelectedImages((current) => [
      ...current,
      ...nextFiles
        .slice(0, Math.max(0, MAX_IMAGES - selectedImages.length))
        .filter(
          (file, index, files) =>
            !existing.has(fileFingerprint(file)) &&
            files.findIndex((item) => fileFingerprint(item) === fileFingerprint(file)) === index,
        )
        .map((file) => ({
          id: `${fileFingerprint(file)}-${crypto.randomUUID()}`,
          file,
          state: "pending" as const,
          url: URL.createObjectURL(file),
          attempt: 0,
        })),
    ]);
  }

  async function removeSelectedImage(id: string) {
    if (imageRemovalInFlightRef.current.has(id)) return;
    const entry = selectedImagesRef.current.find((item) => item.id === id);
    if (!entry) return;
    clearImageUploadOperation(id);

    if (entry.uploadedImage && draftListing) {
      imageRemovalInFlightRef.current.add(id);
      setRemovingImageIds((current) => new Set(current).add(id));
      const deleteResult = await deleteListingImage(
        auth.profile?.id ?? null,
        draftListing.id,
        entry.uploadedImage,
      ).finally(() => {
        imageRemovalInFlightRef.current.delete(id);
        setRemovingImageIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      });
      const latest = selectedImagesRef.current.find((item) => item.id === id);
      if (!latest || latest.uploadedImage?.id !== entry.uploadedImage.id) return;
      if (!deleteResult.ok) {
        setSubmitMessage(deleteResult.error.message);
        return;
      }
    }

    URL.revokeObjectURL(entry.url);
    selectedImagesRef.current = selectedImagesRef.current.filter((item) => item.id !== id);
    setSelectedImages((current) => current.filter((item) => item.id !== id));
    setImageSelectionMessage(null);
  }

  async function retrySelectedImage(id: string) {
    if (imageRetryInFlightRef.current.has(id)) return;
    if (!draftListing || submittingRef.current) {
      setSubmitMessage(
        text(
          "احفظ الإعلان كمسودة أولًا عبر زر الإرسال ثم أعد محاولة الصور الفاشلة.",
          "Save the listing draft first by submitting, then retry failed photos.",
        ),
      );
      return;
    }

    const currentEntry = selectedImagesRef.current.find((entry) => entry.id === id);
    if (!currentEntry || currentEntry.state === "uploaded" || currentEntry.state === "uploading") {
      return;
    }
    imageRetryInFlightRef.current.add(id);
    const operation = beginImageUploadOperation(id);
    const sortOrder = selectedImagesRef.current.findIndex((entry) => entry.id === id);

    try {
      const uploadResult = await uploadListingImage({
        userId: auth.profile?.id ?? null,
        listing: draftListing,
        file: currentEntry.file,
        sortOrder,
        altAr: title.trim(),
      });

      const isCurrentOperation = isCurrentImageUploadOperation(id, operation);
      if (!isCurrentOperation) {
        if (uploadResult.ok) {
          void deleteListingImage(auth.profile?.id ?? null, draftListing.id, uploadResult.data);
        }
        return;
      }

      setSelectedImages((current) => {
        const latest = current.find((entry) => entry.id === id);
        if (!latest || latest.attempt !== operation) return current;
        if (!uploadResult.ok) {
          return current.map((entry) =>
            entry.id === id
              ? { ...entry, state: "failed" as const, error: uploadResult.error.message }
              : entry,
          );
        }
        return current.map((entry) =>
          entry.id === id
            ? { ...entry, state: "uploaded" as const, uploadedImage: uploadResult.data }
            : entry,
        );
      });
    } finally {
      imageRetryInFlightRef.current.delete(id);
      clearImageUploadOperation(id, operation);
    }
  }

  function validateCurrentStep(currentStep = step) {
    const errors = buildStepErrors({
      step: currentStep,
      categoryId,
      title,
      description,
      price: normalizedPrice,
      priceType,
      governorateId,
      district,
      categoryFieldKind,
      categoryDetails,
      contact,
      phone,
      whatsapp,
    });
    setFieldErrors(errors.fields);
    setStepErrors(errors.summary);
    if (errors.summary.length > 0) {
      window.setTimeout(() => {
        document.querySelector<HTMLElement>("[data-first-invalid='true']")?.focus();
        document.querySelector<HTMLElement>("[data-error-summary='true']")?.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      }, 0);
    }
    return errors.summary.length === 0;
  }

  function goNext() {
    if (!validateCurrentStep(step)) return;
    setStepErrors([]);
    setFieldErrors({});
    setStep((value) => Math.min(steps.length - 1, value + 1));
  }

  function buildCurrentListingPayload(details: Record<string, unknown>) {
    return {
      categoryId,
      governorateId,
      title: title.trim(),
      description: description.trim(),
      price: normalizedPrice ? Number(normalizedPrice) : null,
      priceType,
      condition,
      districtAr: district,
      contactName: contactName.trim() || null,
      contactOptions: contact,
      details,
    };
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setSetupError(null);
      const [categoriesResult, governoratesResult] = await Promise.all([
        fetchPublicCategories(),
        fetchPublicGovernorates(),
      ]);
      if (cancelled) return;
      if (!categoriesResult.ok) setSetupError(categoriesResult.error);
      else if (!governoratesResult.ok) setSetupError(governoratesResult.error);
      else {
        setCategories(categoriesResult.data);
        setGovernorates(governoratesResult.data);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitListing() {
    if (submittingRef.current) return;
    if (!validateCurrentStep(4)) {
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitMessage(null);

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);

    try {
      const normalizedPhone = normalizeContactValue(phone);
      const normalizedWhatsapp = normalizeContactValue(whatsapp);
      if (contact.phone && !isSafePhoneValue(normalizedPhone)) {
        setSubmitMessage(
          text(
            "أدخل رقم هاتف صالحا قبل إرسال الإعلان.",
            "Enter a valid phone number before submitting.",
          ),
        );
        return;
      }
      if (contact.whatsapp && !isSafePhoneValue(normalizedWhatsapp)) {
        setSubmitMessage(
          text(
            "أدخل رقم واتساب صالحا قبل إرسال الإعلان.",
            "Enter a valid WhatsApp number before submitting.",
          ),
        );
        return;
      }

      const contentCheck = checkListingContentSafety([title, description, contactName]);
      if (contentCheck.blocked) {
        setSubmitMessage(contentCheck.messageAr);
        return;
      }

      const details = mergeCategoryDetails(
        {
          ...(contact.phone ? { phone: normalizedPhone } : {}),
          ...(contact.whatsapp ? { whatsapp: normalizedWhatsapp } : {}),
          ...(contentCheck.flags.length > 0 ? { content_flags: contentCheck.flags } : {}),
        },
        categoryFieldKind,
        categoryDetails,
      );

      const payload = buildCurrentListingPayload(details);
      const result = draftListing
        ? await updateOwnerListing(auth.profile?.id ?? null, draftListing.id, payload)
        : await createOwnerDraftListing(auth.profile?.id ?? null, payload);

      if (!result.ok) {
        setSubmitMessage(result.error.message);
        return;
      }
      const listingDraft = result.data;

      setDraftListing(listingDraft);
      setCreatedListingId(listingDraft.id);

      const imageErrors: string[] = [];
      for (const [index, entry] of selectedImages.entries()) {
        if (entry.state === "uploaded") continue;
        if (!selectedImagesRef.current.some((item) => item.id === entry.id)) continue;
        const operation = beginImageUploadOperation(entry.id);

        const uploadResult = await uploadListingImage({
          userId: auth.profile?.id ?? null,
          listing: listingDraft,
          file: entry.file,
          sortOrder: index,
          altAr: title.trim(),
        });

        const isCurrentOperation = isCurrentImageUploadOperation(entry.id, operation);
        if (!isCurrentOperation) {
          if (uploadResult.ok) {
            void deleteListingImage(auth.profile?.id ?? null, listingDraft.id, uploadResult.data);
          }
          continue;
        }

        if (!uploadResult.ok) {
          imageErrors.push(uploadResult.error.message);
        }

        setSelectedImages((current) => {
          const currentEntry = current.find((item) => item.id === entry.id);
          if (!currentEntry || currentEntry.attempt !== operation) {
            return current;
          }
          if (!uploadResult.ok) {
            return current.map((item) =>
              item.id === entry.id
                ? { ...item, state: "failed" as const, error: uploadResult.error.message }
                : item,
            );
          }
          return current.map((item) =>
            item.id === entry.id
              ? { ...item, state: "uploaded" as const, uploadedImage: uploadResult.data }
              : item,
          );
        });
        clearImageUploadOperation(entry.id, operation);
      }

      if (imageErrors.length > 0) {
        setSubmitMessage(
          text(
            `تم حفظ الإعلان كمسودة، وتعذر رفع بعض الصور: ${imageErrors[0]}`,
            `Listing draft was saved, and some photos could not upload: ${imageErrors[0]}`,
          ),
        );
        return;
      }

      const submitResult = await submitOwnerListingForReview(
        auth.profile?.id ?? null,
        listingDraft.id,
      );
      if (!submitResult.ok) {
        setSubmitMessage(
          text(
            `تم حفظ الإعلان كمسودة، لكن تعذر إرساله للمراجعة: ${submitResult.error.message}`,
            `Listing draft was saved, but review submission failed: ${submitResult.error.message}`,
          ),
        );
        return;
      }
      setDraftListing(submitResult.data);

      setSubmitMessage(
        imageErrors.length > 0
          ? text(
              `تم إرسال الإعلان للمراجعة، وتعذر رفع بعض الصور: ${imageErrors[0]}`,
              `Listing was sent for review, and some photos could not upload: ${imageErrors[0]}`,
            )
          : text(
              "تم إرسال الإعلان للمراجعة. سيظهر للعامة بعد الموافقة.",
              "Listing sent for review. It will be public after approval.",
            ),
      );
    } finally {
      window.removeEventListener("beforeunload", beforeUnload);
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  if (auth.status === "loading") {
    return (
      <PageState
        title={text("أضف إعلاناً", "Post a listing")}
        heading={text("جارٍ التحقق من الجلسة", "Checking session")}
        body={text("نجهّز حالة حسابك قبل النشر.", "Preparing your account status before posting.")}
      />
    );
  }

  if (auth.status === "signedOut") {
    return (
      <PageState
        title={text("أضف إعلاناً", "Post a listing")}
        heading={text("تسجيل الدخول مطلوب", "Login required")}
        body={text(
          "سجّل الدخول لإرسال إعلان حقيقي وربطه بحسابك.",
          "Log in to submit a real listing and connect it to your account.",
        )}
        actionLabel={text("تسجيل الدخول", "Log in")}
        actionTo="/login"
      />
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <PageState
        title={text("أضف إعلاناً", "Post a listing")}
        heading={text("النشر يحتاج جلسة حساب", "Posting requires an account session")}
        body={text(
          "تصفح الإعلانات الآن، واستخدم هذه الصفحة عند توفر جلسة الحساب لإرسال إعلان للمراجعة.",
          "Browse listings now, and use this page with an account session to submit a listing for review.",
        )}
        actionLabel={text("تصفح الإعلانات", "Browse listings")}
        actionTo="/listings"
      />
    );
  }

  if (auth.profile?.accountStatus === "disabled" || auth.profile?.accountStatus === "frozen") {
    return (
      <PageState
        title={text("أضف إعلاناً", "Post a listing")}
        heading={text("الحساب مقيّد من النشر", "Account restricted from publishing")}
        body={text(
          "حسابك محجوز أو معطل. يرجى التواصل مع الدعم.",
          "Your account is suspended or disabled. Contact support.",
        )}
      />
    );
  }

  return (
    <>
      <PageHeader title={text("أضف إعلاناً", "Post a listing")} />
      <main className="container-wide mobile-page-bottom pt-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-xl bg-card px-3 py-2 text-xs font-bold text-foreground hairline"
          >
            {text("الرئيسية", "Home")}
          </Link>
          <Link
            to="/listings"
            className="rounded-xl bg-card px-3 py-2 text-xs font-bold text-foreground hairline"
          >
            {text("تصفح الإعلانات", "Browse listings")}
          </Link>
        </div>
        <ol className="no-scrollbar mb-4 flex items-center gap-2 overflow-x-auto pb-2">
          {steps.map((label, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li key={label} className="flex items-center gap-2">
                <div
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-emerald-trust text-emerald-trust-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted-surface text-muted-foreground"}`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <span
                  className={`whitespace-nowrap text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
                {index < steps.length - 1 && <span className="h-px w-6 bg-border" />}
              </li>
            );
          })}
        </ol>

        {loading ? (
          <Card title={text("جارٍ تحميل بيانات النشر", "Loading posting data")}>
            <p className="text-sm text-muted-foreground">
              {text(
                "نجهّز الأقسام والمحافظات المتاحة.",
                "Preparing available categories and governorates.",
              )}
            </p>
          </Card>
        ) : setupError ? (
          <Card title={text("تعذر تجهيز نموذج النشر", "Could not prepare posting form")}>
            <p className="text-sm text-muted-foreground">{setupError.message}</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              {stepErrors.length > 0 && (
                <div
                  data-error-summary="true"
                  className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive hairline"
                >
                  <p className="font-extrabold">
                    {text(
                      "أكمل المعلومات التالية قبل المتابعة:",
                      "Complete the following before continuing:",
                    )}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-xs leading-6">
                    {stepErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {step === 0 && (
                <Card title={text("اختر القسم", "Choose category")}>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {categories.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCategoryId(item.id)}
                        className={`rounded-xl p-3 text-start text-sm font-semibold transition ${categoryId === item.id ? "bg-primary text-primary-foreground" : "bg-card hairline hover:bg-muted-surface"}`}
                      >
                        {categoryName(item.id, item.nameAr, language)}
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {step === 1 && (
                <Card title={text("صور الإعلان", "Listing photos")}>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl bg-muted-surface p-6 text-center text-muted-foreground">
                    <Camera className="h-8 w-8" />
                    <span className="mt-2 text-sm font-bold">
                      {text("اختر صور الإعلان", "Choose listing photos")}
                    </span>
                    <span className="mt-1 text-[11px]">
                      {text(
                        "اختياري · حتى 6 صور · 5MB للصورة",
                        "Optional · up to 6 photos · 5MB each",
                      )}
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => handleImageSelection(event.target.files)}
                    />
                  </label>
                  {imageSelectionMessage && (
                    <p className="mt-3 rounded-xl bg-warning/10 p-3 text-xs font-semibold text-foreground hairline">
                      {imageSelectionMessage}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selectedImagePreviews.map((preview) => (
                      <div
                        key={preview.id}
                        className="group relative overflow-hidden rounded-xl bg-card text-xs hairline"
                      >
                        <img
                          src={preview.url}
                          alt={preview.file.name}
                          className="aspect-[4/3] w-full object-cover"
                        />
                        {preview.state === "uploading" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-foreground/40 text-primary-foreground">
                            <span className="text-[10px] font-bold">
                              {text("جارٍ الرفع", "Uploading")}
                            </span>
                          </div>
                        )}
                        {preview.state === "uploaded" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-emerald-trust/70 text-emerald-trust-foreground">
                            <span className="text-[10px] font-bold">
                              {text("تم الرفع", "Uploaded")}
                            </span>
                          </div>
                        )}
                        {preview.state === "failed" && (
                          <div className="absolute inset-0 flex items-center justify-center bg-destructive/70 text-destructive-foreground">
                            <span className="text-[10px] font-bold">{text("فشل", "Failed")}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={removingImageIds.has(preview.id)}
                          onClick={() => void removeSelectedImage(preview.id)}
                          className="absolute top-2 end-2 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft disabled:opacity-60"
                          aria-label={text("إزالة الصورة", "Remove photo")}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="p-2">
                          <p className="truncate font-bold">{preview.file.name}</p>
                          <p className="mt-1 text-muted-foreground">
                            {(preview.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                          {preview.state === "failed" && preview.error && (
                            <>
                              <p className="mt-1 text-destructive">{preview.error}</p>
                              <button
                                type="button"
                                onClick={() => void retrySelectedImage(preview.id)}
                                className="mt-2 rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground"
                              >
                                {text("إعادة المحاولة", "Retry")}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {step === 2 && (
                <Card title={text("تفاصيل الإعلان", "Listing details")}>
                  <Field label={text("عنوان الإعلان", "Listing title")} error={fieldErrors.title}>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="input"
                      data-first-invalid={Boolean(fieldErrors.title)}
                    />
                  </Field>
                  <Field label={text("الوصف", "Description")} error={fieldErrors.description}>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={4}
                      className="input resize-none"
                      data-first-invalid={Boolean(!fieldErrors.title && fieldErrors.description)}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={text("السعر", "Price")} error={fieldErrors.price}>
                      <input
                        value={price}
                        onChange={(event) => setPrice(normalizeNumericInput(event.target.value))}
                        inputMode="numeric"
                        className="input"
                        data-first-invalid={Boolean(fieldErrors.price)}
                      />
                    </Field>
                    <Field label={text("نوع السعر", "Price type")}>
                      <select
                        value={priceType}
                        onChange={(event) => setPriceType(event.target.value as PriceType)}
                        className="input"
                      >
                        <option value="fixed">{text("ثابت", "Fixed")}</option>
                        <option value="negotiable">{text("قابل للتفاوض", "Negotiable")}</option>
                        <option value="contact">{text("عند التواصل", "On contact")}</option>
                        <option value="free">{text("مجاني", "Free")}</option>
                        <option value="exchange">{text("للمبادلة", "Exchange")}</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label={text("المحافظة", "Governorate")}
                      error={fieldErrors.governorateId}
                    >
                      <select
                        value={governorateId}
                        onChange={(event) => {
                          setGovernorateId(event.target.value);
                          setDistrict("");
                        }}
                        className="input"
                        data-first-invalid={Boolean(fieldErrors.governorateId)}
                      >
                        <option value="">{text("اختر", "Choose")}</option>
                        {governorates.map((item) => (
                          <option key={item.id} value={item.id}>
                            {governorateName(item.id, item.nameAr, language)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={text("المنطقة", "District")} error={fieldErrors.district}>
                      <select
                        value={district}
                        onChange={(event) => setDistrict(event.target.value)}
                        disabled={!governorate}
                        className="input disabled:opacity-50"
                        data-first-invalid={Boolean(fieldErrors.district)}
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
                  <Field label={text("الحالة", "Condition")}>
                    <select
                      value={condition}
                      onChange={(event) => setCondition(event.target.value as ListingCondition)}
                      className="input"
                    >
                      <option value="not_applicable">{text("غير محدد", "Not specified")}</option>
                      <option value="new">{text("جديد", "New")}</option>
                      <option value="like_new">{text("شبه جديد", "Like new")}</option>
                      <option value="used">{text("مستعمل", "Used")}</option>
                      <option value="for_parts">{text("للقطع", "For parts")}</option>
                    </select>
                  </Field>
                  <CategorySpecificFields
                    kind={categoryFieldKind}
                    values={categoryDetails}
                    onChange={setCategoryDetails}
                    text={text}
                    errors={fieldErrors}
                  />
                </Card>
              )}

              {step === 3 && (
                <Card title={text("طريقة التواصل", "Contact method")}>
                  <Field label={text("اسم التواصل", "Contact name")}>
                    <input
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      className="input"
                    />
                  </Field>
                  <div className="mb-3 rounded-xl bg-muted-surface p-3 text-xs leading-6 text-foreground hairline">
                    {text(
                      "رقم الهاتف وواتساب اختياريان. عند تفعيل أي خيار وإرسال الإعلان للمراجعة قد يظهر الرقم للعامة على الإعلان بعد الموافقة. هذه الأرقام غير موثقة داخل رواج.",
                      "Phone and WhatsApp are optional. If enabled, they may appear publicly on the approved listing after review. RAWAJ does not verify these numbers.",
                    )}
                  </div>
                  {contact.phone && (
                    <Field label={text("رقم الهاتف", "Phone number")} error={fieldErrors.phone}>
                      <input
                        value={phone}
                        onChange={(event) => setPhone(normalizeArabicDigits(event.target.value))}
                        inputMode="tel"
                        autoComplete="tel"
                        className="input"
                        placeholder="+963 ..."
                        data-first-invalid={Boolean(fieldErrors.phone)}
                      />
                    </Field>
                  )}
                  {contact.whatsapp && (
                    <Field
                      label={text("رقم واتساب", "WhatsApp number")}
                      error={fieldErrors.whatsapp}
                    >
                      <input
                        value={whatsapp}
                        onChange={(event) => setWhatsapp(normalizeArabicDigits(event.target.value))}
                        inputMode="tel"
                        autoComplete="tel"
                        className="input"
                        placeholder="+963 ..."
                        data-first-invalid={Boolean(fieldErrors.whatsapp)}
                      />
                    </Field>
                  )}
                  <div className="space-y-2">
                    {[
                      { key: "phone" as const, label: text("اتصال هاتفي", "Phone call") },
                      { key: "whatsapp" as const, label: text("واتساب", "WhatsApp") },
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
                          checked={contact[item.key]}
                          onChange={(event) =>
                            setContact((value) => {
                              if (item.key === "phone" && !event.target.checked) setPhone("");
                              if (item.key === "whatsapp" && !event.target.checked) setWhatsapp("");
                              return { ...value, [item.key]: event.target.checked };
                            })
                          }
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                    ))}
                  </div>
                </Card>
              )}

              {step === 4 && (
                <Card title={text("المراجعة قبل الإرسال", "Review before submission")}>
                  <div className="space-y-2 text-sm">
                    <ReviewRow
                      label={text("القسم", "Category")}
                      value={category ? categoryName(category.id, category.nameAr, language) : "-"}
                    />
                    <ReviewRow label={text("العنوان", "Title")} value={title || "-"} />
                    <ReviewRow
                      label={text("المحافظة", "Governorate")}
                      value={
                        governorate
                          ? governorateName(governorate.id, governorate.nameAr, language)
                          : "-"
                      }
                    />
                    <ReviewRow label={text("المنطقة", "District")} value={district || "-"} />
                    <ReviewRow
                      label={text("الصور", "Photos")}
                      value={text(
                        `${selectedImages.length} صورة مختارة`,
                        `${selectedImages.length} selected photos`,
                      )}
                    />
                    <ReviewRow
                      label={text("حالة النشر", "Publish status")}
                      value={text(
                        "سيُرسل كإعلان قيد المراجعة",
                        "Will be submitted as pending review",
                      )}
                    />
                    {contact.phone && (
                      <ReviewRow
                        label={text("رقم الهاتف", "Phone number")}
                        value={normalizeContactValue(phone) || "-"}
                      />
                    )}
                    {contact.whatsapp && (
                      <ReviewRow
                        label={text("رقم واتساب", "WhatsApp number")}
                        value={normalizeContactValue(whatsapp) || "-"}
                      />
                    )}
                  </div>
                  <div className="mt-3 rounded-xl bg-emerald-trust/10 p-3 text-[11px] font-medium text-emerald-trust">
                    {text(
                      "يتم نشر الإعلان للعامة بعد المراجعة والموافقة.",
                      "The listing becomes public after review and approval.",
                    )}
                  </div>
                </Card>
              )}

              <div className="flex items-center justify-between gap-2">
                <button
                  disabled={step === 0}
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  className="rounded-xl bg-card px-5 py-2.5 text-sm font-bold hairline disabled:opacity-40"
                >
                  {text("السابق", "Back")}
                </button>
                {step < steps.length - 1 ? (
                  <button
                    disabled={!canContinue}
                    onClick={goNext}
                    className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {text("متابعة", "Continue")}
                  </button>
                ) : (
                  <button
                    disabled={!canSubmit || submitting}
                    onClick={() => void submitListing()}
                    className="rounded-xl bg-emerald-trust px-6 py-2.5 text-sm font-bold text-emerald-trust-foreground disabled:opacity-50"
                  >
                    {submitting
                      ? text("جارٍ الإرسال...", "Submitting...")
                      : text("إرسال للمراجعة", "Submit for review")}
                  </button>
                )}
              </div>

              {submitMessage && (
                <div className="rounded-xl bg-muted-surface p-3 text-center text-xs font-semibold text-foreground">
                  <p>{submitMessage}</p>
                  {createdListingId && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() =>
                          void navigate({ to: "/listings/$id", params: { id: createdListingId } })
                        }
                        className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                      >
                        {text("عرض الإعلان", "View listing")}
                      </button>
                      <Link
                        to="/profile"
                        className="rounded-xl bg-card px-3 py-2 text-xs font-bold hairline"
                      >
                        {text("إعلاناتي", "My listings")}
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-3">
              <Card title={text("جودة الإعلان", "Listing quality")}>
                <div className="text-2xl font-extrabold text-foreground">{score}%</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted-surface">
                  <div className="h-full bg-gold transition-all" style={{ width: `${score}%` }} />
                </div>
              </Card>
              <Card title={text("تنبيه", "Note")}>
                <p className="flex items-start gap-2 text-xs text-foreground/80">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                  {text(
                    "املأ بيانات واضحة وصوراً مناسبة ليتمكن فريق المراجعة من اعتماد الإعلان بسرعة.",
                    "Add clear details and suitable photos so the review team can approve the listing quickly.",
                  )}
                </p>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}

function PageState({
  title,
  heading,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  heading: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <>
      <PageHeader title={title} />
      <main className="container-wide mobile-page-bottom pt-10">
        <div className="rounded-2xl bg-card p-10 text-center hairline">
          <p className="text-sm font-bold text-foreground">{heading}</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>
          {actionLabel && actionTo && (
            <Link
              to={actionTo}
              className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </main>
    </>
  );
}

function normalizeArabicDigits(value: string) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabicIndex = arabic.indexOf(digit);
    if (arabicIndex >= 0) return String(arabicIndex);
    const persianIndex = persian.indexOf(digit);
    return persianIndex >= 0 ? String(persianIndex) : digit;
  });
}

function fileFingerprint(file: File) {
  return [file.name, file.size, file.type, file.lastModified].join(":");
}

function normalizeNumericInput(value: string) {
  return normalizeArabicDigits(value).replace(/[^\d.]/g, "");
}

function validatePhone(value: string) {
  const normalized = normalizeContactValue(value);
  return (
    /^[+\d][\d\s()+-]{6,24}$/.test(normalized) && /[0-9]{7,}/.test(normalized.replace(/\D/g, ""))
  );
}

function buildStepErrors({
  step,
  categoryId,
  title,
  description,
  price,
  priceType,
  governorateId,
  district,
  categoryFieldKind,
  categoryDetails,
  contact,
  phone,
  whatsapp,
}: {
  step: number;
  categoryId: string;
  title: string;
  description: string;
  price: string;
  priceType: PriceType;
  governorateId: string;
  district: string;
  categoryFieldKind: CategoryFieldKind;
  categoryDetails: CategorySpecificDetails;
  contact: { phone: boolean; whatsapp: boolean };
  phone: string;
  whatsapp: string;
}) {
  const fields: Record<string, string> = {};
  const summary: string[] = [];
  const add = (key: string, message: string) => {
    fields[key] = message;
    summary.push(message);
  };

  if (step === 0 && !categoryId) add("categoryId", "اختر القسم.");

  if (step === 2 || step === 4) {
    if (title.trim().length < 10) add("title", "العنوان يجب أن يكون 10 أحرف على الأقل.");
    if (description.trim().length < 30) add("description", "الوصف يجب أن يكون 30 حرفًا على الأقل.");
    if (!governorateId) add("governorateId", "اختر المحافظة.");
    if (!district) add("district", "اختر المنطقة.");
    if ((priceType === "fixed" || priceType === "negotiable") && !price) {
      add("price", "السعر يجب أن يكون رقمًا صحيحًا.");
    }
    if (price && (!Number.isFinite(Number(price)) || Number(price) < 0)) {
      add("price", "السعر يجب أن يكون رقمًا صحيحًا.");
    }

    if (categoryFieldKind === "vehicles") {
      if (!categoryDetails.car_make && !categoryDetails.make) add("car_make", "اختر شركة السيارة.");
      if (!categoryDetails.car_model && !categoryDetails.model)
        add("car_model", "أدخل طراز السيارة.");
      if (!categoryDetails.year) add("year", "سنة الصنع غير صحيحة.");
      if (
        categoryDetails.year &&
        (categoryDetails.year < 1900 || categoryDetails.year > new Date().getFullYear() + 1)
      ) {
        add("year", "سنة الصنع غير صحيحة.");
      }
      if (categoryDetails.mileage_km === undefined) {
        add("mileage_km", "عدد الكيلومترات يجب أن يكون رقمًا.");
      }
    }

    if (categoryFieldKind === "real_estate") {
      if (!categoryDetails.property_type) add("property_type", "اختر نوع العقار.");
      if (!categoryDetails.listing_purpose) add("listing_purpose", "اختر الغرض من الإعلان.");
      if (!categoryDetails.area_sqm) add("area_sqm", "المساحة يجب أن تكون رقمًا صحيحًا.");
    }

    if (categoryFieldKind === "jobs") {
      if (!categoryDetails.job_type) add("job_type", "أدخل نوع الوظيفة.");
      if (!categoryDetails.employment_type) add("employment_type", "اختر نمط العمل.");
    }

    if (categoryFieldKind === "services" && !categoryDetails.service_type) {
      add("service_type", "أدخل نوع الخدمة.");
    }

    if (categoryFieldKind === "electronics") {
      if (!categoryDetails.electronics_brand) add("electronics_brand", "أدخل الشركة أو العلامة.");
      if (!categoryDetails.electronics_model) add("electronics_model", "أدخل الموديل.");
    }
  }

  if (step === 3 || step === 4) {
    if (contact.phone && !validatePhone(phone)) {
      add("phone", "رقم الهاتف يجب أن يحتوي أرقامًا فقط وبصيغة واضحة.");
    }
    if (contact.whatsapp && !validatePhone(whatsapp)) {
      add("whatsapp", "رقم واتساب يجب أن يحتوي أرقامًا فقط وبصيغة واضحة.");
    }
  }

  return { fields, summary };
}

function CategorySpecificFields({
  kind,
  values,
  onChange,
  text,
  errors,
}: {
  kind: CategoryFieldKind;
  values: CategorySpecificDetails;
  onChange: (value: CategorySpecificDetails) => void;
  text: (ar: string, en: string) => string;
  errors: Record<string, string>;
}) {
  const patch = (next: Partial<CategorySpecificDetails>) => onChange({ ...values, ...next });

  if (kind === "real_estate") {
    return (
      <div className="mt-3 rounded-xl bg-muted-surface p-3">
        <h4 className="mb-3 text-xs font-extrabold">
          {text("تفاصيل العقار", "Real estate details")}
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={text("نوع العقار", "Property type")}>
            <select
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
            onChange={(bedrooms) => patch({ bedrooms })}
            min={0}
            max={30}
          />
          <NumberField
            label={text("الحمامات", "Bathrooms")}
            value={values.bathrooms}
            onChange={(bathrooms) => patch({ bathrooms })}
            min={0}
            max={30}
          />
          <NumberField
            label={text("المساحة م²", "Area sqm")}
            value={values.area_sqm}
            onChange={(area_sqm) => patch({ area_sqm })}
            min={1}
            max={100000}
          />
          <NumberField
            label={text("الطابق", "Floor")}
            value={values.floor}
            onChange={(floor) => patch({ floor })}
            min={-5}
            max={200}
          />
          <CheckboxField
            label={text("مفروش", "Furnished")}
            checked={values.furnished ?? false}
            onChange={(furnished) => patch({ furnished })}
          />
          <CheckboxField
            label={text("موقف سيارة", "Parking")}
            checked={values.parking ?? false}
            onChange={(parking) => patch({ parking })}
          />
        </div>
      </div>
    );
  }

  if (kind === "vehicles") {
    return (
      <div className="mt-3 rounded-xl bg-muted-surface p-3">
        <h4 className="mb-3 text-xs font-extrabold">{text("تفاصيل السيارة", "Vehicle details")}</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={text("الشركة", "Make")} error={errors.car_make}>
            <select
              value={values.car_make ?? values.make ?? ""}
              onChange={(event) => patch({ car_make: event.target.value || undefined })}
              className="input"
              data-first-invalid={Boolean(errors.car_make)}
            >
              <option value="">{text("اختر الشركة", "Choose make")}</option>
              {carMakeOptions.map((make) => (
                <option key={make} value={make}>
                  {make === "Other" ? text("أخرى", "Other") : make}
                </option>
              ))}
            </select>
          </Field>
          <Field label={text("الطراز", "Model")} error={errors.car_model}>
            <input
              value={values.car_model ?? values.model ?? ""}
              onChange={(event) => patch({ car_model: event.target.value })}
              maxLength={60}
              className="input"
              data-first-invalid={Boolean(errors.car_model)}
            />
          </Field>
          <NumberField
            label={text("السنة", "Year")}
            value={values.year}
            onChange={(year) => patch({ year })}
            min={1900}
            max={new Date().getFullYear() + 1}
            error={errors.year}
          />
          <NumberField
            label={text("المسافة كم", "Mileage km")}
            value={values.mileage_km}
            onChange={(mileage_km) => patch({ mileage_km })}
            min={0}
            max={2000000}
            error={errors.mileage_km}
          />
          <Field label={text("الوقود", "Fuel")}>
            <select
              value={values.fuel_type ?? ""}
              onChange={(event) => patch({ fuel_type: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="gasoline">{text("بنزين", "Gasoline")}</option>
              <option value="diesel">{text("ديزل", "Diesel")}</option>
              <option value="hybrid">{text("هايبرد", "Hybrid")}</option>
              <option value="electric">{text("كهرباء", "Electric")}</option>
              <option value="gas">{text("غاز", "Gas")}</option>
              <option value="other">{text("أخرى", "Other")}</option>
            </select>
          </Field>
          <Field label={text("ناقل الحركة", "Transmission")}>
            <select
              value={values.transmission ?? ""}
              onChange={(event) => patch({ transmission: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="automatic">{text("أوتوماتيك", "Automatic")}</option>
              <option value="manual">{text("يدوي", "Manual")}</option>
              <option value="semi_auto">{text("نصف أوتوماتيك", "Semi-auto")}</option>
            </select>
          </Field>
          <Field label={text("شكل المركبة", "Body type")}>
            <select
              value={values.body_type ?? ""}
              onChange={(event) => patch({ body_type: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="sedan">{text("سيدان", "Sedan")}</option>
              <option value="hatchback">{text("هاتشباك", "Hatchback")}</option>
              <option value="suv">SUV</option>
              <option value="pickup">{text("بيك أب", "Pickup")}</option>
              <option value="van">{text("فان", "Van")}</option>
              <option value="coupe">{text("كوبيه", "Coupe")}</option>
              <option value="bus">{text("باص", "Bus")}</option>
              <option value="truck">{text("شاحنة", "Truck")}</option>
              <option value="motorcycle">{text("دراجة نارية", "Motorcycle")}</option>
              <option value="other">{text("أخرى", "Other")}</option>
            </select>
          </Field>
          <Field label={text("حالة السيارة", "Vehicle condition")}>
            <select
              value={values.vehicle_condition ?? ""}
              onChange={(event) => patch({ vehicle_condition: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="new">{text("جديدة", "New")}</option>
              <option value="used">{text("مستعملة", "Used")}</option>
              <option value="excellent">{text("ممتازة", "Excellent")}</option>
              <option value="good">{text("جيدة", "Good")}</option>
              <option value="needs_work">{text("تحتاج صيانة", "Needs work")}</option>
            </select>
          </Field>
          <Field label={text("اللون", "Color")}>
            <input
              value={values.color ?? ""}
              onChange={(event) => patch({ color: event.target.value })}
              maxLength={40}
              className="input"
            />
          </Field>
        </div>
        <LocationDetailsFields values={values} patch={patch} text={text} />
      </div>
    );
  }

  if (kind === "jobs") {
    return (
      <div className="mt-3 rounded-xl bg-muted-surface p-3">
        <h4 className="mb-3 text-xs font-extrabold">{text("تفاصيل الوظيفة", "Job details")}</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={text("نوع الوظيفة", "Job type")} error={errors.job_type}>
            <input
              value={values.job_type ?? ""}
              onChange={(event) => patch({ job_type: event.target.value })}
              className="input"
              data-first-invalid={Boolean(errors.job_type)}
            />
          </Field>
          <Field label={text("نمط العمل", "Employment type")} error={errors.employment_type}>
            <select
              value={values.employment_type ?? ""}
              onChange={(event) => patch({ employment_type: event.target.value || undefined })}
              className="input"
              data-first-invalid={Boolean(errors.employment_type)}
            >
              <option value="">{text("اختر", "Choose")}</option>
              <option value="full_time">{text("دوام كامل", "Full-time")}</option>
              <option value="part_time">{text("دوام جزئي", "Part-time")}</option>
              <option value="contract">{text("عقد", "Contract")}</option>
              <option value="temporary">{text("مؤقت", "Temporary")}</option>
              <option value="internship">{text("تدريب", "Internship")}</option>
            </select>
          </Field>
          <Field label={text("مستوى الخبرة", "Experience level")}>
            <select
              value={values.experience_level ?? ""}
              onChange={(event) => patch({ experience_level: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="not_required">{text("غير مطلوبة", "Not required")}</option>
              <option value="entry">{text("مبتدئ", "Entry")}</option>
              <option value="mid">{text("متوسط", "Mid")}</option>
              <option value="senior">{text("خبير", "Senior")}</option>
              <option value="manager">{text("إدارة", "Manager")}</option>
            </select>
          </Field>
          <Field label={text("نوع الراتب", "Salary type")}>
            <select
              value={values.salary_type ?? ""}
              onChange={(event) => patch({ salary_type: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="fixed">{text("ثابت", "Fixed")}</option>
              <option value="range">{text("نطاق", "Range")}</option>
              <option value="commission">{text("عمولة", "Commission")}</option>
              <option value="negotiable">{text("قابل للتفاوض", "Negotiable")}</option>
              <option value="not_listed">{text("غير معلن", "Not listed")}</option>
            </select>
          </Field>
          <NumberField
            label={text("الراتب من", "Salary from")}
            value={values.salary_min}
            onChange={(salary_min) => patch({ salary_min })}
            min={0}
            max={1000000000}
          />
          <NumberField
            label={text("الراتب إلى", "Salary to")}
            value={values.salary_max}
            onChange={(salary_max) => patch({ salary_max })}
            min={0}
            max={1000000000}
          />
          <Field label={text("مكان العمل", "Work location")}>
            <select
              value={values.work_location ?? ""}
              onChange={(event) => patch({ work_location: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="onsite">{text("حضوري", "On-site")}</option>
              <option value="remote">{text("عن بعد", "Remote")}</option>
              <option value="hybrid">{text("هجين", "Hybrid")}</option>
              <option value="field">{text("ميداني", "Field")}</option>
            </select>
          </Field>
          <Field label={text("مدة العقد", "Contract duration")}>
            <select
              value={values.contract_duration ?? ""}
              onChange={(event) => patch({ contract_duration: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="permanent">{text("دائم", "Permanent")}</option>
              <option value="temporary">{text("مؤقت", "Temporary")}</option>
              <option value="seasonal">{text("موسمي", "Seasonal")}</option>
              <option value="internship">{text("تدريب", "Internship")}</option>
            </select>
          </Field>
          <Field label={text("طريقة التقديم", "Application method")}>
            <select
              value={values.application_method ?? ""}
              onChange={(event) => patch({ application_method: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="rawaj_message">{text("رسائل رواج", "RAWAJ messages")}</option>
              <option value="phone">{text("هاتف", "Phone")}</option>
              <option value="whatsapp">{text("واتساب", "WhatsApp")}</option>
              <option value="email">{text("بريد إلكتروني", "Email")}</option>
              <option value="external">{text("رابط خارجي", "External")}</option>
            </select>
          </Field>
        </div>
        <LocationDetailsFields values={values} patch={patch} text={text} />
      </div>
    );
  }

  if (kind === "services") {
    return (
      <div className="mt-3 rounded-xl bg-muted-surface p-3">
        <h4 className="mb-3 text-xs font-extrabold">{text("تفاصيل الخدمة", "Service details")}</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={text("نوع الخدمة", "Service type")} error={errors.service_type}>
            <input
              value={values.service_type ?? ""}
              onChange={(event) => patch({ service_type: event.target.value })}
              className="input"
              data-first-invalid={Boolean(errors.service_type)}
            />
          </Field>
          <Field label={text("نطاق الخدمة", "Service area")}>
            <input
              value={values.service_area ?? ""}
              onChange={(event) => patch({ service_area: event.target.value })}
              className="input"
            />
          </Field>
          <Field label={text("وقت التنفيذ", "Delivery time")}>
            <select
              value={values.delivery_time ?? ""}
              onChange={(event) => patch({ delivery_time: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="same_day">{text("نفس اليوم", "Same day")}</option>
              <option value="two_three_days">{text("2-3 أيام", "2-3 days")}</option>
              <option value="week">{text("خلال أسبوع", "Within a week")}</option>
              <option value="negotiable">{text("حسب الاتفاق", "Negotiable")}</option>
            </select>
          </Field>
          <NumberField
            label={text("السعر يبدأ من", "Starting price")}
            value={values.starting_price}
            onChange={(starting_price) => patch({ starting_price })}
            min={0}
            max={1000000000}
          />
        </div>
        <LocationDetailsFields values={values} patch={patch} text={text} />
      </div>
    );
  }

  if (kind === "electronics") {
    return (
      <div className="mt-3 rounded-xl bg-muted-surface p-3">
        <h4 className="mb-3 text-xs font-extrabold">{text("تفاصيل الجهاز", "Device details")}</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={text("الشركة", "Brand")} error={errors.electronics_brand}>
            <input
              value={values.electronics_brand ?? ""}
              onChange={(event) => patch({ electronics_brand: event.target.value })}
              className="input"
              data-first-invalid={Boolean(errors.electronics_brand)}
            />
          </Field>
          <Field label={text("الموديل", "Model")} error={errors.electronics_model}>
            <input
              value={values.electronics_model ?? ""}
              onChange={(event) => patch({ electronics_model: event.target.value })}
              className="input"
              data-first-invalid={Boolean(errors.electronics_model)}
            />
          </Field>
          <Field label={text("التخزين", "Storage")}>
            <input
              value={values.storage ?? ""}
              onChange={(event) => patch({ storage: event.target.value })}
              className="input"
              placeholder="128GB"
            />
          </Field>
          <Field label={text("الذاكرة", "RAM")}>
            <input
              value={values.ram ?? ""}
              onChange={(event) => patch({ ram: event.target.value })}
              className="input"
              placeholder="8GB"
            />
          </Field>
          <Field label={text("الحالة", "Condition")}>
            <select
              value={values.condition ?? ""}
              onChange={(event) => patch({ condition: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="new">{text("جديد", "New")}</option>
              <option value="used">{text("مستعمل", "Used")}</option>
              <option value="excellent">{text("ممتاز", "Excellent")}</option>
              <option value="good">{text("جيد", "Good")}</option>
              <option value="needs_work">{text("يحتاج صيانة", "Needs work")}</option>
            </select>
          </Field>
          <Field label={text("الضمان", "Warranty")}>
            <select
              value={values.warranty ?? ""}
              onChange={(event) => patch({ warranty: event.target.value || undefined })}
              className="input"
            >
              <option value="">{text("اختياري", "Optional")}</option>
              <option value="yes">{text("يوجد ضمان", "Warranty")}</option>
              <option value="no">{text("بدون ضمان", "No warranty")}</option>
              <option value="unknown">{text("غير محدد", "Unknown")}</option>
            </select>
          </Field>
          <Field label={text("الملحقات", "Accessories")}>
            <input
              value={values.accessories ?? ""}
              onChange={(event) => patch({ accessories: event.target.value })}
              className="input"
            />
          </Field>
        </div>
        <LocationDetailsFields values={values} patch={patch} text={text} />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl bg-muted-surface p-3">
      <LocationDetailsFields values={values} patch={patch} text={text} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  error,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  error?: string;
}) {
  return (
    <Field label={label} error={error}>
      <input
        value={value ?? ""}
        onChange={(event) => {
          const normalized = normalizeNumericInput(event.target.value);
          onChange(normalized ? Number(normalized) : undefined);
        }}
        inputMode="numeric"
        min={min}
        max={max}
        className="input"
        data-first-invalid={Boolean(error)}
      />
    </Field>
  );
}

function LocationDetailsFields({
  values,
  patch,
  text,
}: {
  values: CategorySpecificDetails;
  patch: (next: Partial<CategorySpecificDetails>) => void;
  text: (ar: string, en: string) => string;
}) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label={text("الحي / الناحية", "Neighborhood")}>
        <input
          value={values.location_neighborhood ?? ""}
          onChange={(event) => patch({ location_neighborhood: event.target.value })}
          maxLength={80}
          className="input"
          placeholder={text("اختياري", "Optional")}
        />
      </Field>
      <Field label={text("تفاصيل إضافية للمكان", "Extra location details")}>
        <input
          value={values.location_details ?? ""}
          onChange={(event) => patch({ location_details: event.target.value })}
          maxLength={180}
          className="input"
          placeholder={text("مثال: قرب دوار أو شارع معروف", "Example: near a known street")}
        />
      </Field>
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-xs font-bold hairline">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    </label>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 hairline shadow-soft">
      <h3 className="mb-3 text-sm font-extrabold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {error && (
        <span className="mt-1 block text-[11px] font-semibold text-destructive">{error}</span>
      )}
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
