import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { PriceChangeBanner } from "@/features/listing-detail/PriceChangeBanner";
import { findLocalListingView } from "@/lib/listing-history";
import { marketLocale } from "@/lib/market-locale";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export function ViewedBeforeBanner({ listingId }: { listingId: string }) {
  const { language, text } = useUiPreferences();
  const [previousViewAt, setPreviousViewAt] = useState<string | null>(null);

  useEffect(() => {
    const cleanListingId = listingId.trim();
    if (!cleanListingId) return;

    setPreviousViewAt(findLocalListingView(cleanListingId)?.viewedAt ?? null);
  }, [listingId]);

  return (
    <>
      <PriceChangeBanner listingId={listingId} />
      {previousViewAt && (
        <div className="container-wide pt-3">
          <section className="flex items-center gap-3 rounded-[1.1rem] border border-border/70 bg-card/90 p-3 shadow-soft">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted-surface text-primary">
              <Clock3 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold">
                {text("شاهدت هذا الإعلان من قبل", "You viewed this listing before")}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {text("آخر مشاهدة", "Last viewed")}: {formatViewedAt(previousViewAt, language)}
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function formatViewedAt(value: string, language: Language) {
  return new Intl.DateTimeFormat(marketLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
