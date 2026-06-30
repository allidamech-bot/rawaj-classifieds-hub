import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, FileCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/admin/promotions")({
  component: PromotionsPage,
});

const requests = [
  {
    id: "PR-1007",
    listing: "سيارة كيا",
    seller: "أحمد",
    planAr: "7 أيام",
    planEn: "7 days",
    statusAr: "بانتظار المراجعة",
    statusEn: "Awaiting review",
    amount: "50,000 ل.س",
  },
  {
    id: "PR-1008",
    listing: "شقة للإيجار",
    seller: "مكتب الشام",
    planAr: "14 يوم",
    planEn: "14 days",
    statusAr: "إثبات دفع مرفق",
    statusEn: "Proof attached",
    amount: "90,000 ل.س",
  },
  {
    id: "PR-1009",
    listing: "هاتف سامسونج",
    seller: "متجر الساحل",
    planAr: "3 أيام",
    planEn: "3 days",
    statusAr: "قيد المراجعة",
    statusEn: "Under review",
    amount: "25,000 ل.س",
  },
];

function PromotionsPage() {
  const { language, text } = useUiPreferences();
  const [notice, setNotice] = useState("");

  function localAction(ar: string, en: string) {
    setNotice(text(ar, en));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-card p-4 hairline">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <Sparkles className="h-4 w-4 text-gold" />
          {text("إدارة طلبات الترويج", "Promotion request management")}
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          {text(
            "راجع طلبات التمييز والدفع اليدوي كواجهة إدارية كاملة. لا تنفذ هذه الصفحة دفعاً أو تفعيل تمييز حقيقي من الخادم.",
            "Review featuring and manual-payment requests in a complete admin interface. This page does not execute payment or server-side featuring activation.",
          )}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [text("طلبات", "Requests"), requests.length],
          [text("قيد المراجعة", "Under review"), 2],
          [text("إثبات دفع", "Payment proof"), 1],
          [text("نشط محلياً", "Local active"), 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-card p-3 hairline">
            <div className="text-xl font-extrabold">{value}</div>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {requests.map((request) => (
          <article key={request.id} className="rounded-2xl bg-card p-4 hairline">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold">{request.listing}</h3>
                <p className="text-xs text-muted-foreground">
                  {request.id} · {request.seller}
                </p>
              </div>
              <Badge>{language === "ar" ? request.statusAr : request.statusEn}</Badge>
            </div>
            <dl className="grid grid-cols-1 gap-1 text-xs">
              <Metric
                label={text("الخطة", "Plan")}
                value={language === "ar" ? request.planAr : request.planEn}
              />
              <Metric label={text("المبلغ", "Amount")} value={request.amount} />
              <Metric
                label={text("طريقة الدفع", "Payment method")}
                value={text("مراجعة يدوية", "Manual review")}
              />
              <Metric
                label={text("حالة الطلب", "Request status")}
                value={language === "ar" ? request.statusAr : request.statusEn}
              />
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                [text("مراجعة الإثبات", "Review proof"), "proof"],
                [text("قبول", "Approve"), "approve"],
                [text("رفض", "Reject"), "reject"],
                [text("تمييز محلي", "Local feature"), "feature"],
              ].map(([label, value]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    localAction(
                      "تم تسجيل قرار الترويج في الواجهة فقط.",
                      "Promotion decision recorded in the interface only.",
                    )
                  }
                  className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold"
                >
                  {label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl bg-card p-4 hairline">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
          <CreditCard className="h-4 w-4 text-primary" />
          {text("الدفع اليدوي", "Manual payment")}
        </h3>
        <p className="text-xs leading-6 text-muted-foreground">
          {text(
            "أي تحويل أو إثبات دفع يحتاج مراجعة خارجية واضحة قبل تفعيل الترويج الحقيقي.",
            "Any transfer or proof of payment requires clear external review before real featuring is activated.",
          )}
        </p>
      </section>

      <section className="rounded-2xl bg-card p-4 hairline">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
          <FileCheck className="h-4 w-4 text-primary" />
          {text("حالة التمييز", "Featured status")}
        </h3>
        <p className="text-xs leading-6 text-muted-foreground">
          {text(
            "تظهر قرارات التمييز هنا كحالة واجهة ولا تعني تفعيل إعلان مميز على الخادم.",
            "Featuring decisions appear here as interface state and do not activate server-side featuring.",
          )}
        </p>
      </section>

      {notice && (
        <p className="rounded-2xl bg-emerald-trust/10 p-3 text-center text-xs font-bold text-emerald-trust hairline">
          {notice}
        </p>
      )}
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg bg-muted-surface px-2 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-start font-bold">{value}</dd>
    </div>
  );
}
