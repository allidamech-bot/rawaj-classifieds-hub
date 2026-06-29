import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: () => (
    <div className="space-y-2">
      {[
        { n: "محمد عبد القادر", t: "verified", l: 12 },
        { n: "متجر الذكي", t: "store", l: 38 },
        { n: "مكتب الأمل العقاري", t: "business", l: 24 },
        { n: "أبو خالد", t: "user", l: 3 },
      ].map((u, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3 hairline">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-bold">
            {u.n.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-sm font-bold">
              {u.n}
              {u.t !== "user" && <BadgeCheck className="h-3.5 w-3.5 text-emerald-trust" />}
            </div>
            <div className="text-xs text-muted-foreground">{u.l} إعلان · {u.t}</div>
          </div>
          <button className="rounded-lg bg-card px-3 py-1.5 text-xs font-bold hairline">إدارة</button>
        </div>
      ))}
    </div>
  ),
});
