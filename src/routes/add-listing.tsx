import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Camera, Check, Info } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  detectCategoryFieldKind,
  mergeCategoryDetails,
  type CategorySpecificDetails,
} from "@/lib/category-fields";
import {
  checkListingContentSafety,
  isSafePhoneValue,
  normalizeContactValue,
} from "@/lib/content-safety";
import {
  createListing,
  fetchPublicCategories,
  fetchPublicGovernorates,
  uploadListingImage,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedsError,
  ListingCondition,
} from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";
import type { PriceType } from "@/types";

export const Route = createFileRoute("/add-listing")({
  head: () => ({ meta: [{ title: "أضف إعلاناً | رَوَاج" }] }),
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
  const [submitting, setSubmitting] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
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

  const category = categories.find((item) => item.id === categoryId);
  const categoryFieldKind = detectCategoryFieldKind(category);
  const governorate = governorates.find((item) => item.id === governorateId);
  const requiresNumericPrice = priceType === "fixed" || priceType === "negotiable";
  const canContinue =
    (step === 0 && !!categoryId) ||
    step === 1 ||
    (step === 2 &&
      title.trim().length >= 4 &&
      !!governorateId &&
      !!district &&
      (!requiresNumericPrice || !!price)) ||
    (step === 3 && (!contact.phone || !!phone.trim()) && (!contact.whatsapp || !!whatsapp.trim()));
  const canSubmit = step === 4 && title.trim().length >= 4 && !!categoryId && !!governorateId;
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
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitMessage(null);

    const normalizedPhone = normalizeContactValue(phone);
    const normalizedWhatsapp = normalizeContactValue(whatsapp);
    if (contact.phone && !isSafePhoneValue(normalizedPhone)) {
      setSubmitting(false);
      setSubmitMessage(
        text(
          "أدخل رقم هاتف صالحا قبل إرسال الإعلان.",
          "Enter a valid phone number before submitting.",
        ),
      );
      return;
    }
    if (contact.whatsapp && !isSafePhoneValue(normalizedWhatsapp)) {
      setSubmitting(false);
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
      setSubmitting(false);
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

    const result = await createListing(auth.profile?.id ?? null, {
      categoryId,
      governorateId,
      title: title.trim(),
      description: description.trim(),
      price: price ? Number(price) : null,
      priceType,
      condition,
      districtAr: district,
      contactName: contactName.trim() || null,
      contactOptions: contact,
      details,
    });

    if (!result.ok) {
      setSubmitting(false);
      setSubmitMessage(result.error.message);
      return;
    }

    const imageErrors: string[] = [];
    for (const [index, file] of selectedImages.entries()) {
      const uploadResult = await uploadListingImage({
        userId: auth.profile?.id ?? null,
        listing: result.data,
        file,
        sortOrder: index,
        altAr: title.trim(),
      });
      if (!uploadResult.ok) imageErrors.push(uploadResult.error.message);
    }

    setSubmitting(false);
    setCreatedListingId(result.data.id);
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

  if (!auth.emailConfirmed) {
    return (
      <PageState
        title={text("أضف إعلاناً", "Post a listing")}
        heading={text("تأكيد البريد مطلوب", "Email confirmation required")}
        body={text(
          "يجب تأكيد بريدك الإلكتروني قبل إرسال إعلان.",
          "Please confirm your email before submitting a listing.",
        )}
        actionLabel={text("العودة للرئيسية", "Back to home")}
        actionTo="/"
      />
    );
  }

  return (
    <>
      <PageHeader title={text("أضف إعلاناً", "Post a listing")} />
      <main className="container-wide pt-4 pb-8">
        <ol className="no-scrollbar mb-5 flex items-center gap-2 overflow-x-auto pb-2">
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
                  className={`text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}
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
                      onChange={(event) =>
                        setSelectedImages(Array.from(event.target.files ?? []).slice(0, 6))
                      }
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selectedImages.map((file) => (
                      <div
                        key={`${file.name}-${file.size}`}
                        className="rounded-xl bg-card p-3 text-xs hairline"
                      >
                        <p className="truncate font-bold">{file.name}</p>
                        <p className="mt-1 text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {step === 2 && (
                <Card title={text("تفاصيل الإعلان", "Listing details")}>
                  <Field label={text("عنوان الإعلان", "Listing title")}>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label={text("الوصف", "Description")}>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={4}
                      className="input resize-none"
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={text("السعر", "Price")}>
                      <input
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        type="number"
                        className="input"
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
                    <Field label={text("المحافظة", "Governorate")}>
                      <select
                        value={governorateId}
                        onChange={(event) => {
                          setGovernorateId(event.target.value);
                          setDistrict("");
                        }}
                        className="input"
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
                        onChange={(event) => setDistrict(event.target.value)}
                        disabled={!governorate}
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
                  {contact.phone && (
                    <Field label={text("رقم الهاتف", "Phone number")}>
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        inputMode="tel"
                        autoComplete="tel"
                        className="input"
                        placeholder="+963 ..."
                      />
                    </Field>
                  )}
                  {contact.whatsapp && (
                    <Field label={text("رقم واتساب", "WhatsApp number")}>
                      <input
                        value={whatsapp}
                        onChange={(event) => setWhatsapp(event.target.value)}
                        inputMode="tel"
                        autoComplete="tel"
                        className="input"
                        placeholder="+963 ..."
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
                    onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
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
      <style>{`.input{width:100%;border-radius:.75rem;background:var(--card);border:1px solid var(--border);padding:.625rem .75rem;font-size:.875rem;color:var(--foreground);outline:none}.input:focus{border-color:var(--ring)}`}</style>
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
      <main className="container-wide pt-10">
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

function CategorySpecificFields({
  kind,
  values,
  onChange,
  text,
}: {
  kind: "real_estate" | "vehicles" | "general";
  values: CategorySpecificDetails;
  onChange: (value: CategorySpecificDetails) => void;
  text: (ar: string, en: string) => string;
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
          <Field label={text("الشركة", "Make")}>
            <input
              value={values.make ?? ""}
              onChange={(event) => patch({ make: event.target.value })}
              maxLength={60}
              className="input"
            />
          </Field>
          <Field label={text("الطراز", "Model")}>
            <input
              value={values.model ?? ""}
              onChange={(event) => patch({ model: event.target.value })}
              maxLength={60}
              className="input"
            />
          </Field>
          <NumberField
            label={text("السنة", "Year")}
            value={values.year}
            onChange={(year) => patch({ year })}
            min={1900}
            max={new Date().getFullYear() + 1}
          />
          <NumberField
            label={text("المسافة كم", "Mileage km")}
            value={values.mileage_km}
            onChange={(mileage_km) => patch({ mileage_km })}
            min={0}
            max={2000000}
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
      </div>
    );
  }

  return null;
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
}) {
  return (
    <Field label={label}>
      <input
        value={value ?? ""}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
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
