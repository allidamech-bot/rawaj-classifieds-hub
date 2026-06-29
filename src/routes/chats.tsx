import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, ShieldAlert, Clock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { listings } from "@/data/mockData";

export const Route = createFileRoute("/chats")({
  head: () => ({ meta: [{ title: "الرسائل | رَوَاج" }] }),
  component: ChatsPage,
});

const mockChats = [
  { id: "c1", listingId: "11", last: "هل ما زال متوفراً؟", time: "قبل 5 د" },
  { id: "c2", listingId: "6", last: "متى يمكن المعاينة؟", time: "أمس" },
];

function ChatsPage() {
  return (
    <>
      <PageHeader title="الرسائل" />
      <main className="container-wide pt-4">
        <div className="mb-3 flex items-start gap-3 rounded-2xl bg-warning/10 p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs font-medium">حافظ على تواصلك ضمن التطبيق، ولا تحوّل المال قبل الاطلاع على السلعة.</p>
        </div>

        {mockChats.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {mockChats.map((c) => {
              const l = listings.find((x) => x.id === c.listingId);
              if (!l) return null;
              return (
                <li key={c.id}>
                  <Link to="/listings/$id" params={{ id: l.id }} className="flex items-center gap-3 rounded-2xl bg-card p-3 hairline transition hover:shadow-soft">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                      {l.sellerName.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{l.sellerName}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground"><Clock className="me-1 inline h-3 w-3" />{c.time}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{l.title}</div>
                      <div className="mt-1 truncate text-sm">{c.last}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <span className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-muted-surface text-muted-foreground">
        <MessageCircle className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-bold">لا توجد رسائل حالياً</p>
      <p className="mt-1 text-xs text-muted-foreground">عندما تتواصل مع بائع ستظهر المحادثات هنا.</p>
    </div>
  );
}
