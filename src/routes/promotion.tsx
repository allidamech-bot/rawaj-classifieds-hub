import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, TrendingUp, Home, LayoutTemplate, Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/promotion")({
  head: () => ({ meta: [{ title: "تمييز الإعلان | رَوَاج" }] }),
  component: PromotionPage,
});

const packs = [
  { icon: Sparkles, t: "تمييز الإعلان", d: "ظهور إعلانك بإطار مميز مع شارة (مميز).", price: "—" },
  { icon: TrendingUp, t: "رفع الإعلان", d: "إعادة إعلانك إلى أعلى قائمة الأحدث.", price: "—" },
  { icon: Home, t: "الظهور في الصفحة الرئيسية", d: "عرض إعلانك ضمن قسم الإعلانات المميزة في الصفحة الرئيسية.", price: "—" },
  { icon: LayoutTemplate, t: "الظهور أعلى القسم", d: "تثبيت إعلانك في أعلى نتائج القسم لفترة محددة.", price: "—" },
];

function PromotionPage() {
  return (
    <>
      <PageHeader title="تمييز الإعلان" />
      <main className="container-wide pt-4 pb-8">
        <p className="mb-4 text-sm text-muted-foreground">
          عزّز ظهور إعلانك أمام آلاف المشترين داخل سوريا عبر باقات التمييز.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {packs.map((p) => (
            <div key={p.t} className="rounded-2xl bg-card p-4 hairline shadow-soft">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold">
                  <p.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-extrabold text-foreground">{p.t}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{p.d}</p>
                </div>
              </div>
              <button disabled title="سيُفعَّل لاحقاً" className="mt-4 w-full cursor-not-allowed rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground opacity-60">
                طلب التمييز · قريباً
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-muted-surface p-4 hairline">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">سيتم تفعيل الدفع لاحقاً.</p>
        </div>
      </main>
    </>
  );
}
