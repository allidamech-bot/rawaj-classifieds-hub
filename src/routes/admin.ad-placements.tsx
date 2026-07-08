import { createFileRoute } from "@tanstack/react-router";
import {
  Eye,
  Image as ImageIcon,
  Monitor,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ownerFetchAdPlacements,
  ownerSaveAdPlacement,
  ownerSetAdPlacementStatus,
  type AdPlacementPage,
  type AdPlacementStatus,
  type AdPlacementSummary,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusReason, setStatusReason] = useState("");

  async function refresh() {
    setLoading(true);
    const result = await ownerFetchAdPlacements(canManage);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setPlacements(result.data);
    setError("");
  }

  useEffect(() => {
    let cancelled = false;
    void ownerFetchAdPlacements(canManage).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setPlacements(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [canManage]);

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
    setError("");
    setNotice("");
  }

  function resetForm() {
    setForm(emptyForm);
    setStatusReason("");
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");

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

    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setNotice(
      form.id
        ? text("تم تحديث المساحة الإعلانية وتسجيل العملية.", "Placement updated and audited.")
        : text("تم إنشاء المساحة الإعلانية وتسجيل العملية.", "Placement created and audited."),
    );
    resetForm();
    await refresh();
  }

  async function changeStatus(placement: AdPlacementSummary, status: AdPlacementStatus) {
    const reason = statusReason.trim();
    if (reason.length < 3) {
      setError(text("اكتب سبباً واضحاً لتغيير الحالة.", "Enter a clear reason for the status change."));
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const result = await ownerSetAdPlacementStatus(canManage, {
      id: placement.id,
      status,
      expectedVersion: placement.version,
      reason,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setStatusReason("");
    setNotice(text("تم تغيير الحالة وتسجيل السبب.", "Status changed and reason audited."));
    await refresh();
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
                "أنشئ وحدد الجدولة والأولوية والأجهزة المستهدفة. لا تُعرض أرقام نقرات أو مشاهدات غير مقاسة.",
                "Create placements with scheduling, priority, and device targeting. No unmeasured click or impression numbers are shown.",
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

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <form onSubmit={(event) => void submit(event)} className="rounded-2xl bg-card p-5 hairline">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold">
              {form.id ? text("تعديل المساحة", "Edit placement") : text("مساحة جديدة", "New placement")}
            </h3>
            {form.id && (
              <button type="button" onClick={resetForm} className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold">
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
                  setForm((value) => ({ ...value, placementPage: event.target.value as AdPlacementPage }))
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
            <Field label={text("رابط صورة/بانر", "Image/banner URL")} wide>
              <input
                value={form.imageUrl}
                onChange={(event) => setForm((value) => ({ ...value, imageUrl: event.target.value }))}
                type="url"
                required
                className="input"
              />
            </Field>
            <Field label={text("رابط الوجهة", "Destination URL")} wide>
              <input
                value={form.destinationUrl}
                onChange={(event) => setForm((value) => ({ ...value, destinationUrl: event.target.value }))}
                type="url"
                required
                className="input"
              />
            </Field>
            <Field label={text("بداية العرض", "Start time")}>
              <input
                value={form.startsAt}
                onChange={(event) => setForm((value) => ({ ...value, startsAt: event.target.value }))}
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
                  setForm((value) => ({ ...value, status: event.target.value as AdPlacementStatus }))
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
                onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value }))}
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
              onClick={() => setForm((value) => ({ ...value, targetDesktop: !value.targetDesktop }))}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
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
          <h3 className="text-sm font-extrabold">{text("المساحات الحالية", "Current placements")}</h3>
          <input
            value={statusReason}
            onChange={(event) => setStatusReason(event.target.value)}
            placeholder={text("سبب تغيير الحالة", "Status change reason")}
            className="input max-w-sm"
          />
        </div>

        {loading ? (
          <p className="mt-4 text-xs text-muted-foreground">{text("جارٍ التحميل...", "Loading...")}</p>
        ) : placements.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {text("لا توجد مساحات إعلانية بعد.", "No ad placements yet.")}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {placements.map((placement) => (
              <article
                key={placement.id}
                className={`rounded-2xl p-4 hairline ${selected?.id === placement.id ? "bg-primary/5 ring-2 ring-primary/20" : "bg-muted-surface/55"}`}
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
                  <button type="button" onClick={() => editPlacement(placement)} className="rawaj-chip px-3 py-2 text-xs font-bold">
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
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
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
