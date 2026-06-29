import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, FileCheck, Sparkles } from "lucide-react";
import { demoNotice, featuredListingQueue, promotions } from "@/data/adminMockData";

export const Route = createFileRoute("/admin/promotions")({
  component: PromotionsPage,
});

const summary = [
  ["طلبات جديدة", "18"],
  ["بانتظار إثبات الدفع", "9"],
  ["قيد المراجعة", "11"],
  ["مفعّلة", "24"],
  ["مرفوضة", "4"],
  ["منتهية", "17"],
];

function PromotionsPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
        لا توجد معالجة دفع حقيقية حالياً. تفاصيل التحويل وإثبات الدفع حقول تجريبية فقط. {demoNotice}
      </div>

      <section>
        <Title icon={Sparkles} text="ملخص طلبات الترويج" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-card p-3 hairline">
              <div className="text-xl font-extrabold">{value}</div>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Title icon={CreditCard} text="مراجعة طلبات الترويج وإثبات الدفع" />
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          {promotions.map((request) => (
            <article key={request.requestId} className="rounded-2xl bg-card p-4 hairline">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold">{request.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {request.requestId} · {request.listingId}
                  </p>
                </div>
                <Badge>{request.status}</Badge>
              </div>
              <Info
                rows={[
                  ["البائع", request.seller],
                  ["نوع حساب البائع", request.type],
                  ["الخطة المطلوبة", request.plan],
                  ["المدة", request.duration],
                  ["المبلغ", `${request.amount} ${request.currency}`],
                  ["حالة الدفع", request.payment],
                  ["مرجع التحويل", request.ref],
                  ["حالة إثبات الدفع", request.proof],
                  ["المراجع", request.reviewer],
                  ["تحتاج موافقة المالك", request.owner],
                  ["ملاحظات", request.notes],
                ]}
              />
              <ActionRow
                actions={[
                  "مراجعة الإثبات",
                  "قبول الترويج",
                  "رفض الترويج",
                  "تفعيل التمييز",
                  "طلب مراجعة المالك",
                  "إضافة ملاحظة داخلية",
                ]}
              />
              <InternalNote />
            </article>
          ))}
        </div>
      </section>

      <section>
        <Title icon={FileCheck} text="إدارة حالة تمييز الإعلانات" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {featuredListingQueue.map((item) => (
            <article key={item.listingId} className="rounded-2xl bg-card p-4 hairline">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {item.listingId} · {item.seller}
                  </p>
                </div>
                <Badge>{item.featured}</Badge>
              </div>
              <Info
                rows={[
                  ["القسم", item.category],
                  ["المحافظة", item.governorate],
                  ["حالة الإعلان", item.status],
                  ["مدة الترويج", item.duration],
                  ["تاريخ البداية/النهاية", item.dates],
                  ["حالة الدفع", item.payment],
                  ["المراجع الإداري", item.reviewer],
                  ["موافقة المالك مطلوبة", item.owner],
                  ["ملاحظة المشرف", item.note],
                ]}
              />
              <ActionRow
                actions={[
                  "تمييز الإعلان",
                  "إزالة التمييز",
                  "تمديد التمييز",
                  "رفض طلب التمييز",
                  "طلب مراجعة المالك",
                  "إضافة ملاحظة",
                ]}
              />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Title({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
      <Icon className="h-4 w-4 text-primary" />
      {text}
    </h2>
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
    <dl className="grid grid-cols-1 gap-1 text-xs">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between gap-3 rounded-lg bg-muted-surface px-2 py-1.5"
        >
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-start font-bold">{value}</dd>
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
          className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground cursor-not-allowed"
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
        أضيفت بواسطة: مشرف تجريبي · التاريخ: placeholder · الحالة: قيد المراجعة
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
