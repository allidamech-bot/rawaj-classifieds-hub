import { createFileRoute } from "@tanstack/react-router";
import { Check, X, Clock } from "lucide-react";
import { listings } from "@/data/mockData";

export const Route = createFileRoute("/admin/pending")({
  component: PendingPage,
});

function PendingPage() {
  const pending = listings.slice(0, 6);
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-card p-3 hairline text-xs text-muted-foreground">
        {pending.length} إعلان بانتظار المراجعة (بيانات تجريبية).
      </div>
      {pending.map((l) => (
        <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3 hairline">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold">{l.title}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                <Clock className="h-3 w-3" /> بانتظار المراجعة
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              #{l.id} · {l.categoryName} · {l.governorate} · {l.sellerName}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button disabled title="غير مفعّل — نموذج تجريبي" className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-trust text-emerald-trust-foreground opacity-70 cursor-not-allowed">
              <Check className="h-4 w-4" />
            </button>
            <button disabled title="غير مفعّل — نموذج تجريبي" className="grid h-9 w-9 place-items-center rounded-lg bg-destructive text-destructive-foreground opacity-70 cursor-not-allowed">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <p className="text-center text-[11px] text-muted-foreground">
        إجراءات الموافقة/الرفض ستُفعَّل عند ربط نظام الإدارة الفعلي.
      </p>
    </div>
  );
}
