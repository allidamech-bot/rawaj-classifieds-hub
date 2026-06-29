import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ListingCard } from "@/components/ListingCard";
import { listings } from "@/data/mockData";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "المفضلة | رَوَاج" }] }),
  component: FavoritesPage,
});

// Mock saved listings (first two as demo)
const mockFavoriteIds = ["1", "6"];

function FavoritesPage() {
  const items = listings.filter((l) => mockFavoriteIds.includes(l.id));

  return (
    <>
      <PageHeader title="المفضلة" />
      <main className="container-wide pt-4 pb-8 space-y-4">
        <div className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">المفضلة</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            احفظ الإعلانات التي تريد الرجوع إليها لاحقاً. سيتم حفظ المفضلة على حسابك بعد تفعيل تسجيل الدخول.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl bg-card p-10 text-center hairline">
            <span className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-muted-surface">
              <Heart className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-3 text-sm font-bold">لا توجد إعلانات في المفضلة</p>
            <p className="mt-1 text-xs text-muted-foreground">احفظ الإعلانات التي تهمك لتعود إليها لاحقاً.</p>
            <Link to="/listings" className="mt-5 inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">
              تصفح الإعلانات
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((l) => (
                <div key={l.id} className="relative">
                  <ListingCard listing={l} />
                  <button
                    disabled
                    title="إزالة من المفضلة — قريباً"
                    className="absolute end-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-card/95 text-destructive shadow-soft cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              نموذج تجريبي · لن يتم حفظ التغييرات حتى يتم تفعيل تسجيل الدخول.
            </p>
          </>
        )}
      </main>
    </>
  );
}
