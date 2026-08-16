import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { FavoriteListingCard } from "@/features/favorites/FavoriteListingCard";
import {
  fetchFavoriteJourneyItems,
  unfavoriteListing,
  type FavoriteJourneyItem,
} from "@/lib/classifieds-api";
import type { ClassifiedsError } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { marketLocale } from "@/lib/market-locale";
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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());
  const removeInFlightRef = useRef<Set<string>>(new Set());
  const loadRequestIdRef = useRef(0);
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  profileIdRef.current = profileId;

  const loadFavorites = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFavoriteJourneyItems(currentProfileId);
      if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      if (result.ok) {
        setItems(result.data);
        setHasLoaded(true);
      } else {
        setError(result.error);
      }
    } catch (caught) {
      if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      setError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل المفضلة. حاول مرة أخرى.", "Could not load favorites. Try again."),
        operation: "favorite_journey_load",
      });
    } finally {
      if (requestId === loadRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setLoading(false);
      }
    }
  }, [profileId, text]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      loadRequestIdRef.current += 1;
      setItems([]);
      setLoading(false);
      setHasLoaded(false);
      setError(null);
      setActionMessage("");
      setRemovingIds(new Set());
      return;
    }

    loadRequestIdRef.current += 1;
    setItems([]);
    setLoading(false);
    setHasLoaded(false);
    setError(null);
    setActionMessage("");
    void loadFavorites();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [auth.status, loadFavorites, profileId]);

  async function remove(listingId: string) {
    const currentProfileId = profileId;
    if (!currentProfileId) return;
    const scopeKey = [currentProfileId, listingId].join(":");
    if (removeInFlightRef.current.has(scopeKey)) return;

    removeInFlightRef.current.add(scopeKey);
    setRemovingIds((current) => new Set(current).add(listingId));
    setActionMessage("");
    try {
      const result = await unfavoriteListing(currentProfileId, listingId);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }
      setItems((current) => current.filter((item) => item.listingId !== listingId));
    } catch (caught) {
      if (currentProfileId !== profileIdRef.current) return;
      setActionMessage(
        caught instanceof Error
          ? caught.message
          : text("تعذر إزالة الإعلان من المفضلة.", "Could not remove the listing from favorites."),
      );
    } finally {
      removeInFlightRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current) {
        setRemovingIds((current) => {
          const next = new Set(current);
          next.delete(listingId);
          return next;
        });
      }
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
      <main className="container-wide rawaj-account-collection-v3 rawaj-content-stack mobile-page-bottom pt-4">
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

        {actionMessage ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
            {actionMessage}
          </p>
        ) : null}

        {loading && !hasLoaded ? (
          <Panel title={text("جارٍ تحميل المفضلة", "Loading favorites")} />
        ) : error && !hasLoaded ? (
          <Panel
            title={text("تعذر تحميل المفضلة", "Could not load favorites")}
            body={error.message}
            actionLabel={text("إعادة المحاولة", "Try again")}
            onAction={() => void loadFavorites()}
            actionDisabled={loading}
          />
        ) : (
          <>
            {error ? (
              <RecoveryNotice
                title={text("تعذر تحديث المفضلة", "Could not refresh favorites")}
                body={error.message}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onAction={() => void loadFavorites()}
                actionDisabled={loading}
              />
            ) : null}
            {items.length === 0 ? (
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
                        removing={removingIds.has(item.listingId)}
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
                          disabled={removingIds.has(item.listingId)}
                          aria-busy={removingIds.has(item.listingId)}
                          className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive disabled:cursor-wait disabled:opacity-50"
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
          </>
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
      <main className="container-wide rawaj-account-collection-v3 rawaj-content-stack mobile-page-bottom pt-10">
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
  onAction,
  actionDisabled,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  actionTo?: string;
  actionSearch?: Record<string, string>;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  const { language } = useUiPreferences();
  return (
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface">
        <Heart className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>}
      {actionLabel ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {onAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled}
              className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {actionLabel}
            </button>
          ) : actionTo ? (
            <Link
              to={actionTo}
              search={actionSearch}
              className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
            >
              {actionLabel}
            </Link>
          ) : null}
          {actionTo ? (
            <Link
              to="/add-listing"
              className="inline-block rounded-xl bg-muted-surface px-5 py-2 text-sm font-bold text-foreground"
            >
              {uiLabel("أضف إعلاناً", language)}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RecoveryNotice({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="rounded-xl bg-destructive/10 p-4 text-destructive hairline">
      <p className="text-xs font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5">{body}</p>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-card px-4 py-2 text-xs font-bold text-foreground hairline disabled:opacity-60"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(marketLocale(language), {
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
  const formatted = new Intl.NumberFormat(marketLocale(language)).format(price);
  return `${formatted} ${currency}`;
}
