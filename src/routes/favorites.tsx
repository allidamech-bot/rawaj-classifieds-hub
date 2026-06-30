import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchFavorites, unfavoriteListing } from "@/lib/classifieds-api";
import type { ClassifiedsError, Favorite } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "المفضلة | رَوَاج" }] }),
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

      if (!result.ok) {
        setError(result.error);
        setItems([]);
      } else {
        setItems(result.data);
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
        title={text("المفضلة", "Favorites")}
        heading={text("جارٍ التحقق من الجلسة", "Checking session")}
        body={text("يتم التأكد من تسجيل الدخول.", "Checking sign-in status.")}
      />
    );
  }

  if (auth.status === "signedOut") {
    return (
      <State
        title={text("المفضلة", "Favorites")}
        heading={text("تسجيل الدخول مطلوب", "Login required")}
        body={text(
          "المفضلة الحقيقية مرتبطة بحسابك فقط ولا توجد مفضلة تجريبية كبديل.",
          "Real favorites are linked only to your account. No demo favorites are used as a substitute.",
        )}
        actionLabel={text("تسجيل الدخول", "Log in")}
        actionTo="/login"
      />
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <State
        title={text("المفضلة", "Favorites")}
        heading={text("المفضلة قيد التفعيل", "Favorites are being activated")}
        body={text(
          "حفظ الإعلانات سيعمل مع الحسابات بعد اكتمال التفعيل. يمكنك تصفح الإعلانات حالياً والعودة للمفضلة قريباً.",
          "Saving listings will work with accounts after activation. You can browse listings now and return to favorites soon.",
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
        <div className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">{text("المفضلة", "Favorites")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {text(
              "هذه الصفحة تعرض الإعلانات التي يحفظها الحساب الحالي فقط، ولا تستخدم بيانات تجريبية كبديل.",
              "This page shows listings saved by the current account only and does not use demo data as a substitute.",
            )}
          </p>
        </div>

        {loading ? (
          <Panel
            icon={<Heart className="h-6 w-6 text-muted-foreground" />}
            title={text("جارٍ تحميل المفضلة", "Loading favorites")}
          />
        ) : error ? (
          <Panel
            icon={<Heart className="h-6 w-6 text-muted-foreground" />}
            title={text("تعذر تحميل المفضلة", "Could not load favorites")}
            body={text(
              "المفضلة قيد التفعيل حالياً. حاول لاحقاً أو تابع تصفح الإعلانات.",
              "Favorites are being activated. Try again later or keep browsing listings.",
            )}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        ) : items.length === 0 ? (
          <Panel
            icon={<Heart className="h-6 w-6 text-muted-foreground" />}
            title={text("لا توجد إعلانات في المفضلة", "No favorite listings yet")}
            body={text(
              "احفظ الإعلانات المعتمدة التي تهمك لتعود إليها لاحقاً.",
              "Save approved listings you care about so you can return to them later.",
            )}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.listingId}
                className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 hairline"
              >
                <div>
                  <p className="text-sm font-bold">{text("إعلان محفوظ", "Saved listing")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text("رقم الإعلان:", "Listing ID:")} {item.listingId}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(item.createdAt, language)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/listings/$id"
                    params={{ id: item.listingId }}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    {text("فتح", "Open")}
                  </Link>
                  <button
                    onClick={() => void remove(item.listingId)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"
                    aria-label={text("إزالة من المفضلة", "Remove from favorites")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function State({
  title,
  heading,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  heading: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <>
      <PageHeader title={title} />
      <main className="container-wide pt-10">
        <Panel
          icon={<Heart className="h-6 w-6 text-muted-foreground" />}
          title={heading}
          body={body}
          actionLabel={actionLabel}
          actionTo={actionTo}
        />
      </main>
    </>
  );
}

function Panel({
  icon,
  title,
  body,
  actionLabel,
  actionTo,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  const { language } = useUiPreferences();

  return (
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface">
        {icon}
      </span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
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
