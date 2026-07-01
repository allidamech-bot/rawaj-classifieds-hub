import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { fetchFavorites, unfavoriteListing } from "@/lib/classifieds-api";
import type { ClassifiedsError, Favorite } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName, uiLabel } from "@/lib/i18n";
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
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const result = await fetchFavorites(auth.profile?.id ?? null);
      if (cancelled) return;
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
    const result = await unfavoriteListing(auth.profile?.id ?? null, listingId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems((current) => current.filter((item) => item.listingId !== listingId));
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
      <main className="container-wide space-y-4 pt-4 pb-8">
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
            {items.map((item) => (
              <article key={item.listingId} className="rounded-2xl bg-card p-4 hairline">
                <div className="grid grid-cols-[96px_1fr] gap-3">
                  <Link to="/listings/$id" params={{ id: item.listingId }} className="block">
                    {item.listing?.primaryImageUrl ? (
                      <img
                        src={item.listing.primaryImageUrl}
                        alt={item.listing.title}
                        loading="lazy"
                        decoding="async"
                        className="aspect-square w-full rounded-xl object-cover hairline"
                      />
                    ) : (
                      <PlaceholderArt
                        type={item.listing?.categoryPlaceholder ?? "misc"}
                        aspect="square"
                      />
                    )}
                  </Link>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold">
                          {item.listing?.title ?? text("إعلان محفوظ", "Saved listing")}
                        </p>
                        {item.listing ? (
                          <>
                            <p className="mt-1 text-xs font-bold text-foreground">
                              {formatPriceLocalized(
                                item.listing.price ?? 0,
                                item.listing.priceType,
                                language,
                                item.listing.currency,
                              )}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                              {categoryName(
                                item.listing.categoryId,
                                item.listing.categoryNameAr,
                                language,
                              )}{" "}
                              ·{" "}
                              {governorateName(
                                item.listing.governorateId,
                                item.listing.governorateNameAr,
                                language,
                              )}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {text("رقم الإعلان:", "Listing ID:")} {item.listingId}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatDate(item.createdAt, language)}
                        </p>
                      </div>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted-surface text-destructive">
                        <Heart className="h-4 w-4 fill-current" />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link
                    to="/listings/$id"
                    params={{ id: item.listingId }}
                    className="flex-1 rounded-xl bg-primary px-3 py-2 text-center text-xs font-bold text-primary-foreground"
                  >
                    {text("فتح الإعلان", "Open listing")}
                  </Link>
                  <button
                    onClick={() => void remove(item.listingId)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"
                    aria-label={text("إزالة من المفضلة", "Remove from favorites")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))}
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
}: {
  heading: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  const { text } = useUiPreferences();
  return (
    <>
      <PageHeader title={text("المفضلة", "Favorites")} />
      <main className="container-wide pt-10">
        <Panel title={heading} body={body} actionLabel={actionLabel} actionTo={actionTo} />
      </main>
    </>
  );
}

function Panel({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  actionTo?: string;
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
