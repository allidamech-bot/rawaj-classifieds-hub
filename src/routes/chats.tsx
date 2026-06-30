import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, ShieldAlert, Clock, Send, Lock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { listings } from "@/data/mockData";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/chats")({
  head: () => ({ meta: [{ title: "الرسائل | رَوَاج" }] }),
  component: ChatsPage,
});

const mockChats = [
  { id: "c1", listingId: "11", last: "هل ما زال متوفراً؟", time: "قبل 5 د", unread: 2 },
  { id: "c2", listingId: "6", last: "متى يمكن المعاينة؟", time: "أمس", unread: 0 },
];

function ChatsPage() {
  const { language, text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("الرسائل", "Chats")} />
      <main className="container-wide pt-4 pb-8 space-y-4">
        <div className="rounded-2xl bg-warning/10 p-4 hairline">
          <p className="text-xs font-bold mb-1">
            {text(
              "المحادثات غير مفعّلة حالياً — نموذج تجريبي",
              "Chats are not enabled yet - demo preview",
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {text(
              "سيتم تفعيل الرسائل بين البائع والمشتري لاحقاً مع ربط المحادثة بالإعلان، تنبيهات أمان، وإمكانية الحظر والتبليغ.",
              "Buyer-seller messaging will be enabled later with listing-linked chats, safety notices, blocking, and reporting.",
            )}
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-2xl bg-card p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs font-medium">
            {text(
              "حافظ على تواصلك ضمن التطبيق، ولا تحوّل المال قبل الاطلاع على السلعة.",
              "Keep communication inside the app, and do not transfer money before inspecting the item.",
            )}
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
                  <div className="flex items-center gap-3 rounded-2xl bg-card p-3 hairline">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
                      {l.sellerName.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{l.sellerName}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          <Clock className="me-1 inline h-3 w-3" />
                          {language === "ar" ? c.time : "Demo"}
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{l.title}</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-sm">
                          {language === "ar" ? c.last : "Is this still available?"}
                        </span>
                        <span className="shrink-0 rounded-full bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {text("معاينة تجريبية", "Demo preview")}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link
            to="/listings"
            className="rounded-xl bg-primary px-4 py-2.5 text-center text-xs font-bold text-primary-foreground"
          >
            {text("تصفح الإعلانات", "Browse listings")}
          </Link>
          <Link
            to="/safety"
            className="rounded-xl bg-card px-4 py-2.5 text-center text-xs font-bold hairline"
          >
            {text("نصائح الأمان", "Safety tips")}
          </Link>
          <Link
            to="/support"
            className="rounded-xl bg-card px-4 py-2.5 text-center text-xs font-bold hairline"
          >
            {text("الدعم", "Support")}
          </Link>
        </div>

        {/* Disabled composer preview */}
        <div className="rounded-2xl bg-card p-3 hairline">
          <p className="mb-2 text-[11px] font-bold text-muted-foreground">
            {text("معاينة شريط الرسائل (غير مفعّل)", "Message bar preview (disabled)")}
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-muted-surface p-2 opacity-70">
            <input
              disabled
              placeholder={text("اكتب رسالتك... — قريباً", "Write your message... - soon")}
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
            <Lock className="h-3 w-3" />{" "}
            {text(
              "الإرسال الحقيقي يتطلب تفعيل الحساب والخادم.",
              "Real sending requires account and server activation.",
            )}
          </p>
        </div>
      </main>
    </>
  );
}

function EmptyState() {
  const { text } = useUiPreferences();

  return (
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <span className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-muted-surface text-muted-foreground">
        <MessageCircle className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-bold">{text("لا توجد رسائل حالياً", "No messages yet")}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {text(
          "عندما تتواصل مع بائع ستظهر المحادثات هنا.",
          "When you contact a seller, conversations will appear here.",
        )}
      </p>
      <Link
        to="/listings"
        className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
      >
        {text("تصفّح الإعلانات", "Browse listings")}
      </Link>
    </div>
  );
}
