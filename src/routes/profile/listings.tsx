import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchCurrentUserListings } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError } from "@/lib/classifieds-types";
import { categoryName, governorateName } from "@/lib/i18n";
import { listingStatusLabel } from "@/lib/status-labels";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/profile/listings")({
  head: () => ({
    meta: [{ title: "إعلاناتي | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: MyListingsPage,
});

function MyListingsPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const profileId = auth.profile?.id ?? null;

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) return;
    const ownerId = profileId;
    let cancelled = false;
    async function loadListings() {
      setLoading(true);
      setError(null);
      const result = await fetchCurrentUserListings(ownerId);
      if (cancelled) return;
      if (result.ok) setListings(result.data);
      else {
        setListings([]);
        setError(result.error);
      }
      setLoading(false);
    }
    void loadListings();
    return () => {
      cancelled = true;
    };
  }, [auth.status, profileId]);

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("إعلاناتي", "My listings")} to="/profile" />
        <main className="container-wide pt-4 pb-8">
          <Panel
            title={text("تسجيل الدخول مطلوب", "Login required")}
            body={text(
              "سجل الدخول لعرض الإعلانات المرتبطة بحسابك.",
              "Log in to view listings linked to your account.",
            )}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("إعلاناتي", "My listings")} to="/profile" />
      <main className="container-wide pt-4 pb-8">
        {loading ? (
          <Panel title={text("جارٍ تحميل إعلاناتك", "Loading your listings")} />
        ) : error ? (
          <Panel
            title={text("تعذر تحميل إعلاناتك", "Could not load your listings")}
            body={error.message}
          />
        ) : listings.length === 0 ? (
          <Panel
            title={text(
              "لا توجد إعلانات مرتبطة بحسابك الآن",
              "No listings are linked to your account now",
            )}
            body={text(
              "عند إضافة إعلان حقيقي سيظهر هنا بحالته الحالية.",
              "When you post a real listing, it will appear here with its current status.",
            )}
          />
        ) : (
          <div className="space-y-2">
            {listings.map((listing) => (
              <ListingRow key={listing.id} listing={listing} language={language} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function ListingRow({ listing, language }: { listing: ClassifiedListing; language: Language }) {
  const { text } = useUiPreferences();
  const canEdit =
    listing.status === "draft" ||
    listing.status === "pending_review" ||
    listing.status === "rejected";

  return (
    <article className="rounded-2xl bg-card p-4 hairline">
      <div className="flex items-start gap-3">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="h-16 w-20 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-20 items-center justify-center rounded-lg bg-muted-surface text-[10px] text-muted-foreground">
            {text("بدون صورة", "No photo")}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{listing.title}</h2>
            <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold">
              {listingStatusLabel(listing.status, language)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)} ·{" "}
            {governorateName(
              listing.governorateId,
              listing.governorateNameAr ?? undefined,
              language,
            )}
          </p>
          {listing.rejectionReason && (
            <p className="mt-1 text-[10px] text-destructive">{listing.rejectionReason}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link
              to="/listings/$id"
              params={{ id: listing.id }}
              className="inline-flex items-center gap-1 rounded-lg bg-muted-surface px-2 py-1 text-[10px] font-bold transition hover:bg-secondary"
            >
              <Eye className="h-3 w-3" />
              {text("عرض", "View")}
            </Link>
            {canEdit ? (
              <Link
                to="/profile/listings/$id"
                params={{ id: listing.id }}
                className="inline-flex items-center gap-1 rounded-lg bg-muted-surface px-2 py-1 text-[10px] font-bold transition hover:bg-secondary"
              >
                <Pencil className="h-3 w-3" />
                {text("تعديل", "Edit")}
              </Link>
            ) : listing.status === "approved" ? (
              <span className="inline-flex items-center rounded-lg bg-muted-surface px-2 py-1 text-[10px] text-muted-foreground">
                {text(
                  "الإعلان المعتمد ظاهر للزوار ولا يمكن تعديله من هنا.",
                  "Approved listings are visible to visitors and cannot be edited here.",
                )}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </section>
  );
}
