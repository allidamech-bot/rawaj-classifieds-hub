import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Check, X } from "lucide-react";

export const Route = createFileRoute("/admin/promotions")({
  component: PromotionsPage,
});

const reqs = [
  { id: "P-501", l: "تويوتا كورولا 2018", p: "شارة (مميز)", days: 7, pay: "بانتظار الإثبات", status: "جديد" },
  { id: "P-502", l: "آيفون 13 برو 256GB", p: "ظهور في الرئيسية", days: 14, pay: "قيد المراجعة", status: "قيد المراجعة" },
  { id: "P-503", l: "شقة للإيجار في المزة", p: "ظهور أعلى القسم", days: 3, pay: "—", status: "جديد" },
];

function PromotionsPage() {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-card p-3 hairline text-xs text-muted-foreground">
        طلبات الترويج — للعرض فقط. الموافقة/الرفض غير مفعّلة.
      </div>
      {reqs.map((r) => (
        <div key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3 hairline">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold/15 text-gold">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold">{r.l}</span>
              <span className="shrink-0 rounded-md bg-muted-surface px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">#{r.id}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {r.p} · {r.days} يوم · حالة الدفع: {r.pay} · {r.status}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button disabled title="غير مفعّل" className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-trust text-emerald-trust-foreground opacity-70 cursor-not-allowed">
              <Check className="h-4 w-4" />
            </button>
            <button disabled title="غير مفعّل" className="grid h-9 w-9 place-items-center rounded-lg bg-destructive text-destructive-foreground opacity-70 cursor-not-allowed">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
