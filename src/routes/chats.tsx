import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";
import { Clock, MessageCircle, Search, Send, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { listings } from "@/data/mockData";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/chats")({
  head: () => ({ meta: [{ title: "الرسائل | رَوَاج" }] }),
  component: ChatsPage,
});

const initialChats = [
  {
    id: "c1",
    listingId: "11",
    timeAr: "قبل 5 د",
    timeEn: "5 min ago",
    unread: 2,
    messages: [
      {
        from: "seller",
        ar: "أهلاً، الإعلان ما زال متاحاً.",
        en: "Hi, the listing is still available.",
      },
      { from: "me", ar: "هل يمكن المعاينة اليوم؟", en: "Can I inspect it today?" },
    ],
  },
  {
    id: "c2",
    listingId: "6",
    timeAr: "أمس",
    timeEn: "Yesterday",
    unread: 0,
    messages: [
      {
        from: "seller",
        ar: "المعاينة متاحة بعد العصر.",
        en: "Inspection is available after the afternoon.",
      },
    ],
  },
];

function ChatsPage() {
  const { language, text } = useUiPreferences();
  const [selectedId, setSelectedId] = useState(initialChats[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [sentMessages, setSentMessages] = useState<
    Record<string, Array<{ ar: string; en: string }>>
  >({});
  const [query, setQuery] = useState("");

  const visibleChats = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initialChats;
    return initialChats.filter((chat) => {
      const listing = listings.find((item) => item.id === chat.listingId);
      return (
        listing?.title.toLowerCase().includes(normalized) ||
        listing?.sellerName.toLowerCase().includes(normalized)
      );
    });
  }, [query]);

  const selected = visibleChats.find((chat) => chat.id === selectedId) ?? visibleChats[0];
  const selectedListing = selected
    ? listings.find((item) => item.id === selected.listingId)
    : undefined;
  const localMessages = selected ? (sentMessages[selected.id] ?? []) : [];

  function handleSend(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !selected) return;
    setSentMessages((current) => ({
      ...current,
      [selected.id]: [...(current[selected.id] ?? []), { ar: body, en: body }],
    }));
    setDraft("");
  }

  return (
    <>
      <PageHeader title={text("الرسائل", "Chats")} />
      <main className="container-wide pt-4 pb-8 space-y-4">
        <div className="flex items-start gap-3 rounded-2xl bg-card p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs font-medium leading-6">
            {text(
              "حافظ على التواصل داخل رَوَاج، واتفق على المعاينة في مكان عام وآمن، ولا تحوّل المال قبل التأكد من السلعة.",
              "Keep communication inside RAWAJ, agree to inspect in a safe public place, and never transfer money before verifying the item.",
            )}
          </p>
        </div>

        <section className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-2xl bg-card hairline lg:grid-cols-[340px_1fr]">
          <aside className="border-b border-border bg-muted-surface/45 lg:border-b-0 lg:border-e">
            <div className="border-b border-border p-3">
              <label className="flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2 text-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={text("ابحث في المحادثات", "Search conversations")}
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>
            {visibleChats.length === 0 ? (
              <EmptyState compact />
            ) : (
              <ul className="max-h-[520px] overflow-y-auto p-2">
                {visibleChats.map((chat) => {
                  const listing = listings.find((item) => item.id === chat.listingId);
                  if (!listing) return null;
                  const active = selected?.id === chat.id;
                  const last = sentMessages[chat.id]?.at(-1) ?? chat.messages.at(-1);
                  return (
                    <li key={chat.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(chat.id)}
                        className={`mb-2 flex w-full items-center gap-3 rounded-xl p-3 text-start transition ${
                          active
                            ? "bg-primary text-primary-foreground shadow-soft"
                            : "bg-card hover:bg-muted-surface"
                        }`}
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-sm font-extrabold text-gold-foreground">
                          {listing.sellerName.slice(0, 1)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-extrabold">
                              {listing.sellerName}
                            </span>
                            <span className="shrink-0 text-[10px] opacity-75">
                              <Clock className="me-1 inline h-3 w-3" />
                              {language === "ar" ? chat.timeAr : chat.timeEn}
                            </span>
                          </span>
                          <span className="block truncate text-[11px] opacity-75">
                            {listing.title}
                          </span>
                          <span className="mt-1 flex items-center justify-between gap-2">
                            <span className="truncate text-xs">
                              {last ? (language === "ar" ? last.ar : last.en) : ""}
                            </span>
                            {chat.unread > 0 && (
                              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-gold-foreground">
                                {chat.unread}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="flex min-h-[520px] flex-col">
            {selected && selectedListing ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold">{selectedListing.sellerName}</p>
                    <Link
                      to="/listings/$id"
                      params={{ id: selectedListing.id }}
                      className="truncate text-xs text-primary hover:underline"
                    >
                      {selectedListing.title}
                    </Link>
                  </div>
                  <Link
                    to="/safety"
                    className="rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold"
                  >
                    {text("إرشادات الأمان", "Safety guide")}
                  </Link>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-background/55 p-4">
                  {[
                    ...selected.messages,
                    ...localMessages.map((item) => ({ from: "me", ...item })),
                  ].map((message, index) => {
                    const mine = message.from === "me";
                    return (
                      <div
                        key={`${message.ar}-${index}`}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm leading-6 ${
                            mine ? "bg-primary text-primary-foreground" : "bg-card hairline"
                          }`}
                        >
                          {language === "ar" ? message.ar : message.en}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={handleSend} className="border-t border-border p-3">
                  <div className="flex items-center gap-2 rounded-xl bg-muted-surface p-2">
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder={text("اكتب رسالتك...", "Write your message...")}
                      className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="submit"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                      aria-label={text("إرسال", "Send")}
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {text(
                      "تُضاف الرسائل محلياً في هذه الجلسة حتى يكتمل ربط خدمة المحادثات بالخادم.",
                      "Messages are added locally in this session until server chat sync is connected.",
                    )}
                  </p>
                </form>
              </>
            ) : (
              <EmptyState />
            )}
          </section>
        </section>
      </main>
    </>
  );
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  const { text } = useUiPreferences();

  return (
    <div
      className={`rounded-2xl p-${compact ? "6" : "10"} text-center text-sm text-muted-foreground`}
    >
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface">
        <MessageCircle className="h-6 w-6" />
      </span>
      <p className="mt-3 font-bold text-foreground">
        {text("لا توجد محادثات مطابقة", "No matching conversations")}
      </p>
      <p className="mt-1 text-xs">
        {text(
          "ابدأ من صفحة إعلان للتواصل مع البائع.",
          "Start from a listing page to contact the seller.",
        )}
      </p>
      {!compact && (
        <Link
          to="/listings"
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {text("تصفح الإعلانات", "Browse listings")}
        </Link>
      )}
    </div>
  );
}
