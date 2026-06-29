import { createFileRoute } from "@tanstack/react-router";
import { Flag, UserX, ListX } from "lucide-react";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

const listingReports = [
  { r: "محتوى مضلل", listing: "آيفون 13 برو 256GB", listingId: "L-1042", by: "user_812", status: "جديد" },
  { r: "سعر مشبوه", listing: "شقة للإيجار في المزة", listingId: "L-1018", by: "user_341", status: "قيد المراجعة" },
  { r: "إعلان مكرر", listing: "بلايستيشن 5 مع يدين", listingId: "L-1099", by: "user_215", status: "جديد" },
];

const sellerReports = [
  { r: "محاولة احتيال", seller: "بائع غير معروف", sellerId: "U-77", by: "user_402", status: "جديد" },
  { r: "إساءة في الرسائل", seller: "متجر النجمة", sellerId: "U-31", by: "user_115", status: "قيد المراجعة" },
];

function ReportsPage() {
  return (
    <div className="space-y-5">
      <Section title="بلاغات على إعلانات" icon={ListX} items={listingReports.map((x) => ({
        title: x.r,
        sub: `إعلان: ${x.listing} · #${x.listingId} · من: ${x.by}`,
        status: x.status,
      }))} />
      <Section title="بلاغات على بائعين" icon={UserX} items={sellerReports.map((x) => ({
        title: x.r,
        sub: `بائع: ${x.seller} · #${x.sellerId} · من: ${x.by}`,
        status: x.status,
      }))} />
      <p className="text-center text-[11px] text-muted-foreground">
        إجراءات المراجعة/الإغلاق/التصعيد ستُفعَّل عند ربط لوحة الإدارة بالخادم.
      </p>
    </div>
  );
}

function Section({ title, icon: Icon, items }: { title: string; icon: typeof Flag; items: { title: string; sub: string; status: string }[] }) {
  return (
    <section>
      <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-extrabold">
        <Icon className="h-4 w-4 text-destructive" /> {title}
      </h3>
      <div className="space-y-2">
        {items.map((r, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3 hairline">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-destructive/10 text-destructive">
              <Flag className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{r.title}</div>
              <div className="truncate text-xs text-muted-foreground">{r.sub}</div>
            </div>
            <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {r.status}
            </span>
            <button disabled title="غير مفعّل" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground opacity-70 cursor-not-allowed">
              مراجعة · قريباً
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
