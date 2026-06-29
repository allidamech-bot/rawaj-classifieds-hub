import { createFileRoute } from "@tanstack/react-router";
import { Flag, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { demoNotice, reports } from "@/data/adminMockData";
import { adminFetchReports } from "@/lib/classifieds-api";
import type { ClassifiedsError, ListingReport } from "@/lib/classifieds-types";
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
  const [realReports, setRealReports] = useState<ListingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

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
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [auth.canAccessOwnerControls]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
        البلاغات الحقيقية تُقرأ من Supabase للمالك فقط. أي إجراء لاحق يجب أن يبقى محمياً بـ RLS وسجل
        نشاط. {demoNotice}
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
          <Flag className="h-4 w-4 text-destructive" />
          ملخص البلاغات
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-card p-3 hairline">
              <div className="text-xl font-extrabold">{value}</div>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-card p-4 hairline">
        <h2 className="mb-2 flex items-center gap-2 text-base font-extrabold">
          <Flag className="h-4 w-4 text-destructive" />
          بلاغات حقيقية من Supabase
        </h2>
        {loading ? (
          <p className="text-xs text-muted-foreground">جارٍ تحميل البلاغات.</p>
        ) : error ? (
          <p className="text-xs text-muted-foreground">{error.message}</p>
        ) : realReports.length === 0 ? (
          <p className="text-xs text-muted-foreground">لا توجد بلاغات حقيقية حالياً.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {realReports.map((report) => (
              <article key={report.id} className="rounded-xl bg-muted-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold">{report.reportType}</h3>
                  <Badge>{report.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Report ID: {report.id}</p>
                <p className="mt-2 text-xs">{report.reason}</p>
                <ActionRow actions={["تغيير الحالة", "طلب مراجعة المالك", "إضافة ملاحظة"]} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <p className="xl:col-span-2 rounded-2xl bg-card p-3 text-xs text-muted-foreground hairline">
          القائمة التالية نموذج UI تجريبي فقط وليست بلاغات إنتاج. {demoNotice}
        </p>
        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl bg-card p-4 hairline">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold">{report.type}</h3>
                  <Badge>{report.severity}</Badge>
                  <Badge>{report.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{report.id}</p>
              </div>
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </div>
            <Info
              rows={[
                ["Reported listing/user", report.target],
                ["Reporter placeholder", report.reporter],
                ["Reason", report.reason],
                ["Created time", report.created],
                ["Status", report.status],
                ["Severity", report.severity],
                ["Assigned admin", report.admin],
                ["Internal note", report.note],
              ]}
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
            />
            <InternalNote />
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

function Info({ rows }: { rows: string[][] }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-muted-surface p-3">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="mt-1 font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionRow({ actions }: { actions: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action}
          disabled
          className="rounded-md bg-destructive px-2 py-1 text-[10px] font-bold text-destructive-foreground opacity-70 cursor-not-allowed"
        >
          {action} · نموذج تجريبي
        </button>
      ))}
    </div>
  );
}

function InternalNote() {
  return (
    <div className="mt-3 rounded-xl bg-muted-surface p-3 text-xs">
      <b>ملاحظة داخلية</b>
      <p className="mt-1 text-muted-foreground">
        أضيفت بواسطة: مشرف تجريبي · التاريخ: placeholder · الحالة: غير مفعّلة
      </p>
      <button
        disabled
        className="mt-2 rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline cursor-not-allowed"
      >
        إضافة ملاحظة · قريباً
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">
        الملاحظات الداخلية لا تظهر للمستخدمين.
      </p>
    </div>
  );
}
