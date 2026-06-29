import { createFileRoute } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { listings } from "@/data/mockData";

export const Route = createFileRoute("/admin/pending")({
  component: PendingPage,
});

function PendingPage() {
  const pending = listings.slice(0, 6);
  return (
    <div className="space-y-2">
      {pending.map((l) => (
        <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3 hairline">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{l.title}</div>
            <div className="text-xs text-muted-foreground">{l.categoryName} · {l.governorate} · {l.sellerName}</div>
          </div>
          <div className="flex gap-1.5">
            <button className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-trust text-emerald-trust-foreground"><Check className="h-4 w-4"/></button>
            <button className="grid h-9 w-9 place-items-center rounded-lg bg-destructive text-destructive-foreground"><X className="h-4 w-4"/></button>
          </div>
        </div>
      ))}
    </div>
  );
}
