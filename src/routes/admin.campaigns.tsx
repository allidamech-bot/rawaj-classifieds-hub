import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Eye,
  Image as ImageIcon,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ownerFetchCampaignCreatives,
  ownerFetchCampaigns,
  ownerSaveCampaign,
  ownerSaveCampaignCreative,
  ownerSetCampaignStatus,
  type AdPlacementPage,
  type CampaignCreativeSummary,
  type CampaignStatus,
  type CampaignSummary,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/campaigns")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: CampaignManagerPage,
});

const pageOptions: Array<{ value: AdPlacementPage; ar: string; en: string }> = [
  { value: "home", ar: "الرئيسية", en: "Home" },
  { value: "search_results", ar: "نتائج البحث", en: "Search results" },
  { value: "listing_detail", ar: "صفحة الإعلان", en: "Listing detail" },
  { value: "categories", ar: "الأقسام", en: "Categories" },
  { value: "offers", ar: "العروض", en: "Offers" },
];

interface CampaignFormState {
  id: string | null;
  expectedVersion: number | null;
  name: string;
  status: CampaignStatus;
  startsAt: string;
  endsAt: string;
  targetPages: AdPlacementPage[];
  categoryIdsText: string;
}

interface CreativeFormState {
  id: string | null;
  expectedVersion: number | null;
  campaignId: string;
  name: string;
  imageUrl: string;
  destinationUrl: string;
  weight: string;
  isActive: boolean;
}

const emptyCampaign: CampaignFormState = {
  id: null,
  expectedVersion: null,
  name: "",
  status: "draft",
  startsAt: "",
  endsAt: "",
  targetPages: [],
  categoryIdsText: "",
};

const emptyCreative: CreativeFormState = {
  id: null,
  expectedVersion: null,
  campaignId: "",
  name: "",
  imageUrl: "",
  destinationUrl: "",
  weight: "100",
  isActive: true,
};

function CampaignManagerPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const canManage = auth.hasPermission("canManageAdCampaigns");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [creatives, setCreatives] = useState<CampaignCreativeSummary[]>([]);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(emptyCampaign);
  const [creativeForm, setCreativeForm] = useState<CreativeFormState>(emptyCreative);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusReason, setStatusReason] = useState("");

  async function refreshCampaigns() {
    setLoading(true);
    const result = await ownerFetchCampaigns(canManage);
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCampaigns(result.data);
    setError("");
  }

  async function refreshCreatives(campaignId: string) {
    const result = await ownerFetchCampaignCreatives(canManage, campaignId);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCreatives(result.data);
  }

  useEffect(() => {
    let cancelled = false;
    void ownerFetchCampaigns(canManage).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCampaigns(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [canManage]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === campaignForm.id) ?? null,
    [campaignForm.id, campaigns],
  );

  function resetCampaignForm() {
    setCampaignForm(emptyCampaign);
    setCreativeForm(emptyCreative);
    setCreatives([]);
    setError("");
    setNotice("");
  }

  function editCampaign(campaign: CampaignSummary) {
    setCampaignForm({
      id: campaign.id,
      expectedVersion: campaign.version,
      name: campaign.name,
      status: campaign.status,
      startsAt: toLocalDateTimeInput(campaign.startsAt),
      endsAt: toLocalDateTimeInput(campaign.endsAt),
      targetPages: campaign.targetPages,
      categoryIdsText: campaign.targetCategoryIds.join(", "),
    });
    setCreativeForm({ ...emptyCreative, campaignId: campaign.id });
    setError("");
    setNotice("");
    void refreshCreatives(campaign.id);
  }

  function toggleTargetPage(page: AdPlacementPage) {
    setCampaignForm((current) => ({
      ...current,
      targetPages: current.targetPages.includes(page)
        ? current.targetPages.filter((value) => value !== page)
        : [...current.targetPages, page],
    }));
  }

  async function saveCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");

    const result = await ownerSaveCampaign(canManage, {
      id: campaignForm.id,
      expectedVersion: campaignForm.expectedVersion,
      name: campaignForm.name,
      status: campaignForm.status,
      startsAt: fromLocalDateTimeInput(campaignForm.startsAt),
      endsAt: fromLocalDateTimeInput(campaignForm.endsAt),
      targetPages: campaignForm.targetPages,
      targetCategoryIds: [
        ...new Set(
          campaignForm.categoryIdsText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ],
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    const campaignId = result.data.id;
    setNotice(
      campaignForm.id
        ? text("تم تحديث الحملة وتسجيل العملية.", "Campaign updated and audited.")
        : text("تم إنشاء الحملة وتسجيل العملية.", "Campaign created and audited."),
    );
    const refreshed = await ownerFetchCampaigns(canManage);
    if (refreshed.ok) {
      setCampaigns(refreshed.data);
      const campaign = refreshed.data.find((item) => item.id === campaignId);
      if (campaign) editCampaign(campaign);
    }
  }

  async function changeStatus(campaign: CampaignSummary, status: CampaignStatus) {
    if (saving) return;
    const reason = statusReason.trim();
    if (reason.length < 3) {
      setError(
        text(
          "اكتب سبباً واضحاً لتغيير حالة الحملة.",
          "Enter a clear reason for the status change.",
        ),
      );
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const result = await ownerSetCampaignStatus(canManage, {
      id: campaign.id,
      status,
      expectedVersion: campaign.version,
      reason,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setStatusReason("");
    setNotice(text("تم تغيير حالة الحملة وتسجيل السبب.", "Campaign status changed and audited."));
    await refreshCampaigns();
  }

  function editCreative(creative: CampaignCreativeSummary) {
    setCreativeForm({
      id: creative.id,
      expectedVersion: creative.version,
      campaignId: creative.campaignId,
      name: creative.name,
      imageUrl: creative.imageUrl,
      destinationUrl: creative.destinationUrl,
      weight: String(creative.weight),
      isActive: creative.isActive,
    });
  }

  async function saveCreative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignForm.id || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    const result = await ownerSaveCampaignCreative(canManage, {
      id: creativeForm.id,
      expectedVersion: creativeForm.expectedVersion,
      campaignId: campaignForm.id,
      name: creativeForm.name,
      imageUrl: creativeForm.imageUrl,
      destinationUrl: creativeForm.destinationUrl,
      weight: Number(creativeForm.weight || 100),
      isActive: creativeForm.isActive,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCreativeForm({ ...emptyCreative, campaignId: campaignForm.id });
    setNotice(text("تم حفظ التصميم الإعلاني وتسجيل العملية.", "Creative saved and audited."));
    await refreshCreatives(campaignForm.id);
    await refreshCampaigns();
  }

  if (!canManage) {
    return (
      <section className="rounded-2xl bg-card p-5 text-center hairline">
        <ShieldAlert className="mx-auto h-7 w-7 text-warning" />
        <h2 className="mt-3 text-base font-extrabold">
          {text("إدارة الحملات للمالك فقط", "Campaign management is owner-only")}
        </h2>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-5 hairline shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold">{text("مدير الحملات", "Campaign manager")}</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "أنشئ حملات متعددة التصاميم مع الجدولة والاستهداف والإيقاف الفوري. الأرقام أدناه مشتقة فقط من أحداث انطباع ونقر مسجلة فعلياً.",
                "Create multi-creative campaigns with scheduling, targeting, and immediate pause. Metrics below come only from recorded impression and click events.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshCampaigns()}
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <form
          onSubmit={(event) => void saveCampaign(event)}
          className="rounded-2xl bg-card p-5 hairline"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold">
              {campaignForm.id
                ? text("تعديل الحملة", "Edit campaign")
                : text("حملة جديدة", "New campaign")}
            </h3>
            {campaignForm.id && (
              <button
                type="button"
                onClick={resetCampaignForm}
                className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                {text("جديدة", "New")}
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={text("اسم الحملة", "Campaign name")} wide>
              <input
                value={campaignForm.name}
                onChange={(event) =>
                  setCampaignForm((value) => ({ ...value, name: event.target.value }))
                }
                required
                className="input"
              />
            </Field>
            <Field label={text("الحالة", "Status")}>
              <select
                value={campaignForm.status}
                onChange={(event) =>
                  setCampaignForm((value) => ({
                    ...value,
                    status: event.target.value as CampaignStatus,
                  }))
                }
                className="input"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="ended">Ended</option>
              </select>
            </Field>
            <Field label={text("بداية الحملة", "Start time")}>
              <input
                value={campaignForm.startsAt}
                onChange={(event) =>
                  setCampaignForm((value) => ({ ...value, startsAt: event.target.value }))
                }
                type="datetime-local"
                className="input"
              />
            </Field>
            <Field label={text("نهاية الحملة", "End time")}>
              <input
                value={campaignForm.endsAt}
                onChange={(event) =>
                  setCampaignForm((value) => ({ ...value, endsAt: event.target.value }))
                }
                type="datetime-local"
                className="input"
              />
            </Field>
            <Field label={text("معرفات الأقسام المستهدفة", "Target category IDs")} wide>
              <input
                value={campaignForm.categoryIdsText}
                onChange={(event) =>
                  setCampaignForm((value) => ({ ...value, categoryIdsText: event.target.value }))
                }
                placeholder={text(
                  "افصل المعرفات بفواصل؛ اتركها فارغة لكل الأقسام",
                  "Comma-separated IDs; blank targets all categories",
                )}
                className="input"
              />
            </Field>
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-bold text-muted-foreground">
              {text(
                "الصفحات المستهدفة — اتركها بلا تحديد لكل الصفحات",
                "Target pages — leave empty for all pages",
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {pageOptions.map((page) => (
                <button
                  key={page.value}
                  type="button"
                  onClick={() => toggleTargetPage(page.value)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold hairline ${
                    campaignForm.targetPages.includes(page.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted-surface text-muted-foreground"
                  }`}
                >
                  {text(page.ar, page.en)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rawaj-button-primary mt-5 min-h-11 w-full rounded-xl px-4 py-2.5 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? text("جارٍ الحفظ", "Saving") : text("حفظ الحملة", "Save campaign")}
          </button>
        </form>

        <section className="rounded-2xl bg-card p-5 hairline">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-extrabold">
              {text("القياس الحقيقي", "Measured performance")}
            </h3>
          </div>
          {selectedCampaign ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric
                icon={Eye}
                label={text("انطباعات", "Impressions")}
                value={selectedCampaign.impressions}
              />
              <Metric
                icon={MousePointerClick}
                label={text("نقرات", "Clicks")}
                value={selectedCampaign.clicks}
              />
              <Metric icon={BarChart3} label="CTR" value={`${selectedCampaign.ctr.toFixed(2)}%`} />
              <Metric
                icon={ImageIcon}
                label={text("تصاميم", "Creatives")}
                value={selectedCampaign.creativeCount}
              />
            </div>
          ) : (
            <p className="mt-4 text-xs leading-6 text-muted-foreground">
              {text(
                "اختر حملة موجودة لعرض المقاييس المسجلة فعلياً.",
                "Select an existing campaign to view recorded metrics.",
              )}
            </p>
          )}
        </section>
      </section>

      <section className="rounded-2xl bg-card p-5 hairline">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-extrabold">{text("الحملات الحالية", "Current campaigns")}</h3>
          <input
            value={statusReason}
            onChange={(event) => setStatusReason(event.target.value)}
            placeholder={text("سبب تغيير الحالة", "Status change reason")}
            className="input max-w-sm"
          />
        </div>

        {loading ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {text("جارٍ التحميل...", "Loading...")}
          </p>
        ) : campaigns.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {text("لا توجد حملات بعد.", "No campaigns yet.")}
          </p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <article key={campaign.id} className="rounded-2xl bg-muted-surface/55 p-4 hairline">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-extrabold">{campaign.name}</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {campaign.status} · v{campaign.version} · {campaign.creativeCount} creatives
                    </p>
                  </div>
                  <span className="rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline">
                    {campaign.ctr.toFixed(2)}% CTR
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <SmallMetric
                    label={text("انطباعات", "Impressions")}
                    value={campaign.impressions}
                  />
                  <SmallMetric label={text("نقرات", "Clicks")} value={campaign.clicks} />
                  <SmallMetric label="CTR" value={`${campaign.ctr.toFixed(2)}%`} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => editCampaign(campaign)}
                    className="rawaj-chip px-3 py-2 text-xs font-bold"
                  >
                    {text("فتح", "Open")}
                  </button>
                  {campaign.status !== "active" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus(campaign, "active")}
                      className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {text("تفعيل", "Activate")}
                    </button>
                  )}
                  {campaign.status !== "paused" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus(campaign, "paused")}
                      className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      {text("إيقاف فوري", "Pause now")}
                    </button>
                  )}
                  {campaign.status !== "ended" && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void changeStatus(campaign, "ended")}
                      className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold"
                    >
                      <Square className="h-3.5 w-3.5" />
                      {text("إنهاء", "End")}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {campaignForm.id && (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form
            onSubmit={(event) => void saveCreative(event)}
            className="rounded-2xl bg-card p-5 hairline"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold">
                {creativeForm.id
                  ? text("تعديل التصميم", "Edit creative")
                  : text("تصميم جديد", "New creative")}
              </h3>
              {creativeForm.id && (
                <button
                  type="button"
                  onClick={() =>
                    setCreativeForm({ ...emptyCreative, campaignId: campaignForm.id ?? "" })
                  }
                  className="rawaj-chip px-3 py-2 text-xs font-bold"
                >
                  {text("جديد", "New")}
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label={text("اسم التصميم", "Creative name")} wide>
                <input
                  value={creativeForm.name}
                  onChange={(event) =>
                    setCreativeForm((value) => ({ ...value, name: event.target.value }))
                  }
                  required
                  className="input"
                />
              </Field>
              <Field label={text("رابط الصورة", "Image URL")} wide>
                <input
                  value={creativeForm.imageUrl}
                  onChange={(event) =>
                    setCreativeForm((value) => ({ ...value, imageUrl: event.target.value }))
                  }
                  type="url"
                  required
                  className="input"
                />
              </Field>
              <Field label={text("رابط الوجهة", "Destination URL")} wide>
                <input
                  value={creativeForm.destinationUrl}
                  onChange={(event) =>
                    setCreativeForm((value) => ({ ...value, destinationUrl: event.target.value }))
                  }
                  type="url"
                  required
                  className="input"
                />
              </Field>
              <Field label={text("الوزن 1–1000", "Weight 1–1000")}>
                <input
                  value={creativeForm.weight}
                  onChange={(event) =>
                    setCreativeForm((value) => ({ ...value, weight: event.target.value }))
                  }
                  type="number"
                  min={1}
                  max={1000}
                  className="input"
                />
              </Field>
              <label className="flex items-end">
                <button
                  type="button"
                  onClick={() =>
                    setCreativeForm((value) => ({ ...value, isActive: !value.isActive }))
                  }
                  className={`min-h-11 w-full rounded-xl px-3 py-2 text-xs font-bold hairline ${
                    creativeForm.isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted-surface"
                  }`}
                >
                  {creativeForm.isActive
                    ? text("التصميم نشط", "Creative active")
                    : text("التصميم متوقف", "Creative inactive")}
                </button>
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rawaj-button-primary mt-5 min-h-11 w-full rounded-xl px-4 py-2.5 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {text("حفظ التصميم", "Save creative")}
            </button>
          </form>

          <section className="rounded-2xl bg-card p-5 hairline">
            <h3 className="text-sm font-extrabold">
              {text("تصاميم الحملة", "Campaign creatives")}
            </h3>
            {creatives.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">
                {text("لا توجد تصاميم بعد.", "No creatives yet.")}
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {creatives.map((creative) => (
                  <button
                    key={creative.id}
                    type="button"
                    onClick={() => editCreative(creative)}
                    className="grid gap-3 rounded-2xl bg-muted-surface/55 p-3 text-start hairline sm:grid-cols-[120px_1fr]"
                  >
                    <img
                      src={creative.imageUrl}
                      alt=""
                      className="aspect-[16/9] w-full rounded-xl object-cover hairline"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-extrabold">{creative.name}</h4>
                        <span className="rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline">
                          {creative.isActive ? "active" : "inactive"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        W{creative.weight} · v{creative.version}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold">
                        <span>{creative.impressions.toLocaleString()} imp</span>
                        <span>{creative.clicks.toLocaleString()} clicks</span>
                        <span>{creative.ctr.toFixed(2)}% CTR</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>
      )}
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

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl bg-muted-surface p-4 hairline">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-lg font-extrabold">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-card p-2 hairline">
      <div className="text-xs font-extrabold">
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="mt-1 text-[9px] text-muted-foreground">{label}</div>
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
