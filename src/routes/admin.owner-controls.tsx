import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertOctagon,
  BadgeCheck,
  LockKeyhole,
  MessageSquareOff,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Siren,
  UserCog,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ownerFetchSystemControls,
  ownerSetSystemControl,
  type OwnerSystemControlKey,
  type OwnerSystemControlSummary,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/owner-controls")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: OwnerControlsPage,
});

const controlMeta: Record<
  OwnerSystemControlKey,
  {
    ar: string;
    en: string;
    detailAr: string;
    detailEn: string;
    icon: typeof Siren;
    danger?: boolean;
  }
> = {
  freeze_new_listings: {
    ar: "تجميد الإعلانات الجديدة",
    en: "Freeze new listings",
    detailAr: "يمنع إنشاء إعلانات جديدة، بينما يبقى تصفح الإعلانات الحالية متاحًا.",
    detailEn: "Blocks new listing creation while existing listings remain available to browse.",
    icon: ShoppingBag,
  },
  freeze_new_messages: {
    ar: "تجميد الرسائل الجديدة",
    en: "Freeze new messages",
    detailAr: "يمنع إرسال محادثات ورسائل ومرفقات جديدة، دون حذف المحادثات الموجودة.",
    detailEn: "Blocks new conversations, messages, and attachments without deleting existing chats.",
    icon: MessageSquareOff,
  },
  freeze_promotions: {
    ar: "تجميد الترويج",
    en: "Freeze promotions",
    detailAr: "يوقف استقبال طلبات ترويج الإعلانات الجديدة مؤقتًا.",
    detailEn: "Temporarily stops new listing-promotion requests.",
    icon: PauseCircle,
  },
  freeze_verifications: {
    ar: "تجميد التوثيق",
    en: "Freeze verifications",
    detailAr: "يوقف استقبال طلبات توثيق الحسابات الجديدة مؤقتًا.",
    detailEn: "Temporarily stops new account-verification submissions.",
    icon: BadgeCheck,
  },
  maintenance_mode: {
    ar: "الموقع تحت الصيانة",
    en: "Website maintenance mode",
    detailAr:
      "يعرض تنبيهًا أعلى جميع الصفحات ويوقف عمليات الإضافة والتعديل والإرسال مؤقتًا، مع بقاء التصفح متاحًا.",
    detailEn:
      "Shows a notice across every page and temporarily blocks create, update, and send operations while browsing remains available.",
    icon: Wrench,
    danger: true,
  },
  emergency_read_only: {
    ar: "القراءة فقط للطوارئ",
    en: "Emergency read-only",
    detailAr:
      "يوقف جميع عمليات الكتابة فورًا ويُبقي الموقع للقراءة والتصفح فقط. يُستخدم للحالات الطارئة.",
    detailEn:
      "Immediately blocks all write operations and leaves the website available for reading only. Use for emergencies.",
    icon: AlertOctagon,
    danger: true,
  },
};

function OwnerControlsPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const canManage = auth.hasPermission("canManageSystemSettings");
  const [controls, setControls] = useState<OwnerSystemControlSummary[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<OwnerSystemControlKey | null>(null);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const requestIdRef = useRef(0);
  const toggleInFlightRef = useRef<Set<OwnerSystemControlKey>>(new Set());

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");
    const result = await ownerFetchSystemControls(canManage);
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error.message);
      return;
    }
    setControls(result.data);
    setHasLoaded(true);
  }, [canManage]);

  useEffect(() => {
    requestIdRef.current += 1;
    setControls([]);
    setHasLoaded(false);
    setLoadError("");
    void refresh();
    return () => {
      requestIdRef.current += 1;
      toggleInFlightRef.current.clear();
    };
  }, [refresh]);

  async function toggle(control: OwnerSystemControlSummary) {
    if (toggleInFlightRef.current.has(control.key)) return;
    toggleInFlightRef.current.add(control.key);
    setBusyKey(control.key);
    setActionError("");
    setNotice("");
    const nextEnabled = !control.enabled;
    try {
      const result = await ownerSetSystemControl(canManage, {
        key: control.key,
        enabled: nextEnabled,
        reason,
        expectedVersion: control.version,
      });
      if (!result.ok) {
        setActionError(result.error.message);
        return;
      }
      setControls((current) =>
        current.map((item) =>
          item.key === control.key
            ? { ...item, enabled: nextEnabled, reason, version: item.version + 1 }
            : item,
        ),
      );
      setReason("");
      setNotice(
        text(
          "تم تغيير مفتاح النظام وتسجيل العملية في سجل التدقيق.",
          "System control changed and audited.",
        ),
      );
      if (control.key === "maintenance_mode") {
        window.dispatchEvent(new Event("rawaj:system-control-changed"));
      }
      await refresh();
    } finally {
      toggleInFlightRef.current.delete(control.key);
      setBusyKey((current) => (current === control.key ? null : current));
    }
  }

  if (!canManage) {
    return (
      <section className="rounded-2xl bg-card p-5 text-center hairline">
        <LockKeyhole className="mx-auto h-7 w-7 text-warning" />
        <h2 className="mt-3 text-base font-extrabold">
          {text("هذه الصفحة للمالك فقط", "This page is owner-only")}
        </h2>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-premium">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warning text-warning-foreground">
              <Siren className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold text-primary-foreground/70">
                {text("صلاحيات المالك الحساسة", "Sensitive owner authority")}
              </p>
              <h2 className="mt-1 text-xl font-extrabold">
                {text("مركز تحكم النظام", "System controls")}
              </h2>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-primary-foreground/80">
                {text(
                  "مفاتيح طوارئ وتشغيل حساسة. كل تغيير يتطلب سبباً ويُسجل مع نسخة لمنع الكتابة القديمة.",
                  "Sensitive operational and emergency switches. Every change requires a reason, is audited, and uses stale-write protection.",
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {text("تحديث", "Refresh")}
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-warning/10 p-4 hairline">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs leading-6">
            {text(
              "هذه المفاتيح مرتبطة بمسارات Cloudflare الحالية: وضع الصيانة والقراءة فقط يوقفان عمليات الكتابة العامة، أما بقية المفاتيح فتوقف العملية المحددة فقط.",
              "These switches are enforced by the current Cloudflare paths: maintenance and read-only block general write operations, while the other switches block only their named operation.",
            )}
          </p>
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

      <section className="rounded-2xl bg-card p-5 hairline">
        <label>
          <span className="mb-2 block text-xs font-bold text-muted-foreground">
            {text("سبب التغيير الإلزامي", "Required change reason")}
          </span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={text("اكتب سبباً تشغيلياً واضحاً", "Enter a clear operational reason")}
            className="input"
          />
        </label>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {loading && !hasLoaded ? (
          <p className="text-xs text-muted-foreground">{text("جارٍ التحميل...", "Loading...")}</p>
        ) : loadError && !hasLoaded ? (
          <div className="rounded-2xl bg-card p-5 text-center hairline md:col-span-2">
            <p className="text-sm font-bold">
              {text("تعذر تحميل مفاتيح النظام", "Could not load system controls")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{loadError}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              {text("إعادة المحاولة", "Try again")}
            </button>
          </div>
        ) : (
          controls.map((control) => (
            <ControlCard
              key={control.key}
              control={control}
              busy={busyKey === control.key}
              onToggle={() => void toggle(control)}
              text={text}
            />
          ))
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          icon={UserCog}
          label={text("إدارة الطاقم", "Staff management")}
          to="/admin/users"
        />
        <QuickLink
          icon={ShieldAlert}
          label={text("مركز السلامة", "Safety center")}
          to="/admin/safety"
        />
        <QuickLink icon={LockKeyhole} label={text("سجل التدقيق", "Audit log")} to="/admin/audit" />
      </section>
    </div>
  );
}

function ControlCard({
  control,
  busy,
  onToggle,
  text,
}: {
  control: OwnerSystemControlSummary;
  busy: boolean;
  onToggle: () => void;
  text: (ar: string, en: string) => string;
}) {
  const meta = controlMeta[control.key];
  const Icon = meta.icon;
  return (
    <article
      className={`rounded-2xl p-4 hairline ${control.enabled ? "bg-warning/10" : "bg-card"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-11 w-11 place-items-center rounded-xl ${meta.danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${control.enabled ? "bg-warning text-warning-foreground" : "bg-muted-surface text-muted-foreground"}`}
        >
          {control.enabled ? text("مفعّل", "Enabled") : text("متوقف", "Off")}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-extrabold">{text(meta.ar, meta.en)}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {text(meta.detailAr, meta.detailEn)}
      </p>
      {control.reason && (
        <p className="mt-3 rounded-xl bg-muted-surface p-3 text-[11px] leading-5 hairline">
          {control.reason}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
        <span>v{control.version}</span>
        <span>{new Date(control.updatedAt).toLocaleString()}</span>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onToggle}
        className={`mt-4 min-h-11 w-full rounded-xl px-4 py-2 text-xs font-extrabold hairline disabled:opacity-50 ${
          control.enabled
            ? "bg-card text-foreground"
            : meta.danger
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground"
        }`}
      >
        {control.enabled ? text("إلغاء التفعيل", "Disable") : text("تفعيل", "Enable")}
      </button>
    </article>
  );
}

function QuickLink({ icon: Icon, label, to }: { icon: typeof UserCog; label: string; to: string }) {
  return (
    <Link
      to={to as "/admin"}
      className="flex items-center gap-3 rounded-2xl bg-card p-4 text-sm font-bold transition hairline hover:bg-muted-surface"
    >
      <Icon className="h-5 w-5 text-primary" />
      {label}
    </Link>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return (
    <div
      className={`rounded-xl p-3 text-xs font-semibold hairline ${tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}
    >
      {children}
    </div>
  );
}
