import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Camera, Check, Info } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
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
import { useAuth } from "@/lib/use-auth";
import type { PriceType } from "@/types";

export const Route = createFileRoute("/add-listing")({
  head: () => ({
    meta: [{ title: "أضف إعلاناً | رَوَاج" }],
  }),
  component: AddListingPage,
});

const steps = ["القسم", "الصور", "التفاصيل", "التواصل", "المراجعة"];

function AddListingPage() {
  const auth = useAuth();
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
  const [contact, setContact] = useState({ message: true, phone: false, whatsapp: false });

  const category = categories.find((item) => item.id === categoryId);
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
    step === 3;
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

      if (!categoriesResult.ok) {
        setSetupError(categoriesResult.error);
      } else if (!governoratesResult.ok) {
        setSetupError(governoratesResult.error);
      } else {
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
      details: {},
    });

    setSubmitting(false);

    if (!result.ok) {
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

    setCreatedListingId(result.data.id);
    setSubmitMessage(
      imageErrors.length > 0
        ? `تم إرسال الإعلان للمراجعة، لكن تعذر رفع بعض الصور: ${imageErrors[0]}`
        : "تم إرسال الإعلان للمراجعة. لن يظهر للعموم قبل موافقة المالك/الإدارة.",
    );
  }

  if (auth.status === "loading") {
    return (
      <PageState
        title="أضف إعلاناً"
        heading="جارٍ التحقق من الجلسة"
        body="يتم التأكد من حالة تسجيل الدخول."
      />
    );
  }

  if (auth.status === "signedOut") {
    return (
      <PageState
        title="أضف إعلاناً"
        heading="تسجيل الدخول مطلوب"
        body="لا يمكن إرسال إعلان حقيقي بدون حساب. سجّل الدخول ثم عد لإضافة الإعلان."
        actionLabel="تسجيل الدخول"
        actionTo="/login"
      />
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <PageState
        title="أضف إعلاناً"
        heading="إرسال الإعلانات قيد التفعيل"
        body="يمكنك تصفح الواجهة حالياً، وسيتم تفعيل إرسال الإعلانات الحقيقية قريباً بعد اكتمال ربط الحسابات."
      />
    );
  }

  if (auth.profile?.accountStatus !== "active") {
    return (
      <PageState
        title="أضف إعلاناً"
        heading="الحساب غير جاهز للنشر"
        body="يجب أن تكون حالة الحساب نشطة قبل إرسال إعلان حقيقي."
      />
    );
  }

  return (
    <>
      <PageHeader title="أضف إعلاناً" />
      <main className="container-wide pt-4 pb-8">
        <ol className="no-scrollbar mb-5 flex items-center gap-2 overflow-x-auto pb-2">
          {steps.map((label, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li key={label} className="flex items-center gap-2">
                <div
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                    done
                      ? "bg-emerald-trust text-emerald-trust-foreground"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-surface text-muted-foreground"
                  }`}
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
          <Card title="جارٍ تحميل بيانات النشر">
            <p className="text-sm text-muted-foreground">
              يتم تجهيز الأقسام والمحافظات المتاحة للنشر.
            </p>
          </Card>
        ) : setupError ? (
          <Card title="إرسال الإعلانات قيد التفعيل">
            <p className="text-sm text-muted-foreground">{setupError.message}</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              {step === 0 && (
                <Card title="اختر القسم">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {categories.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setCategoryId(item.id)}
                        className={`rounded-xl p-3 text-start text-sm font-semibold transition ${
                          categoryId === item.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-card hairline hover:bg-muted-surface"
                        }`}
                      >
                        {item.nameAr}
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {step === 1 && (
                <Card title="صور الإعلان">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl bg-muted-surface p-6 text-center text-muted-foreground">
                    <Camera className="h-8 w-8" />
                    <span className="mt-2 text-sm font-bold">اختر صور الإعلان</span>
                    <span className="mt-1 text-[11px]">اختياري · حتى 6 صور · 5MB للصورة</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []).slice(0, 6);
                        setSelectedImages(files);
                      }}
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
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    رفع الصور قيد التفعيل حالياً. إذا لم تكن الصور جاهزة بعد، يمكنك متابعة تجهيز
                    الإعلان النصي وستظهر رسالة واضحة للصور فقط.
                  </p>
                </Card>
              )}

              {step === 2 && (
                <Card title="تفاصيل الإعلان">
                  <Field label="عنوان الإعلان">
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="الوصف">
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={4}
                      className="input resize-none"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="السعر">
                      <input
                        value={price}
                        onChange={(event) => setPrice(event.target.value)}
                        type="number"
                        className="input"
                      />
                    </Field>
                    <Field label="نوع السعر">
                      <select
                        value={priceType}
                        onChange={(event) => setPriceType(event.target.value as PriceType)}
                        className="input"
                      >
                        <option value="fixed">ثابت</option>
                        <option value="negotiable">قابل للتفاوض</option>
                        <option value="contact">عند التواصل</option>
                        <option value="free">مجاناً</option>
                        <option value="exchange">للمبادلة</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="المحافظة">
                      <select
                        value={governorateId}
                        onChange={(event) => {
                          setGovernorateId(event.target.value);
                          setDistrict("");
                        }}
                        className="input"
                      >
                        <option value="">اختر</option>
                        {governorates.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.nameAr}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="المنطقة">
                      <select
                        value={district}
                        onChange={(event) => setDistrict(event.target.value)}
                        disabled={!governorate}
                        className="input disabled:opacity-50"
                      >
                        <option value="">اختر</option>
                        {governorate?.districtsAr.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="الحالة">
                    <select
                      value={condition}
                      onChange={(event) => setCondition(event.target.value as ListingCondition)}
                      className="input"
                    >
                      <option value="not_applicable">غير محدد</option>
                      <option value="new">جديد</option>
                      <option value="like_new">شبه جديد</option>
                      <option value="used">مستعمل</option>
                      <option value="for_parts">للقطع</option>
                    </select>
                  </Field>
                </Card>
              )}

              {step === 3 && (
                <Card title="طريقة التواصل">
                  <Field label="اسم التواصل">
                    <input
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      className="input"
                    />
                  </Field>
                  <div className="space-y-2">
                    {[
                      { key: "message", label: "رسائل داخل التطبيق", disabled: true },
                      { key: "phone", label: "اتصال هاتفي", disabled: false },
                      { key: "whatsapp", label: "واتساب", disabled: false },
                    ].map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center justify-between rounded-xl bg-card p-3 hairline"
                      >
                        <div>
                          <div className="text-sm font-semibold">{item.label}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {item.disabled
                              ? "غير مفعّل حالياً"
                              : "لن تظهر بيانات حساسة قبل تفعيل سياسات التواصل"}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={contact[item.key as keyof typeof contact]}
                          onChange={(event) =>
                            setContact((value) => ({ ...value, [item.key]: event.target.checked }))
                          }
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                    ))}
                  </div>
                </Card>
              )}

              {step === 4 && (
                <Card title="المراجعة قبل الإرسال">
                  <div className="space-y-2 text-sm">
                    <PreviewRow label="القسم" value={category?.nameAr ?? "—"} />
                    <PreviewRow label="العنوان" value={title || "—"} />
                    <PreviewRow label="المحافظة" value={governorate?.nameAr ?? "—"} />
                    <PreviewRow label="المنطقة" value={district || "—"} />
                    <PreviewRow label="الصور" value={`${selectedImages.length} صورة مختارة`} />
                    <PreviewRow label="حالة النشر" value="سيُرسل كإعلان قيد المراجعة" />
                  </div>
                  <div className="mt-3 rounded-xl bg-emerald-trust/10 p-3 text-[11px] font-medium text-emerald-trust">
                    لا يستطيع المستخدم العادي اعتماد الإعلان أو تعديل حقول المراجعة. الاعتماد يتم
                    لاحقاً من لوحة المالك.
                  </div>
                </Card>
              )}

              <div className="flex items-center justify-between gap-2">
                <button
                  disabled={step === 0}
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  className="rounded-xl bg-card px-5 py-2.5 text-sm font-bold hairline disabled:opacity-40"
                >
                  السابق
                </button>
                {step < steps.length - 1 ? (
                  <button
                    disabled={!canContinue}
                    onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
                    className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    متابعة
                  </button>
                ) : (
                  <button
                    disabled={!canSubmit || submitting}
                    onClick={() => void submitListing()}
                    className="rounded-xl bg-emerald-trust px-6 py-2.5 text-sm font-bold text-emerald-trust-foreground disabled:opacity-50"
                  >
                    {submitting ? "جارٍ الإرسال..." : "إرسال للمراجعة"}
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
                        عرض الإعلان
                      </button>
                      <Link
                        to="/profile"
                        className="rounded-xl bg-card px-3 py-2 text-xs font-bold hairline"
                      >
                        إعلاناتي
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside className="space-y-3">
              <Card title="جودة الإعلان">
                <div className="text-2xl font-extrabold text-foreground">{score}%</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted-surface">
                  <div className="h-full bg-gold transition-all" style={{ width: `${score}%` }} />
                </div>
              </Card>
              <Card title="تنبيه">
                <p className="flex items-start gap-2 text-xs text-foreground/80">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                  الصور اختيارية وقيد التفعيل. الرسائل والدفع غير مفعّلة حالياً.
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
          <p className="mt-1 text-xs text-muted-foreground">{body}</p>
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

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
