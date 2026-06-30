import { createFileRoute } from "@tanstack/react-router";
import { Flag, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { demoNotice, reports } from "@/data/adminMockData";
import { adminFetchReports, adminModerateReport } from "@/lib/classifieds-api";
import type { ClassifiedsError, ListingReport, ListingReportStatus } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

const summary = [
  ["بلاغات جديدة", "12"],
  ["قيد المراجعة", "9"],
  ["مرتفعة الخطورة", "4"],
  ["تم الحل", "31"],
];

function ReportsPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [realReports, setRealReports] = useState<ListingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function loadReports() {
    setLoading(true);
    setError(null);
    const result = await adminFetchReports(auth.canAccessOwnerControls);

    if (!result.ok) {
      setError(result.error);
      setRealReports([]);
    } else {
      setRealReports(result.data);
      setNotes(
        Object.fromEntries(result.data.map((report) => [report.id, report.adminNote ?? ""])),
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const result = await adminFetchReports(auth.canAccessOwnerControls);

      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        setRealReports([]);
      } else {
        setRealReports(result.data);
        setNotes(
          Object.fromEntries(result.data.map((report) => [report.id, report.adminNote ?? ""])),
        );
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [auth.canAccessOwnerControls]);

  async function moderate(report: ListingReport, status: ListingReportStatus) {
    setMessage("");
    if (!auth.profile?.id) {
      setMessage(
        text(
          "تعذر تحديد حساب المراجع الحالي. أعد تسجيل الدخول ثم حاول مجدداً.",
          "Could not identify the current reviewer account. Log in again and try once more.",
        ),
      );
      return;
    }

    const result = await adminModerateReport(auth.canAccessOwnerControls, {
      reportId: report.id,
      status,
      assignedTo: auth.profile.id,
      adminNote: notes[report.id] ?? null,
      resolvedAt: status === "resolved" || status === "rejected" ? new Date().toISOString() : null,
    });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setMessage(text("تم تحديث البلاغ.", "Report updated."));
    await loadReports();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
        {text(
          "البلاغات الحقيقية تُقرأ من مصدر البيانات للمالك فقط. أي إجراء لاحق يجب أن يبقى محمياً بالصلاحيات وسجل النشاط.",
          "Real reports are read from the data source for the owner only. Any future action must remain protected by permissions and activity logs.",
        )}{" "}
        {uiLabel(demoNotice, language)}
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
          <Flag className="h-4 w-4 text-destructive" />
          {uiLabel("ملخص البلاغات", language)}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-card p-3 hairline">
              <div className="text-xl font-extrabold">{value}</div>
              <p className="text-xs text-muted-foreground">{uiLabel(label, language)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-card p-4 hairline">
        <h2 className="mb-2 flex items-center gap-2 text-base font-extrabold">
          <Flag className="h-4 w-4 text-destructive" />
          {uiLabel("بلاغات حقيقية", language)}
        </h2>
        {message && (
          <p className="mb-2 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{message}</p>
        )}
        {loading ? (
          <p className="text-xs text-muted-foreground">
            {uiLabel("جارٍ تحميل البلاغات.", language)}
          </p>
        ) : error ? (
          <p className="text-xs text-muted-foreground">
            {uiLabel(
              "البلاغات الحقيقية قيد التفعيل حالياً. ستظهر البلاغات هنا عند اكتمال الربط التشغيلي.",
              language,
            )}
          </p>
        ) : realReports.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {uiLabel("لا توجد بلاغات حقيقية حالياً.", language)}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {realReports.map((report) => (
              <article key={report.id} className="rounded-xl bg-muted-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold">{report.reportType}</h3>
                  <Badge>{uiLabel(report.status, language)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {text("رقم البلاغ:", "Report ID:")} {report.id}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {text("الإعلان:", "Listing:")} {report.listingId} ·{" "}
                  {text("المبلّغ:", "Reporter:")} {report.reporterId}
                </p>
                <p className="mt-2 text-xs">{report.reason}</p>
                <textarea
                  value={notes[report.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [report.id]: event.target.value }))
                  }
                  placeholder={text("ملاحظة إدارية", "Admin note")}
                  rows={2}
                  className="mt-3 w-full rounded-xl bg-card px-3 py-2 text-xs outline-none hairline"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void moderate(report, "under_review")}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    {uiLabel("قيد المراجعة", language)}
                  </button>
                  <button
                    onClick={() => void moderate(report, "resolved")}
                    className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                  >
                    {uiLabel("تم الحل", language)}
                  </button>
                  <button
                    onClick={() => void moderate(report, "rejected")}
                    className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                  >
                    {uiLabel("رفض البلاغ", language)}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <p className="xl:col-span-2 rounded-2xl bg-card p-3 text-xs text-muted-foreground hairline">
          {uiLabel("القائمة التالية نموذج UI تجريبي فقط وليست بلاغات إنتاج.", language)}{" "}
          {uiLabel(demoNotice, language)}
        </p>
        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl bg-card p-4 hairline">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold">{report.type}</h3>
                  <Badge>{uiLabel(report.severity, language)}</Badge>
                  <Badge>{uiLabel(report.status, language)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{report.id}</p>
              </div>
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </div>
            <Info
              rows={[
                ["الإعلان/المستخدم المبلّغ", report.target],
                ["مبلّغ تجريبي", report.reporter],
                ["السبب", uiLabel(report.reason, language)],
                ["وقت الإنشاء", uiLabel(report.created, language)],
                ["الحالة", uiLabel(report.status, language)],
                ["الخطورة", uiLabel(report.severity, language)],
                ["المشرف المعيّن", uiLabel(report.admin, language)],
                ["ملاحظة داخلية", uiLabel(report.note, language)],
              ]}
              language={language}
            />
            <ActionRow
              actions={[
                "فتح البلاغ",
                "تغيير الحالة",
                "إخفاء الإعلان",
                "تجميد المستخدم",
                "طلب مراجعة المالك",
                "إضافة ملاحظة",
              ]}
              language={language}
            />
            <InternalNote language={language} />
          </article>
        ))}
      </section>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function Info({ rows, language }: { rows: string[][]; language: Language }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-muted-surface p-3">
          <dt className="text-muted-foreground">{uiLabel(label, language)}</dt>
          <dd className="mt-1 font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionRow({ actions, language }: { actions: string[]; language: Language }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action}
          disabled
          className="rounded-md bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground opacity-70 cursor-not-allowed"
        >
          {uiLabel(action, language)} · {uiLabel("نموذج تجريبي", language)}
        </button>
      ))}
    </div>
  );
}

function InternalNote({ language }: { language: Language }) {
  return (
    <div className="mt-3 rounded-xl bg-muted-surface p-3 text-xs">
      <b>{uiLabel("ملاحظة داخلية", language)}</b>
      <p className="mt-1 text-muted-foreground">
        {uiLabel("أضيفت بواسطة: مشرف تجريبي · التاريخ: قيد التجهيز · الحالة: غير مفعّلة", language)}
      </p>
      <button
        disabled
        className="mt-2 rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline cursor-not-allowed"
      >
        {uiLabel("إضافة ملاحظة · قريباً", language)}
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {uiLabel("الملاحظات الداخلية لا تظهر للمستخدمين.", language)}
      </p>
    </div>
  );
}
