import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, ShieldAlert, Clock, Send, Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { listings } from "@/data/mockData";

export const Route = createFileRoute("/chats")({
  head: () => ({ meta: [{ title: "الرسائل | رَوَاج" }] }),
  component: ChatsPage,
});

const mockChats = [
  { id: "c1", listingId: "11", last: "هل ما زال متوفراً؟", time: "قبل 5 د", unread: 2 },
  { id: "c2", listingId: "6", last: "متى يمكن المعاينة؟", time: "أمس", unread: 0 },
];

function ChatsPage() {
  return (
    <>
      <PageHeader title="الرسائل" />
      <main className="container-wide pt-4 pb-8 space-y-4">
        <div className="rounded-2xl bg-warning/10 p-4 hairline">
          <p className="text-xs font-bold mb-1">المحادثات غير مفعّلة حالياً — نموذج تجريبي</p>
          <p className="text-[11px] text-muted-foreground">
            سيتم تفعيل الرسائل بين البائع والمشتري لاحقاً مع ربط المحادثة بالإعلان، تنبيهات أمان،
            وإمكانية الحظر والتبليغ.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-card p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs font-medium">
            حافظ على تواصلك ضمن التطبيق، ولا تحوّل المال قبل الاطلاع على السلعة.
          </p>
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
                  <Link
                    to="/listings/$id"
                    params={{ id: l.id }}
                    className="flex items-center gap-3 rounded-2xl bg-card p-3 hairline transition hover:shadow-soft"
                  >
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                      {l.sellerName.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{l.sellerName}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          <Clock className="me-1 inline h-3 w-3" />
                          {c.time}
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{l.title}</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-sm">{c.last}</span>
                        {c.unread > 0 && (
                          <span className="shrink-0 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-gold-foreground">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {/* Disabled composer preview */}
        <div className="rounded-2xl bg-card p-3 hairline">
          <p className="mb-2 text-[11px] font-bold text-muted-foreground">
            معاينة شريط الرسائل (غير مفعّل)
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-muted-surface p-2 opacity-70">
            <input
              disabled
              placeholder="اكتب رسالتك… — قريباً"
              className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground cursor-not-allowed"
            />
            <button
              disabled
              className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3" /> الإرسال الحقيقي يتطلب تفعيل الحساب والخادم.
          </p>
        </div>
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
      <p className="mt-1 text-xs text-muted-foreground">
        عندما تتواصل مع بائع ستظهر المحادثات هنا.
      </p>
      <Link
        to="/listings"
        className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
      >
        تصفّح الإعلانات
      </Link>
    </div>
  );
}
