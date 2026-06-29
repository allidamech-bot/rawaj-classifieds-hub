import { createFileRoute } from "@tanstack/react-router";
import { Flag, ShieldAlert } from "lucide-react";
import { demoNotice, reports } from "@/data/adminMockData";

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
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
        إجراءات البلاغات تحتاج Backend وصلاحيات حقيقية عند التفعيل. {demoNotice}
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

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
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
