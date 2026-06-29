import { createFileRoute, notFound } from "@tanstack/react-router";
import { BadgeCheck, Star, Flag, Ban, Phone } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ListingCard } from "@/components/ListingCard";
import { listings } from "@/data/mockData";

export const Route = createFileRoute("/seller/$id")({
  loader: ({ params }) => {
    const sellerListings = listings.filter((l) => l.sellerId === params.id);
    if (sellerListings.length === 0) throw notFound();
    const s = sellerListings[0];
    return { sellerListings, seller: { id: s.sellerId, name: s.sellerName, type: s.sellerType, verified: s.isVerifiedSeller, rating: s.sellerRating, joinedAt: s.sellerJoinedAt } };
  },
  notFoundComponent: () => (
    <>
      <PageHeader title="بائع" />
      <main className="container-wide pt-10 text-center text-sm text-muted-foreground">هذا البائع غير متاح حالياً.</main>
    </>
  ),
  errorComponent: ({ reset }) => (
    <>
      <PageHeader title="خطأ" />
      <main className="container-wide pt-10 text-center">
        <button onClick={reset} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">إعادة المحاولة</button>
      </main>
    </>
  ),
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.seller.name} | رَوَاج` : "بائع | رَوَاج" }],
  }),
  component: SellerPage,
});

function SellerPage() {
  const { seller, sellerListings } = Route.useLoaderData();

  return (
    <>
      <PageHeader title="ملف البائع" />
      <main className="container-wide pt-4 pb-8">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-foreground/10 text-xl font-bold text-gold">
              {seller.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-extrabold">{seller.name}</h1>
                {seller.verified && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold">
                    <BadgeCheck className="h-3 w-3" /> موثّق
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/80">
                <span>{labelType(seller.type)}</span>
                <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-gold text-gold" /> {seller.rating.toFixed(1)}</span>
                <span>منذ {new Date(seller.joinedAt).getFullYear()}</span>
                <span>{sellerListings.length} إعلان</span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button className="rounded-xl bg-gold py-2 text-xs font-bold text-gold-foreground">رسالة</button>
            <button className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary-foreground/10 py-2 text-xs font-bold"><Phone className="h-3.5 w-3.5"/> اتصال</button>
            <button className="rounded-xl bg-primary-foreground/10 py-2 text-xs font-bold">واتساب</button>
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-3 text-lg font-extrabold">
            <span className="inline-block border-b-2 border-gold pb-0.5">الإعلانات النشطة</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sellerListings.map((l: typeof listings[number]) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-destructive hairline">
            <Flag className="h-4 w-4" /> إبلاغ عن البائع
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold hairline">
            <Ban className="h-4 w-4" /> حظر البائع
          </button>
        </div>
      </main>
    </>
  );
}

function labelType(t: string) {
  switch (t) {
    case "verified": return "بائع موثّق";
    case "store":    return "متجر";
    case "business": return "حساب أعمال";
    default:         return "مستخدم";
  }
}
