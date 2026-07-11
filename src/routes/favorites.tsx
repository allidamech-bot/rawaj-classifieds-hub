import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { FavoriteListingCard } from "@/features/favorites/FavoriteListingCard";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  fetchFavoriteJourneyItems,
  unfavoriteListing,
  type FavoriteJourneyItem,
} from "@/lib/classifieds-api";
import type { ClassifiedsError } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [{ title: "المفضلة | رَوَاج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [items, setItems] = useState<FavoriteJourneyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const removeInFlightRef = useRef<Set<string>>(new Set());
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    if (auth.status !== "signedIn") {
      loadRequestIdRef.current += 1;
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const requestId = ++loadRequestIdRef.current;
    const profileId = auth.profile?.id ?? null;

    async function load() {
      setLoading(true);
      setError(null);
      const result = await fetchFavoriteJourneyItems(profileId);
      if (cancelled || requestId !== loadRequestIdRef.current) return;
      if (result.ok) setItems(result.data);
      else {
        setError(result.error);
        setItems([]);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.profile?.id]);

  async function remove(listingId: string) {
    if (removeInFlightRef.current.has(listingId)) return;
    const profileId = auth.profile?.id ?? null;
    removeInFlightRef.current.add(listingId);
    try {
      const result = await unfavoriteListing(profileId, listingId);
      if (profileId !== auth.profile?.id) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setItems((current) => current.filter((item) => item.listingId !== listingId));
    } finally {
      removeInFlightRef.current.delete(listingId);
    }
  }

  if (auth.status === "loading") {
    return (
      <State
        heading={text("جارٍ التحقق من الجلسة", "Checking session")}
        body={text("نجهّز مفضلتك الشخصية.", "Preparing your saved listings.")}
      />
    );
  }

  if (auth.status === "signedOut") {
    return (
      <State
        heading={text("تسجيل الدخول مطلوب", "Login required")}
        body={text(
          "سجّل الدخول لعرض الإعلانات التي حفظتها وإدارتها من مكان واحد.",
          "Log in to view and manage your saved listings in one place.",
        )}
        actionLabel={text("تسجيل الدخول", "Log in")}
        actionTo="/login"
        actionSearch={{ returnTo: "/favorites" }}
      />
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <State
        heading={text("المفضلة مرتبطة بالحساب", "Favorites are account based")}
        body={text(
          "تصفح الإعلانات الآن، وعند توفر جلسة الحساب ستظهر العناصر المحفوظة هنا.",
          "Browse listings now; when account session is available, saved items appear here.",
        )}
        actionLabel={text("تصفح الإعلانات", "Browse listings")}
        actionTo="/listings"
      />
    );
  }

  return (
    <>
      <PageHeader title={text("المفضلة", "Favorites")} />
      <main className="container-wide mobile-page-bottom space-y-4 pt-4">
        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">
            {text("إعلاناتك المحفوظة", "Your saved listings")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {text(
              "احفظ الإعلانات التي تهمك وارجع إليها بسرعة عند المقارنة أو التواصل.",
              "Save listings you care about and return quickly when comparing or contacting sellers.",
            )}
          </p>
        </section>

        {loading ? (
          <Panel title={text("جارٍ تحميل المفضلة", "Loading favorites")} />
        ) : error ? (
          <Panel
            title={text("تعذر تحميل المفضلة", "Could not load favorites")}
            body={error.message}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        ) : items.length === 0 ? (
          <Panel
            title={text("لا توجد إعلانات محفوظة", "No saved listings")}
            body={text(
              "ابدأ من صفحة الإعلانات واضغط القلب على أي إعلان تريد متابعته.",
              "Start from listings and tap the heart on any listing you want to track.",
            )}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((item) => {
              const listing = item.availability === "available" ? item.listing : undefined;

              if (listing) {
                return (
                  <FavoriteListingCard
                    key={item.listingId}
                    listing={listing}
                    onRemove={() => void remove(item.listingId)}
                  />
                );
              }

              return (
                <article
                  key={item.listingId}
                  className="rounded-2xl bg-card p-4 opacity-85 hairline"
                >
                  <div className="grid grid-cols-[96px_1fr] gap-3">
                    <div className="overflow-hidden rounded-xl opacity-70" aria-hidden="true">
                      <PlaceholderArt type="misc" aspect="square" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{item.snapshot.title}</p>
                      <span className="mt-1 inline-flex rounded-full bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning">
                        {text("غير متاح", "Unavailable")}
                      </span>
                      <p className="mt-2 text-xs font-bold text-foreground">
                        {formatSnapshotPrice(
                          item.snapshot.price,
                          item.snapshot.currency,
                          language,
                          text,
                        )}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        {text(
                          "هذا الإعلان لم يعد متاحًا. احتفظنا بتفاصيله الأساسية لتعرف ما الذي حفظته.",
                          "This listing is no longer available. We kept its basic details so you know what you saved.",
                        )}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDate(item.snapshot.createdAt, language)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      to="/listings"
                      className="flex-1 rounded-xl bg-primary px-3 py-2 text-center text-xs font-bold text-primary-foreground"
                    >
                      {text("تصفح بدائل", "Browse alternatives")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void remove(item.listingId)}
                      className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"
                      aria-label={text("إزالة من المفضلة", "Remove from favorites")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function State({
  heading,
  body,
  actionLabel,
  actionTo,
  actionSearch,
}: {
  heading: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
  actionSearch?: Record<string, string>;
}) {
  const { text } = useUiPreferences();
  return (
    <>
      <PageHeader title={text("المفضلة", "Favorites")} />
      <main className="container-wide mobile-page-bottom pt-10">
        <Panel
          title={heading}
          body={body}
          actionLabel={actionLabel}
          actionTo={actionTo}
          actionSearch={actionSearch}
        />
      </main>
    </>
  );
}

function Panel({
  title,
  body,
  actionLabel,
  actionTo,
  actionSearch,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  actionTo?: string;
  actionSearch?: Record<string, string>;
}) {
  const { language } = useUiPreferences();
  return (
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface">
        <Heart className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>}
      {actionLabel && actionTo && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            to={actionTo}
            search={actionSearch}
            className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
          >
            {actionLabel}
          </Link>
          <Link
            to="/add-listing"
            className="inline-block rounded-xl bg-muted-surface px-5 py-2 text-sm font-bold text-foreground"
          >
            {uiLabel("أضف إعلاناً", language)}
          </Link>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function formatSnapshotPrice(
  price: number | null,
  currency: string,
  language: Language,
  text: (ar: string, en: string) => string,
) {
  if (price === null) return text("السعر غير محفوظ", "Price unavailable");
  const formatted = new Intl.NumberFormat(language === "ar" ? "ar-SY" : "en-US").format(price);
  return `${formatted} ${currency}`;
}
