import { createFileRoute } from "@tanstack/react-router";
import { Flag } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  component: () => (
    <div className="space-y-2">
      {[
        { r: "محتوى مضلل", listing: "آيفون 13 برو 256GB", user: "user_812" },
        { r: "سعر مشبوه", listing: "شقة للإيجار في المزة", user: "user_341" },
        { r: "مكرر", listing: "بلايستيشن 5 مع يدين", user: "user_215" },
      ].map((r, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3 hairline">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <Flag className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{r.r}</div>
            <div className="text-xs text-muted-foreground truncate">على إعلان: {r.listing} · بلاغ من: {r.user}</div>
          </div>
          <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">مراجعة</button>
        </div>
      ))}
    </div>
  ),
});
