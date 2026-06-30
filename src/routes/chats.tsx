import { createFileRoute, Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { MessageCircle, Search, Send, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/chats")({
  head: () => ({ meta: [{ title: "الرسائل | رواج" }] }),
  component: ChatsPage,
});

function ChatsPage() {
  const { text } = useUiPreferences();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [sessionMessages, setSessionMessages] = useState<string[]>([]);

  function handleSend(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSessionMessages((current) => [...current, body]);
    setDraft("");
  }

  return (
    <>
      <PageHeader title={text("الرسائل", "Chats")} />
      <main className="container-wide space-y-4 pt-4 pb-8">
        <div className="flex items-start gap-3 rounded-2xl bg-card p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs font-medium leading-6">
            {text(
              "حافظ على التواصل داخل رواج عندما تكون المحادثة مدعومة من إعلان معتمد، واتفق على المعاينة في مكان عام وآمن.",
              "Keep communication inside RAWAJ when a conversation is supported by an approved listing, and agree to inspect in a safe public place.",
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
            <EmptyState compact hasQuery={Boolean(query.trim())} />
          </aside>

          <section className="flex min-h-[520px] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto bg-background/55 p-4">
              {sessionMessages.length === 0 ? (
                <EmptyState />
              ) : (
                sessionMessages.map((message, index) => (
                  <div key={`${message}-${index}`} className="flex justify-end">
                    <div className="max-w-[78%] rounded-2xl bg-primary px-4 py-2 text-sm leading-6 text-primary-foreground">
                      {message}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSend} className="border-t border-border p-3">
              <div className="flex items-center gap-2 rounded-xl bg-muted-surface p-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={text("اكتب ملاحظة لهذه الجلسة", "Write a note for this session")}
                  className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                  aria-label={text("إضافة", "Add")}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {text(
                  "هذه الملاحظات تبقى داخل جلسة المتصفح ولا يتم إرسالها إلى خادم محادثات.",
                  "These notes stay in the browser session and are not sent to a chat server.",
                )}
              </p>
            </form>
          </section>
        </section>
      </main>
    </>
  );
}

function EmptyState({
  compact = false,
  hasQuery = false,
}: {
  compact?: boolean;
  hasQuery?: boolean;
}) {
  const { text } = useUiPreferences();

  return (
    <div
      className={`rounded-2xl text-center text-sm text-muted-foreground ${compact ? "p-6" : "p-10"}`}
    >
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface">
        <MessageCircle className="h-6 w-6" />
      </span>
      <p className="mt-3 font-bold text-foreground">
        {hasQuery
          ? text("لا توجد محادثات مطابقة", "No matching conversations")
          : text("لا توجد محادثات محفوظة", "No saved conversations")}
      </p>
      <p className="mt-1 text-xs">
        {text(
          "ابدأ من صفحة إعلان معتمد للتواصل مع البائع عندما تكون خيارات التواصل متاحة.",
          "Start from an approved listing page to contact the seller when contact options are available.",
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
