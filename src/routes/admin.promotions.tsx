import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/admin/promotions")({
  component: () => (
    <div className="space-y-2">
      {[
        { l: "تويوتا كورولا 2018 بحالة ممتازة", p: "تمييز إعلان" },
        { l: "آيفون 13 برو 256GB", p: "الظهور في الرئيسية" },
        { l: "شقة للإيجار في المزة", p: "أعلى القسم" },
      ].map((r, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3 hairline">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold/15 text-gold">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{r.l}</div>
            <div className="text-xs text-muted-foreground">{r.p}</div>
          </div>
          <button className="rounded-lg bg-emerald-trust px-3 py-1.5 text-xs font-bold text-emerald-trust-foreground">موافقة</button>
        </div>
      ))}
    </div>
  ),
});
