import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, FileCheck, Sparkles } from "lucide-react";
import { demoNotice, featuredListingQueue, promotions } from "@/data/adminMockData";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

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
  const { language, text } = useUiPreferences();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
        {uiLabel(
          "لا توجد معالجة دفع حقيقية حالياً. تفاصيل التحويل وإثبات الدفع حقول تجريبية فقط.",
          language,
        )}{" "}
        {uiLabel(demoNotice, language)}
      </div>

      <section>
        <Title icon={Sparkles} text={uiLabel("ملخص طلبات الترويج", language)} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {summary.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-card p-3 hairline">
              <div className="text-xl font-extrabold">{value}</div>
              <p className="text-xs text-muted-foreground">{uiLabel(label, language)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Title icon={CreditCard} text={uiLabel("مراجعة طلبات الترويج وإثبات الدفع", language)} />
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
                <Badge>{uiLabel(request.status, language)}</Badge>
              </div>
              <Info
                rows={[
                  ["البائع", request.seller],
                  ["نوع حساب البائع", uiLabel(request.type, language)],
                  ["الخطة المطلوبة", uiLabel(request.plan, language)],
                  ["المدة", uiLabel(request.duration, language)],
                  ["المبلغ", `${request.amount} ${language === "ar" ? request.currency : "SYP"}`],
                  ["حالة الدفع", uiLabel(request.payment, language)],
                  ["مرجع التحويل", uiLabel(request.ref, language)],
                  ["حالة إثبات الدفع", uiLabel(request.proof, language)],
                  ["المراجع", uiLabel(request.reviewer, language)],
                  ["تحتاج موافقة المالك", uiLabel(request.owner, language)],
                  ["ملاحظات", uiLabel(request.notes, language)],
                ]}
                language={language}
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
                language={language}
              />
              <InternalNote language={language} />
            </article>
          ))}
        </div>
      </section>

      <section>
        <Title icon={FileCheck} text={uiLabel("إدارة حالة تمييز الإعلانات", language)} />
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
                <Badge>{uiLabel(item.featured, language)}</Badge>
              </div>
              <Info
                rows={[
                  ["القسم", uiLabel(item.category, language)],
                  ["المحافظة", uiLabel(item.governorate, language)],
                  ["حالة الإعلان", uiLabel(item.status, language)],
                  ["مدة الترويج", uiLabel(item.duration, language)],
                  ["تاريخ البداية/النهاية", uiLabel(item.dates, language)],
                  ["حالة الدفع", uiLabel(item.payment, language)],
                  ["المراجع الإداري", uiLabel(item.reviewer, language)],
                  ["موافقة المالك مطلوبة", uiLabel(item.owner, language)],
                  ["ملاحظة المشرف", uiLabel(item.note, language)],
                ]}
                language={language}
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
                language={language}
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

function Info({ rows, language }: { rows: string[][]; language: Language }) {
  return (
    <dl className="grid grid-cols-1 gap-1 text-xs">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between gap-3 rounded-lg bg-muted-surface px-2 py-1.5"
        >
          <dt className="text-muted-foreground">{uiLabel(label, language)}</dt>
          <dd className="text-start font-bold">{value}</dd>
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
          className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground cursor-not-allowed"
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
      <p className="mt-1 text-muted-foreground">{textForInternal(language)}</p>
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

function textForInternal(language: Language) {
  return language === "ar"
    ? "أضيفت بواسطة: مشرف تجريبي · التاريخ: قيد التجهيز · الحالة: قيد المراجعة"
    : "Added by: demo moderator · date: in preparation · status: under review";
}
