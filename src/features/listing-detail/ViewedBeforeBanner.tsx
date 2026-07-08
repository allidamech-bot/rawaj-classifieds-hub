import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useUiPreferences } from "@/lib/ui-preferences";

const STORAGE_KEY = "rawaj:recent-listing-views:v1";
const MAX_RECENT_VIEWS = 50;

interface ListingViewRecord {
  listingId: string;
  viewedAt: string;
}

export function ViewedBeforeBanner({ listingId }: { listingId: string }) {
  const { language, text } = useUiPreferences();
  const [previousViewAt, setPreviousViewAt] = useState<string | null>(null);

  useEffect(() => {
    const cleanListingId = listingId.trim();
    if (!cleanListingId) return;

    try {
      const current = readRecentViews();
      const previous = current.find((entry) => entry.listingId === cleanListingId) ?? null;
      setPreviousViewAt(previous?.viewedAt ?? null);

      const now = new Date().toISOString();
      const next = [
        { listingId: cleanListingId, viewedAt: now },
        ...current.filter((entry) => entry.listingId !== cleanListingId),
      ].slice(0, MAX_RECENT_VIEWS);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setPreviousViewAt(null);
    }
  }, [listingId]);

  if (!previousViewAt) return null;

  return (
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
  );
}

function readRecentViews(): ListingViewRecord[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((entry): entry is ListingViewRecord => {
      if (!entry || typeof entry !== "object") return false;
      const record = entry as Record<string, unknown>;
      return typeof record.listingId === "string" && typeof record.viewedAt === "string";
    })
    .slice(0, MAX_RECENT_VIEWS);
}

function formatViewedAt(value: string, language: "ar" | "en") {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
