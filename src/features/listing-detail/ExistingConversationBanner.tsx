import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchListingConversationContext } from "@/lib/classifieds-api";
import type { Conversation } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export function ExistingConversationBanner({ listingId }: { listingId: string }) {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const profileId = auth.profile?.id ?? null;

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId || !listingId.trim()) {
      setConversation(null);
      return;
    }

    let cancelled = false;
    void fetchListingConversationContext(listingId).then((result) => {
      if (cancelled) return;
      setConversation(result.ok ? result.data : null);
    });

    return () => {
      cancelled = true;
    };
  }, [auth.status, profileId, listingId]);

  if (!conversation) return null;

  return (
    <div className="rawaj-detail-conversation">
      <section className="flex flex-wrap items-center gap-3 rounded-[1.15rem] border border-[#e3e7e4] bg-white p-3 text-[#152322]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ecf3f1] text-[#103f42]">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold">
            {text(
              "لديك محادثة مرتبطة بهذا الإعلان",
              "You already have a conversation for this listing",
            )}
          </h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {conversation.otherParticipant.displayName} · {conversation.listingTitle}
          </p>
        </div>
        <Link
          to="/chats"
          search={{ conversation: conversation.id }}
          className="inline-flex min-h-11 items-center rounded-xl border border-[#e3e7e4] px-3 text-xs font-bold text-[#103f42]"
        >
          {conversation.status === "active"
            ? text("متابعة المحادثة", "Continue conversation")
            : text("عرض سجل المحادثة", "View conversation history")}
        </Link>
      </section>
    </div>
  );
}
