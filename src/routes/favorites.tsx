import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchFavorites, unfavoriteListing } from "@/lib/classifieds-api";
import type { ClassifiedsError, Favorite } from "@/lib/classifieds-types";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "المفضلة | رَوَاج" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const auth = useAuth();
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
      <State title="المفضلة" heading="جارٍ التحقق من الجلسة" body="يتم التأكد من تسجيل الدخول." />
    );
  }

  if (auth.status === "signedOut") {
    return (
      <State
        title="المفضلة"
        heading="تسجيل الدخول مطلوب"
        body="المفضلة الحقيقية مرتبطة بحسابك فقط ولا توجد مفضلة تجريبية كبديل."
        actionLabel="تسجيل الدخول"
        actionTo="/login"
      />
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <State
        title="المفضلة"
        heading="المفضلة قيد التفعيل"
        body="حفظ الإعلانات سيعمل مع الحسابات بعد اكتمال التفعيل. يمكنك تصفح الإعلانات حالياً والعودة للمفضلة قريباً."
        actionLabel="تصفح الإعلانات"
        actionTo="/listings"
      />
    );
  }

  return (
    <>
      <PageHeader title="المفضلة" />
      <main className="container-wide space-y-4 pt-4 pb-8">
        <div className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">المفضلة</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            هذه الصفحة تعرض الإعلانات التي يحفظها الحساب الحالي فقط، ولا تستخدم بيانات تجريبية
            كبديل.
          </p>
        </div>

        {loading ? (
          <Panel
            icon={<Heart className="h-6 w-6 text-muted-foreground" />}
            title="جارٍ تحميل المفضلة"
          />
        ) : error ? (
          <Panel
            icon={<Heart className="h-6 w-6 text-muted-foreground" />}
            title="تعذر تحميل المفضلة"
            body="المفضلة قيد التفعيل حالياً. حاول لاحقاً أو تابع تصفح الإعلانات."
            actionLabel="تصفح الإعلانات"
            actionTo="/listings"
          />
        ) : items.length === 0 ? (
          <Panel
            icon={<Heart className="h-6 w-6 text-muted-foreground" />}
            title="لا توجد إعلانات في المفضلة"
            body="احفظ الإعلانات المعتمدة التي تهمك لتعود إليها لاحقاً."
            actionLabel="تصفح الإعلانات"
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
                  <p className="text-sm font-bold">إعلان محفوظ</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    رقم الإعلان: {item.listingId}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/listings/$id"
                    params={{ id: item.listingId }}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                  >
                    فتح
                  </Link>
                  <button
                    onClick={() => void remove(item.listingId)}
                    className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"
                    aria-label="إزالة من المفضلة"
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
            أضف إعلاناً
          </Link>
        </div>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(value));
}
