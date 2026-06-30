import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, ShieldAlert, Sparkles, UserCog } from "lucide-react";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/admin/promotions")({
  component: PromotionsPage,
});

function PromotionsPage() {
  const { text } = useUiPreferences();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-card p-5 hairline">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold">
              {text("إدارة الترويج", "Promotion management")}
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {text(
                "إدارة طلبات الترويج والدفع تحتاج واجهات خادم آمنة قبل عرض الطلبات أو المبالغ أو إثباتات الدفع أو تنفيذ الموافقة.",
                "Promotion and payment management requires safe server APIs before requests, amounts, payment proof, or approval actions are shown.",
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard
          icon={<CreditCard className="h-4 w-4" />}
          title={text("الدفع", "Payment")}
          body={text(
            "لا تعرض اللوحة مبالغ أو إثباتات دفع دون مصدر محمي يربط الطلب بالإعلان والبائع.",
            "The dashboard does not show amounts or payment proof without a protected source tied to the listing and seller.",
          )}
        />
        <InfoCard
          icon={<Sparkles className="h-4 w-4" />}
          title={text("تمييز الإعلانات", "Featuring")}
          body={text(
            "تفعيل التمييز يحتاج مسار مراجعة محفوظ وصلاحيات إدارية قبل تعديل أي إعلان.",
            "Featuring requires a stored review flow and admin permissions before any listing is changed.",
          )}
        />
      </section>

      <section className="rounded-2xl bg-warning/10 p-4 text-xs leading-6 hairline">
        <ShieldAlert className="me-1 inline h-4 w-4 text-warning" />
        {text(
          "لا توجد في هذه الصفحة موافقة أو رفض أو تفعيل دفع من الواجهة. كل إجراء فعلي يجب أن يبقى خلف واجهة خادم محمية.",
          "This page does not approve, reject, or activate payment from the interface. Every real action must stay behind a protected server API.",
        )}
      </section>

      <Link
        to="/admin"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
      >
        <UserCog className="h-4 w-4" />
        {text("العودة للوحة الإدارة", "Back to admin dashboard")}
      </Link>
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 hairline">
      <h3 className="inline-flex items-center gap-2 text-sm font-extrabold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}
