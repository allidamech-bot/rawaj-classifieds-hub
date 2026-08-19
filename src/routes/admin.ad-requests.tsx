import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ExternalLink,
  Inbox,
  Megaphone,
  MonitorSmartphone,
  RefreshCw,
  Store,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  fetchAdminAdvertisingRequests,
  updateAdminAdvertisingRequest,
  type AdminAdvertisingRequest,
  type AdvertisingRequestDevice,
  type AdvertisingRequestKind,
} from "@/lib/advertising-request";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/ad-requests")({
  head: () => ({
    meta: [
      { title: "طلبات الإعلان | رواج" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminAdvertisingRequestsPage,
});

type RequestActionStatus = "under_review" | "resolved" | "rejected";

function AdminAdvertisingRequestsPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const canManage = auth.hasPermission("canManageAdPlacements");
  const [requests, setRequests] = useState<AdminAdvertisingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const requestIdRef = useRef(0);
  const mutationInFlightRef = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (!canManage) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");
    const result = await fetchAdminAdvertisingRequests(canManage);
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    if (!result.ok) {
      setLoadError(result.error.message);
      return;
    }
    setRequests(result.data);
    setLoaded(true);
  }, [canManage]);

  useEffect(() => {
    requestIdRef.current += 1;
    setRequests([]);
    setLoaded(false);
    setLoadError("");
    if (canManage) void load();
    return () => {
      requestIdRef.current += 1;
      mutationInFlightRef.current.clear();
    };
  }, [canManage, load]);

  async function changeStatus(request: AdminAdvertisingRequest, status: RequestActionStatus) {
    if (mutationInFlightRef.current.has(request.support.id)) return;
    mutationInFlightRef.current.add(request.support.id);
    setWorkingId(request.support.id);
    setNotice("");
    try {
      const result = await updateAdminAdvertisingRequest(canManage, request, status, {
        publicResponse: customerResponse(status, text),
        priority: status === "under_review" ? "high" : request.support.priority,
      });
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }
      setNotice(actionNotice(status, text));
      await load();
    } finally {
      mutationInFlightRef.current.delete(request.support.id);
      setWorkingId((current) => (current === request.support.id ? null : current));
    }
  }

  if (!canManage) {
    return (
      <section className="rounded-2xl bg-card p-5 text-center hairline">
        <Inbox className="mx-auto h-7 w-7 text-warning" />
        <h1 className="mt-3 text-base font-black">
          {text("لا تملك صلاحية طلبات الإعلان", "No access to advertising requests")}
        </h1>
      </section>
    );
  }

  return (
    <div className="space-y-5" dir={language === "ar" ? "rtl" : "ltr"}>
      <section className="rounded-2xl bg-card p-5 hairline shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-500">
              RAWAJ ADS
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-lg font-black">
              <Inbox className="h-5 w-5 text-amber-500" />
              {text("طلبات الإعلان من العملاء", "Customer advertising requests")}
            </h1>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">
              {text(
                "هذه الطلبات منفصلة عن Boost. راجع المكان والمدة والهدف، ثم جهّز المساحة أو الحملة من وحدات الإدارة الحالية بعد الاتفاق مع العميل.",
                "These requests are separate from Boost. Review placement, duration, and goal, then prepare the placement or campaign in the existing admin tools after agreeing with the customer.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rawaj-chip inline-flex min-h-10 items-center gap-2 px-3 text-xs font-bold"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {text("تحديث", "Refresh")}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/admin/ad-placements"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
          >
            <Store className="h-4 w-4" />
            {text("إدارة المساحات", "Manage placements")}
          </Link>
          <Link
            to="/admin/campaigns"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
          >
            <Megaphone className="h-4 w-4" />
            {text("إدارة الحملات", "Manage campaigns")}
          </Link>
        </div>
      </section>

      {notice ? (
        <p
          role="status"
          className="rounded-xl bg-muted-surface p-3 text-xs font-semibold leading-6 hairline"
        >
          {notice}
        </p>
      ) : null}
      {loadError ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive"
        >
          {loadError}
        </p>
      ) : null}

      {loading && !loaded ? (
        <State title={text("جارٍ تحميل طلبات الإعلان", "Loading advertising requests")} />
      ) : requests.length === 0 ? (
        <State title={text("لا توجد طلبات إعلان حالياً", "No advertising requests right now")} />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <article
              key={request.support.id}
              className="rounded-2xl bg-card p-4 hairline sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-black">
                    {kindLabel(request.details.kind, text)}
                  </h2>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDate(request.support.createdAt, language)}
                  </p>
                </div>
                <Status status={request.support.status} text={text} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Info
                  icon={<CalendarDays />}
                  label={text("المدة", "Duration")}
                  value={`${request.details.requestedDays} ${text("يوم", "days")}`}
                />
                <Info
                  icon={<MonitorSmartphone />}
                  label={text("الأجهزة", "Devices")}
                  value={deviceLabel(request.details.device, text)}
                />
                <Info
                  icon={<UserRound />}
                  label={text("العميل", "Customer")}
                  value={request.support.email || request.support.userId}
                />
                <Info
                  icon={<Store />}
                  label={text("الإعلان المرتبط", "Related listing")}
                  value={request.details.listingId || text("طلب عام", "General request")}
                />
              </div>

              {request.details.destinationUrl ||
              request.details.budgetNote ||
              request.details.customerNote ? (
                <div className="mt-4 rounded-xl bg-muted-surface p-3 text-xs leading-6 hairline">
                  {request.details.destinationUrl ? (
                    <p>
                      <strong>{text("رابط الوجهة", "Destination")}:</strong>{" "}
                      <span className="break-all">{request.details.destinationUrl}</span>
                    </p>
                  ) : null}
                  {request.details.budgetNote ? (
                    <p>
                      <strong>{text("الميزانية", "Budget")}:</strong>{" "}
                      {request.details.budgetNote}
                    </p>
                  ) : null}
                  {request.details.customerNote ? (
                    <p>
                      <strong>{text("ملاحظة العميل", "Customer note")}:</strong>{" "}
                      {request.details.customerNote}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {request.details.listingId ? (
                  <Link
                    to="/listings/$id"
                    params={{ id: request.details.listingId }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {text("فتح الإعلان", "Open listing")}
                  </Link>
                ) : null}
                <Link
                  to={
                    request.details.kind === "campaign"
                      ? "/admin/campaigns"
                      : "/admin/ad-placements"
                  }
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  {request.details.kind === "campaign" ? (
                    <Megaphone className="h-3.5 w-3.5" />
                  ) : (
                    <Store className="h-3.5 w-3.5" />
                  )}
                  {request.details.kind === "campaign"
                    ? text("فتح الحملات", "Open campaigns")
                    : text("فتح المساحات", "Open placements")}
                </Link>
              </div>

              {request.support.status === "new" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={workingId === request.support.id}
                    onClick={() => void changeStatus(request, "under_review")}
                    className="min-h-10 rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    {text("بدء المراجعة", "Start review")}
                  </button>
                </div>
              ) : null}
              {request.support.status === "new" || request.support.status === "under_review" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={workingId === request.support.id}
                    onClick={() => void changeStatus(request, "resolved")}
                    className="min-h-10 rounded-xl bg-emerald-trust px-4 py-2 text-xs font-black text-emerald-trust-foreground disabled:opacity-50"
                  >
                    {text("تمت المراجعة / متابعة مع العميل", "Reviewed / follow up with customer")}
                  </button>
                  <button
                    type="button"
                    disabled={workingId === request.support.id}
                    onClick={() => void changeStatus(request, "rejected")}
                    className="min-h-10 rounded-xl bg-destructive/10 px-4 py-2 text-xs font-black text-destructive disabled:opacity-50"
                  >
                    {text("إغلاق الطلب", "Close request")}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function customerResponse(
  status: RequestActionStatus,
  text: (ar: string, en: string) => string,
): string | null {
  if (status === "resolved") {
    return text(
      "تمت مراجعة طلب الإعلان. سيتواصل معك فريق رواج لإكمال السعر والتجهيز والدفع قبل التفعيل.",
      "Your advertising request was reviewed. The RAWAJ team will contact you to finalize price, setup, and payment before activation.",
    );
  }
  if (status === "rejected") {
    return text(
      "تم إغلاق طلب الإعلان الحالي. يمكنك إرسال طلب جديد بتفاصيل مختلفة في أي وقت.",
      "This advertising request was closed. You can submit a new request with different details at any time.",
    );
  }
  return null;
}

function actionNotice(
  status: RequestActionStatus,
  text: (ar: string, en: string) => string,
): string {
  if (status === "under_review") return text("تم بدء مراجعة الطلب.", "Request moved to review.");
  if (status === "resolved") {
    return text(
      "تمت معالجة الطلب وإرسال الرد للعميل.",
      "Request resolved and customer response saved.",
    );
  }
  return text(
    "تم إغلاق الطلب وإرسال الرد للعميل.",
    "Request closed and customer response saved.",
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted-surface p-3 hairline">
      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <p className="mt-1 break-words text-xs font-bold">{value}</p>
    </div>
  );
}

function State({ title }: { title: string }) {
  return (
    <section className="rounded-2xl bg-card p-7 text-center hairline">
      <Inbox className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="mt-3 text-sm font-black">{title}</p>
    </section>
  );
}

function kindLabel(
  kind: AdvertisingRequestKind,
  text: (ar: string, en: string) => string,
): string {
  if (kind === "home") return text("مساحة إعلانية · الرئيسية", "Ad placement · Home");
  if (kind === "search_results") {
    return text("مساحة إعلانية · نتائج البحث", "Ad placement · Search results");
  }
  if (kind === "categories") {
    return text("مساحة إعلانية · الأقسام", "Ad placement · Categories");
  }
  return text("حملة إعلانية مخصصة", "Custom ad campaign");
}

function deviceLabel(
  device: AdvertisingRequestDevice,
  text: (ar: string, en: string) => string,
): string {
  if (device === "mobile") return text("الجوال فقط", "Mobile only");
  if (device === "desktop") return text("سطح المكتب فقط", "Desktop only");
  return text("الجوال + سطح المكتب", "Mobile + desktop");
}

function Status({
  status,
  text,
}: {
  status: AdminAdvertisingRequest["support"]["status"];
  text: (ar: string, en: string) => string;
}) {
  const label =
    status === "new"
      ? text("جديد", "New")
      : status === "under_review"
        ? text("قيد المراجعة", "Under review")
        : status === "resolved"
          ? text("تمت المعالجة", "Resolved")
          : text("مغلق", "Closed");
  return (
    <span
      data-status={status}
      className="rawaj-advertise-status rounded-full px-2.5 py-1 text-[10px] font-extrabold"
    >
      {label}
    </span>
  );
}

function formatDate(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
