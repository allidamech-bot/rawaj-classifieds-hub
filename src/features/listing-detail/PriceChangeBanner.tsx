import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import {
  fetchListingPriceChangeContext,
  type ListingPriceChangeContext,
} from "@/lib/classifieds-api";
import { marketLocale } from "@/lib/market-locale";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export function PriceChangeBanner({ listingId }: { listingId: string }) {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [context, setContext] = useState<ListingPriceChangeContext | null>(null);
  const profileId = auth.profile?.id ?? null;

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId || !listingId.trim()) {
      setContext(null);
      return;
    }

    let cancelled = false;
    void fetchListingPriceChangeContext(profileId, listingId)
      .then((result) => {
        if (cancelled) return;
        setContext(result.ok ? result.data : null);
      })
      .catch(() => {
        if (!cancelled) setContext(null);
      });

    return () => {
      cancelled = true;
    };
  }, [auth.status, profileId, listingId]);

  if (!context) return null;

  const decreased = context.direction === "decreased";
  const Icon = decreased ? ArrowDownRight : ArrowUpRight;

  return (
    <div className="container-wide pt-3">
      <section className="flex items-center gap-3 rounded-[1.1rem] border border-border/70 bg-card p-3 shadow-soft">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            decreased ? "bg-emerald-500/10 text-emerald-700" : "bg-warning/10 text-warning"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold">
            {decreased
              ? text("انخفض السعر منذ حفظك للإعلان", "Price dropped since you saved this listing")
              : text(
                  "ارتفع السعر منذ حفظك للإعلان",
                  "Price increased since you saved this listing",
                )}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {formatPrice(context.previousPrice, context.currency, language)} →{" "}
            {formatPrice(context.currentPrice, context.currency, language)}
          </p>
        </div>
      </section>
    </div>
  );
}

function formatPrice(value: number, currency: string, language: Language) {
  return `${new Intl.NumberFormat(marketLocale(language)).format(value)} ${currency}`;
}
