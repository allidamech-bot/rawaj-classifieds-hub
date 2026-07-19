import { createFileRoute } from "@tanstack/react-router";
import {
  Eye,
  Image as ImageIcon,
  Loader2,
  Monitor,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Smartphone,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ownerDeleteAdPlacement,
  ownerFetchAdPlacements,
  ownerSaveAdPlacement,
  ownerSetAdPlacementStatus,
  ownerUploadAdPlacementImage,
  type AdPlacementPage,
  type AdPlacementStatus,
  type AdPlacementSummary,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";
import {
  readImageDimensions,
  validateAdPlacementImageDimensions,
  validateAdPlacementImageFile,
  type AdPlacementImageValidation,
} from "@/lib/api/storage";

export const Route = createFileRoute("/admin/ad-placements")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdPlacementsPage,
});

const placementPages: Array<{ value: AdPlacementPage; ar: string; en: string }> = [
  { value: "home", ar: "الرئيسية", en: "Home" },
  { value: "search_results", ar: "نتائج البحث", en: "Search results" },
  { value: "listing_detail", ar: "صفحة الإعلان", en: "Listing detail" },
  { value: "categories", ar: "الأقسام", en: "Categories" },
  { value: "offers", ar: "العروض", en: "Offers" },
];

interface PlacementFormState {
  id: string | null;
  expectedVersion: number | null;
  name: string;
  placementPage: AdPlacementPage;
  imageUrl: string;
  destinationUrl: string;
  startsAt: string;
  endsAt: string;
  status: AdPlacementStatus;
  priority: string;
  targetMobile: boolean;
  targetDesktop: boolean;
}

const emptyForm: PlacementFormState = {
  id: null,
  expectedVersion: null,
  name: "",
  placementPage: "home",
  imageUrl: "",
  destinationUrl: "",
  startsAt: "",
  endsAt: "",
  status: "draft",
  priority: "0",
  targetMobile: true,
  targetDesktop: true,
};

function AdPlacementsPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const canManage = auth.hasPermission("canManageAdPlacements");
  const [placements, setPlacements] = useState<AdPlacementSummary[]>([]);
  const [form, setForm] = useState<PlacementFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdPlacementSummary | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const requestIdRef = useRef(0);
  const mutationInFlightRef = useRef(false);
  const uploadInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");
    const result = await ownerFetchAdPlacements(canManage);
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error.message);
      return;
    }
    setPlacements(result.data);
    setHasLoaded(true);
  }, [canManage]);

  useEffect(() => {
    requestIdRef.current += 1;
    setPlacements([]);
    setHasLoaded(false);
    setLoadError("");
    void refresh();
    return () => {
      requestIdRef.current += 1;
      mutationInFlightRef.current = false;
      uploadInFlightRef.current = false;
    };
  }, [refresh]);

  const selected = useMemo(
    () => placements.find((placement) => placement.id === form.id) ?? null,
    [form.id, placements],
  );

  function editPlacement(placement: AdPlacementSummary) {
    setForm({
      id: placement.id,
      expectedVersion: placement.version,
      name: placement.name,
      placementPage: placement.placementPage,
      imageUrl: placement.imageUrl,
      destinationUrl: placement.destinationUrl,
      startsAt: toLocalDateTimeInput(placement.startsAt),
      endsAt: toLocalDateTimeInput(placement.endsAt),
      status: placement.status,
      priority: String(placement.priority),
      targetMobile: placement.targetMobile,
      targetDesktop: placement.targetDesktop,
    });
    setActionError("");
    setNotice("");
  }

  function resetForm() {
    setForm(emptyForm);
    setStatusReason("");
    setActionError("");
    setNotice("");
  }

  async function handleImageSelection(file: File | undefined) {
    if (!file || uploadInFlightRef.current) return;
    const fileCheck = validateAdPlacementImageFile(file);
    if (!fileCheck.ok) {
      setActionError(fileCheck.error ?? "ملف الصورة غير صالح.");
      return;
    }
    let dimensions: { width: number; height: number };
    try {
      dimensions = await readImageDimensions(file);
    } catch {
      setActionError(text("تعذر قراءة أبعاد الصورة.", "Could not read image dimensions."));
      return;
    }
    const dimensionCheck = validateAdPlacementImageDimensions(dimensions.width, dimensions.height);
    if (!dimensionCheck.ok) {
      setActionError(dimensionCheck.error ?? "مقاس الصورة غير صالح.");
      return;
    }

    uploadInFlightRef.current = true;
    setUploadingImage(true);
    setActionError("");
    setNotice("");
    try {
      const result = await ownerUploadAdPlacementImage(canManage, auth.profile?.id ?? null, file);
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setForm((value) => ({ ...value, imageUrl: result.data }));
      setNotice(text("تم رفع صورة الإعلان بنجاح.", "Ad image uploaded successfully."));
    } finally {
      uploadInFlightRef.current = false;
      setUploadingImage(false);
    }
  }

  function clearImage() {
    setForm((value) => ({ ...value, imageUrl: "" }));
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutationInFlightRef.current || uploadInFlightRef.current) return;
    if (!form.imageUrl) {
      setActionError(text("اختر صورة الإعلان أولاً.", "Choose an ad image first."));
      return;
    }
    mutationInFlightRef.current = true;
    setSaving(true);
    setActionError("");
    setNotice("");
    try {
      const result = await ownerSaveAdPlacement(canManage, {
        id: form.id,
        expectedVersion: form.expectedVersion,
        name: form.name,
        placementPage: form.placementPage,
        imageUrl: form.imageUrl,
        destinationUrl: form.destinationUrl,
        startsAt: fromLocalDateTimeInput(form.startsAt),
        endsAt: fromLocalDateTimeInput(form.endsAt),
        status: form.status,
        priority: Number(form.priority || 0),
        targetMobile: form.targetMobile,
        targetDesktop: form.targetDesktop,
      });
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setNotice(
        form.id
          ? text("تم تحديث المساحة الإعلانية وتسجيل العملية.", "Placement updated and audited.")
          : text("تم إنشاء المساحة الإعلانية وتسجيل العملية.", "Placement created and audited."),
      );
      setForm(emptyForm);
      setStatusReason("");
      await refresh();
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function changeStatus(placement: AdPlacementSummary, status: AdPlacementStatus) {
    if (mutationInFlightRef.current) return;
    const reason = statusReason.trim();
    if (reason.length < 3) {
      setActionError(
        text("اكتب سبباً واضحاً لتغيير الحالة.", "Enter a clear reason for the status change."),
      );
      return;
    }
    mutationInFlightRef.current = true;
    setSaving(true);
    setActionError("");
    setNotice("");
    try {
      const result = await ownerSetAdPlacementStatus(canManage, {
        id: placement.id,
        status,
        expectedVersion: placement.version,
        reason,
      });
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setPlacements((current) =>
        current.map((item) => (item.id === placement.id ? { ...item, status } : item)),
      );
      setStatusReason("");
      setNotice(text("تم تغيير الحالة وتسجيل السبب.", "Status changed and reason audited."));
      await refresh();
    } finally {
      mutationInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleteInFlight || mutationInFlightRef.current) return;
    const reason = deleteReason.trim();
    if (reason.length < 3) {
      setActionError(text("اكتب سبباً واضحاً للحذف.", "Enter a clear reason for deletion."));
      return;
    }
    mutationInFlightRef.current = true;
    setDeleteInFlight(true);
    setActionError("");
    setNotice("");
    try {
      const result = await ownerDeleteAdPlacement(canManage, {
        id: pendingDelete.id,
        expectedVersion: pendingDelete.version,
        reason,
      });
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setPlacements((current) => current.filter((item) => item.id !== pendingDelete.id));
      if (form.id === pendingDelete.id) resetForm();
      setPendingDelete(null);
      setDeleteReason("");
      setNotice(text("تم حذف المساحة الإعلانية وتسجيل العملية.", "Placement deleted and audited."));
    } finally {
      mutationInFlightRef.current = false;
      setDeleteInFlight(false);
    }
  }

  if (!canManage) {
    return (
      <section className="rounded-2xl bg-card p-5 text-center hairline">
        <ShieldAlert className="mx-auto h-7 w-7 text-warning" />
        <h2 className="mt-3 text-base font-extrabold">
          {text("إدارة المساحات الإعلانية للمالك فقط", "Ad placement management is owner-only")}
        </h2>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-5 hairline shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold">
              {text("إدارة المساحات الإعلانية", "Ad placements")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "ارفع صورة الإعلان مباشرة، ثم حدد مكان العرض والجدولة والأجهزة المستهدفة.",
                "Upload the ad image directly, then choose placement, schedule, and target devices.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rawaj-chip gap-2 px-3 py-2 text-xs font-bold"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {text("تحديث", "Refresh")}
          </button>
        </div>
      </section>

      {actionError && <Notice tone="error">{actionError}</Notice>}
      {loadError && hasLoaded ? (
        <Notice tone="error">
          {loadError}{" "}
          <button type="button" onClick={() => void refresh()} className="underline">
            {text("إعادة المحاولة", "Try again")}
          </button>
        </Notice>
      ) : null}
      {notice && <Notice tone="success">{notice}</Notice>}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <form onSubmit={(event) => void submit(event)} className="rounded-2xl bg-card p-5 hairline">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold">
              {form.id
                ? text("تعديل المساحة", "Edit placement")
                : text("مساحة جديدة", "New placement")}
            </h3>
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                {text("جديدة", "New")}
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={text("اسم داخلي", "Internal name")}>
              <input
                value={form.name}
                onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
                required
                className="input"
              />
            </Field>
            <Field label={text("المكان", "Placement page")}>
              <select
                value={form.placementPage}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    placementPage: event.target.value as AdPlacementPage,
                  }))
                }
                className="input"
              >
                {placementPages.map((page) => (
                  <option key={page.value} value={page.value}>
                    {text(page.ar, page.en)}
                  </option>
                ))}
              </select>
            </Field>

            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-[11px] font-bold text-muted-foreground">
                {text("صورة الإعلان", "Ad image")}
              </span>
              <label className="group flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-primary/25 bg-muted-surface/55 p-4 text-center transition hover:border-primary/50 hover:bg-primary/5">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={uploadingImage}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void handleImageSelection(file);
                  }}
                />
                {uploadingImage ? (
                  <>
                    <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    <strong className="mt-3 text-sm">
                      {text("جارٍ رفع الصورة...", "Uploading image...")}
                    </strong>
                  </>
                ) : form.imageUrl ? (
                  <div className="w-full">
                    <img
                      src={form.imageUrl}
                      alt={text("معاينة صورة الإعلان", "Ad image preview")}
                      className="aspect-[16/7] w-full rounded-xl object-cover"
                    />
                    <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-primary">
                      <Upload className="h-4 w-4" />
                      {text("تغيير الصورة", "Change image")}
                    </span>
                  </div>
                ) : (
                  <>
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Upload className="h-5 w-5" />
                    </span>
                    <strong className="mt-3 text-sm">
                      {text("اختر صورة الإعلان من جهازك", "Choose the ad image from your device")}
                    </strong>
                    <span className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      {text("JPG أو PNG أو WebP — حتى 5MB", "JPG, PNG, or WebP — up to 5MB")}
                    </span>
                  </>
                )}
              </label>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] leading-5 text-muted-foreground">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-warning" />
                {text(
                  "المقاس المطلوب: 16:7 تقريباً، بحد أدنى 960×420 بكسل.",
                  "Required: ~16:7 ratio, minimum 960×420 px.",
                )}
              </p>
              {form.imageUrl ? (
                <button
                  type="button"
                  onClick={clearImage}
                  disabled={uploadingImage}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {text("إزالة الصورة المحددة", "Remove selected image")}
                </button>
              ) : null}
            </div>

            <Field label={text("رابط الوجهة", "Destination URL")} wide>
              <input
                value={form.destinationUrl}
                onChange={(event) =>
                  setForm((value) => ({ ...value, destinationUrl: event.target.value }))
                }
                type="url"
                placeholder="https://rawa-j.com/..."
                required
                className="input"
              />
            </Field>
            <Field label={text("بداية العرض", "Start time")}>
              <input
                value={form.startsAt}
                onChange={(event) =>
                  setForm((value) => ({ ...value, startsAt: event.target.value }))
                }
                type="datetime-local"
                className="input"
              />
            </Field>
            <Field label={text("نهاية العرض", "End time")}>
              <input
                value={form.endsAt}
                onChange={(event) => setForm((value) => ({ ...value, endsAt: event.target.value }))}
                type="datetime-local"
                className="input"
              />
            </Field>
            <Field label={text("الحالة", "Status")}>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    status: event.target.value as AdPlacementStatus,
                  }))
                }
                className="input"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </Field>
            <Field label={text("الأولوية 0–1000", "Priority 0–1000")}>
              <input
                value={form.priority}
                onChange={(event) =>
                  setForm((value) => ({ ...value, priority: event.target.value }))
                }
                type="number"
                min={0}
                max={1000}
                className="input"
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <TargetToggle
              active={form.targetMobile}
              icon={Smartphone}
              label={text("جوال", "Mobile")}
              onClick={() => setForm((value) => ({ ...value, targetMobile: !value.targetMobile }))}
            />
            <TargetToggle
              active={form.targetDesktop}
              icon={Monitor}
              label={text("سطح المكتب", "Desktop")}
              onClick={() =>
                setForm((value) => ({ ...value, targetDesktop: !value.targetDesktop }))
              }
            />
          </div>

          <button
            type="submit"
            disabled={saving || uploadingImage || !form.imageUrl}
            className="rawaj-button-primary mt-5 min-h-11 w-full rounded-xl px-4 py-2.5 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? text("جارٍ الحفظ", "Saving") : text("حفظ المساحة", "Save placement")}
          </button>
        </form>

        <section className="rounded-2xl bg-card p-5 hairline">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-extrabold">{text("معاينة", "Preview")}</h3>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl bg-muted-surface hairline">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt="" className="aspect-[16/7] w-full object-cover" />
            ) : (
              <div className="grid aspect-[16/7] place-items-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Meta label={text("المكان", "Page")} value={form.placementPage} />
            <Meta label={text("الأولوية", "Priority")} value={form.priority || "0"} />
            <Meta label={text("الحالة", "Status")} value={form.status} />
            <Meta
              label={text("الأجهزة", "Devices")}
              value={`${form.targetMobile ? "M" : ""}${form.targetDesktop ? "D" : ""}` || "—"}
            />
          </div>
        </section>
      </section>

      <section className="rounded-2xl bg-card p-5 hairline">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold">
            {text("المساحات الحالية", "Current placements")}
          </h3>
          <input
            value={statusReason}
            onChange={(event) => setStatusReason(event.target.value)}
            placeholder={text("سبب تغيير الحالة", "Status change reason")}
            className="input max-w-sm"
          />
        </div>

        {loading && !hasLoaded ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {text("جارٍ التحميل...", "Loading...")}
          </p>
        ) : loadError && !hasLoaded ? (
          <div className="mt-4 rounded-xl bg-destructive/10 p-4 text-xs text-destructive">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-2 font-bold underline"
            >
              {text("إعادة المحاولة", "Try again")}
            </button>
          </div>
        ) : placements.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {text("لا توجد مساحات إعلانية بعد.", "No ad placements yet.")}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {placements.map((placement) => (
              <article
                key={placement.id}
                className={`rounded-2xl p-4 hairline ${
                  selected?.id === placement.id
                    ? "bg-primary/5 ring-2 ring-primary/20"
                    : "bg-muted-surface/55"
                }`}
              >
                <div className="flex gap-3">
                  <img
                    src={placement.imageUrl}
                    alt=""
                    className="h-20 w-28 shrink-0 rounded-xl object-cover hairline"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-extrabold">{placement.name}</h4>
                      <span className="rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline">
                        {placement.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {placement.placementPage} · P{placement.priority} · v{placement.version}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {placement.destinationUrl}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => editPlacement(placement)}
                    className="rawaj-chip px-3 py-2 text-xs font-bold"
                  >
                    {text("تعديل", "Edit")}
                  </button>
                  {placement.status !== "active" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus(placement, "active")}
                      className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {text("تفعيل", "Activate")}
                    </button>
                  )}
                  {placement.status !== "paused" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus(placement, "paused")}
                      className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      {text("إيقاف", "Pause")}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving || deleteInFlight}
                    onClick={() => {
                      setDeleteReason("");
                      setActionError("");
                      setPendingDelete(placement);
                    }}
                    className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {text("حذف", "Delete")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!deleteInFlight) setPendingDelete(null);
          }}
        >
          <section
            className="w-full max-w-md rounded-2xl bg-card p-5 hairline shadow-soft"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <Trash2 className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-extrabold">
                {text("حذف المساحة الإعلانية", "Delete ad placement")}
              </h3>
            </div>
            <dl className="mt-4 space-y-2 rounded-xl bg-muted-surface p-3 text-xs hairline">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{text("الاسم", "Name")}</dt>
                <dd className="truncate font-bold">{pendingDelete.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{text("المكان", "Page")}</dt>
                <dd className="truncate font-bold">{pendingDelete.placementPage}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{text("النسخة", "Version")}</dt>
                <dd className="truncate font-bold">v{pendingDelete.version}</dd>
              </div>
            </dl>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[11px] font-bold text-muted-foreground">
                {text("سبب الحذف (لأغراض التدقيق)", "Deletion reason (for audit)")}
              </span>
              <textarea
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                rows={2}
                disabled={deleteInFlight}
                className="w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
              />
            </label>
            {actionError && (
              <p className="mt-2 text-xs font-semibold text-destructive">{actionError}</p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={deleteInFlight}
                onClick={() => setPendingDelete(null)}
                className="flex-1 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
              >
                {text("إلغاء", "Cancel")}
              </button>
              <button
                type="button"
                disabled={deleteInFlight || deleteReason.trim().length < 3}
                onClick={() => void confirmDelete()}
                className="flex-1 rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60"
              >
                {deleteInFlight
                  ? text("جارٍ الحذف", "Deleting")
                  : text("حذف نهائي", "Delete permanently")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-[11px] font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function TargetToggle({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Smartphone;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold hairline ${
        active ? "bg-primary text-primary-foreground" : "bg-muted-surface text-muted-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted-surface p-3 hairline">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-bold">{value}</div>
    </div>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return (
    <div
      className={`rounded-xl p-3 text-xs font-semibold hairline ${
        tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
      }`}
    >
      {children}
    </div>
  );
}

function toLocalDateTimeInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
