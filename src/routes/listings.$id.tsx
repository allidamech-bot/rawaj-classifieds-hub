import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Clock, MapPin, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ListingContactDock } from "@/features/listing-detail/ListingContactDock";
import { loadPublicListingDetailPageData } from "@/features/listing-detail/public-listing-detail-page-data";
import { ListingMediaExperience } from "@/features/listing-detail/ListingMediaExperience";
import { ListingSafetyAndAlert } from "@/features/listing-detail/ListingSafetyAndAlert";
import { ListingSellerProfileCard } from "@/features/listing-detail/ListingSellerProfileCard";
import { SimilarListingsRail } from "@/features/listing-detail/SimilarListingsRail";
import { UnavailableListingRecovery } from "@/features/listing-detail/UnavailableListingRecovery";
import { resolveCategoryFieldKind } from "@/lib/category-fields";
import {
  createListingReport,
  createSavedSearch,
  favoriteListing,
  fetchFavoriteStatus,
  startListingConversation,
  unfavoriteListing,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ListingImage,
  PublicSellerProfile,
  TaxonomyNode,
} from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { buildListingStructuredData } from "@/lib/listing-structured-data";
import { queueListingSharePrompt } from "@/lib/listing-share-growth";
import { buildBreadcrumbStructuredData, createSeo, jsonLdScript } from "@/lib/seo";
import { phoneHref, whatsappHref } from "@/lib/contact-phone";
import {
  buildPublicListingDetailRows,
  isPublicListingVisible,
  normalizePublicListingImages,
  publicListingShareUrl,
  publicSeoDescription,
  resolvePublicLocationLabel,
} from "@/lib/public-listing-presentation";
import { taxonomyNodeName, taxonomyPathLabel } from "@/lib/taxonomy";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/listings/$id")({
  loader: async ({ params }) => {
    const pageData = await loadPublicListingDetailPageData(params.id);
    if (!pageData) throw notFound();
    return pageData;
  },
  notFoundComponent: UnavailableListingRecovery,
  head: ({ loaderData }) => {
    const listing = loaderData?.listing;
    return createSeo({
      title: listing ? `${listing.title} | رواج` : "إعلان غير متاح | رواج",
      description: listing
        ? publicSeoDescription(listing.description || "تفاصيل إعلان معتمد على رواج.")
        : "هذا الإعلان غير متاح للعرض العام على رواج.",
      path: listing ? `/listings/${listing.id}` : "/listings",
      type: "article",
      image: loaderData?.images[0]?.publicUrl ?? listing?.primaryImageUrl ?? null,
      noindex: !listing,
    });
  },
  component: ListingDetailsPage,
});

function ListingDetailsPage() {
  const { id } = Route.useParams();
  const initialData = Route.useLoaderData();
  const initialListing = initialData.listing;
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listing, setListing] = useState<ClassifiedListing | null>(initialListing);
  const [images, setImages] = useState<ListingImage[]>(initialData.images);
  const [seller, setSeller] = useState<PublicSellerProfile | null>(initialData.seller);
  const [similarListings, setSimilarListings] = useState<ClassifiedListing[]>(
    initialData.similarListings,
  );
  const [loading, setLoading] = useState(false);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [error, setError] = useState(false);
  const [imagesUnavailable, setImagesUnavailable] = useState(initialData.imagesUnavailable);
  const [fav, setFav] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertCreated, setAlertCreated] = useState(false);
  const favoriteInFlightRef = useRef(false);
  const favoriteRequestIdRef = useRef(0);
  const reportInFlightRef = useRef(false);
  const messageInFlightRef = useRef<string | null>(null);
  const profileIdRef = useRef<string | null>(auth.profile?.id ?? null);
  const profileGenerationRef = useRef(0);
  const liveProfileId = auth.profile?.id ?? null;
  if (profileIdRef.current !== liveProfileId) {
    profileIdRef.current = liveProfileId;
    profileGenerationRef.current += 1;
  }
  const alertInFlightRef = useRef(false);

  useEffect(() => {
    setListing(initialData.listing);
    setImages(initialData.images);
    setSeller(initialData.seller);
    setSimilarListings(initialData.similarListings);
    setImagesUnavailable(initialData.imagesUnavailable);
    setLoading(false);
    setSellerLoading(false);
    setSimilarLoading(false);
    setError(false);
    setAlertCreated(false);
  }, [initialData, id]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++favoriteRequestIdRef.current;
    const profileId = auth.profile?.id ?? null;
    if (auth.status !== "signedIn" || !profileId || listing?.ownerId === profileId) {
      setFav(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadFavorite() {
      try {
        const result = await fetchFavoriteStatus(profileId, id);
        if (!cancelled && requestId === favoriteRequestIdRef.current && result.ok) {
          setFav(result.data);
        } else if (!cancelled && requestId === favoriteRequestIdRef.current && !result.ok) {
          setActionMessage(text("تعذر تحميل حالة المفضلة.", "Could not load favorite status."));
        }
      } catch {
        if (!cancelled && requestId === favoriteRequestIdRef.current) {
          setActionMessage(text("تعذر تحميل حالة المفضلة.", "Could not load favorite status."));
        }
      }
    }

    void loadFavorite();
    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.profile?.id, id, listing?.ownerId]);

  async function toggleFavorite() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      void navigate({ to: "/login", search: { returnTo: `/listings/${id}` } });
      return;
    }
    if (!listing || !isPublicListingVisible(listing)) return;
    if (listing.ownerId === auth.profile?.id) {
      setActionMessage(text("هذا إعلانك.", "This is your listing."));
      return;
    }
    if (favoriteInFlightRef.current) return;

    const profileId = auth.profile?.id ?? null;
    const previousFavoriteState = fav;
    const desiredFavoriteState = !fav;
    const requestId = ++favoriteRequestIdRef.current;
    favoriteInFlightRef.current = true;
    setFavoriteBusy(true);
    setFav(desiredFavoriteState);

    try {
      const result = desiredFavoriteState
        ? await favoriteListing(profileId, id)
        : await unfavoriteListing(profileId, id);
      if (requestId !== favoriteRequestIdRef.current) return;
      if (!result.ok) {
        setFav(previousFavoriteState);
        setActionMessage(
          text("تعذر تحديث المفضلة. حاول مرة أخرى.", "Could not update favorites. Try again."),
        );
        return;
      }

      setActionMessage(
        desiredFavoriteState
          ? text("تم حفظ الإعلان في المفضلة.", "Saved to favorites.")
          : text("تمت إزالة الإعلان من المفضلة.", "Removed from favorites."),
      );
    } catch {
      if (requestId === favoriteRequestIdRef.current) {
        setFav(previousFavoriteState);
        setActionMessage(
          text("تعذر تحديث المفضلة. حاول مرة أخرى.", "Could not update favorites. Try again."),
        );
      }
    } finally {
      favoriteInFlightRef.current = false;
      setFavoriteBusy(false);
    }
  }

  async function reportListing() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      void navigate({ to: "/login", search: { returnTo: "/listings/" + id } });
      return;
    }
    if (reportInFlightRef.current) return;
    const startProfileId = auth.profile?.id ?? null;
    const startProfileGeneration = profileGenerationRef.current;
    if (!startProfileId) return;
    reportInFlightRef.current = true;
    setReportBusy(true);
    try {
      const result = await createListingReport(
        id,
        "suspicious_listing",
        "بلاغ سريع من صفحة الإعلان.",
      );
      if (
        profileIdRef.current !== startProfileId ||
        profileGenerationRef.current !== startProfileGeneration
      ) {
        return;
      }
      setActionMessage(
        result.ok
          ? text("تم إرسال البلاغ للمراجعة.", "Report sent for review.")
          : text("تعذر إرسال البلاغ الآن.", "Could not send the report now."),
      );
    } catch {
      if (
        profileIdRef.current === startProfileId &&
        profileGenerationRef.current === startProfileGeneration
      ) {
        setActionMessage(text("تعذر إرسال البلاغ الآن.", "Could not send the report now."));
      }
    } finally {
      reportInFlightRef.current = false;
      if (profileGenerationRef.current === startProfileGeneration) setReportBusy(false);
    }
  }

  async function messageSeller() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      void navigate({ to: "/login", search: { returnTo: "/listings/" + id } });
      return;
    }
    const startProfileId = auth.profile?.id ?? null;
    const startProfileGeneration = profileGenerationRef.current;
    if (!startProfileId || messageInFlightRef.current === startProfileId) return;
    if (listing?.ownerId === auth.profile?.id) {
      setActionMessage(text("لا يمكنك بدء محادثة مع نفسك.", "You cannot message yourself."));
      return;
    }
    if (!listing || listing.status !== "approved") {
      setActionMessage(
        text(
          "المحادثات متاحة للإعلانات المعتمدة فقط.",
          "Messages are available for approved listings only.",
        ),
      );
      return;
    }
    messageInFlightRef.current = startProfileId;
    setMessageBusy(true);
    try {
      const result = await startListingConversation(listing.id);
      if (
        profileIdRef.current !== startProfileId ||
        profileGenerationRef.current !== startProfileGeneration
      ) {
        return;
      }
      if (!result.ok) {
        setActionMessage(text("تعذر بدء المحادثة الآن.", "Could not start the conversation now."));
        return;
      }
      await navigate({ to: "/chats", search: { conversation: result.data } });
    } catch {
      if (
        profileIdRef.current === startProfileId &&
        profileGenerationRef.current === startProfileGeneration
      ) {
        setActionMessage(text("تعذر بدء المحادثة الآن.", "Could not start the conversation now."));
      }
    } finally {
      if (
        profileGenerationRef.current === startProfileGeneration &&
        messageInFlightRef.current === startProfileId
      ) {
        messageInFlightRef.current = null;
        setMessageBusy(false);
      }
    }
  }

  async function shareListing() {
    if (!listing) return;
    setActionMessage(null);

    if (auth.status === "signedIn" && auth.profile?.id === listing.ownerId) {
      queueListingSharePrompt(listing.id);
      return;
    }

    const url = publicListingShareUrl(window.location.origin, listing.id);

    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, text: listing.title, url });
        return;
      }
      await copyPublicListingUrl(url);
      setActionMessage(text("تم نسخ رابط الإعلان.", "Listing link copied."));
    } catch {
      setActionMessage(text("تعذر مشاركة الإعلان الآن.", "Could not share the listing now."));
    }
  }

  async function createPriceAlert() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      void navigate({ to: "/login", search: { returnTo: "/listings/" + id } });
      return;
    }
    if (
      !listing ||
      listing.price === null ||
      !["fixed", "negotiable"].includes(listing.priceType)
    ) {
      setActionMessage(
        text(
          "تنبيه السعر متاح للإعلانات ذات السعر الرقمي.",
          "Price alerts are available for listings with a numeric price.",
        ),
      );
      return;
    }

    if (alertInFlightRef.current) return;
    alertInFlightRef.current = true;
    setAlertBusy(true);
    try {
      const result = await createSavedSearch(auth.profile?.id ?? null, {
        nameAr: "نتائج مشابهة بسعر " + listing.price,
        filters: {
          categoryId: listing.categoryId,
          governorateId: listing.governorateId,
          priceMax: listing.price,
          sort: "cheapest",
        },
        alertFrequency: "daily",
      });
      if (!result.ok) {
        setActionMessage(
          text("تعذر إنشاء تنبيه السعر الآن.", "Could not create the price alert now."),
        );
        return;
      }
      setAlertCreated(true);
      setActionMessage(
        text(
          "تم حفظ بحث يومي لإعلانات مشابهة بهذا السعر أو أقل.",
          "A daily search was saved for similar listings at this price or lower.",
        ),
      );
    } catch {
      setActionMessage(
        text("تعذر إنشاء تنبيه السعر الآن.", "Could not create the price alert now."),
      );
    } finally {
      alertInFlightRef.current = false;
      setAlertBusy(false);
    }
  }

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/listings", search: listing ? { category: listing.categoryId } : {} });
  }

  if (loading) {
    return (
      <>
        <PageHeader title={text("تفاصيل الإعلان", "Listing details")} />
        <main className="container-wide mobile-page-bottom pt-10">
          <StateCard
            title={text("جاري تحميل الإعلان", "Loading listing")}
            body={text("نجهز تفاصيل الإعلان للعرض.", "Preparing listing details.")}
          />
        </main>
      </>
    );
  }

  if (error || !listing || !isPublicListingVisible(listing)) {
    return (
      <>
        <PageHeader title={text("تفاصيل الإعلان", "Listing details")} />
        <main className="container-wide mobile-page-bottom pt-10">
          <StateCard
            title={text("لا يمكن عرض هذا الإعلان", "Listing cannot be shown")}
            body={text(
              "قد يكون الإعلان خارج العرض العام أو لم تتم الموافقة عليه.",
              "The listing may be outside public display or not approved.",
            )}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        </main>
      </>
    );
  }

  const selectedTaxonomyNode = initialData.taxonomyNode?.isLeaf ? initialData.taxonomyNode : null;
  const categoryFieldKind = resolveCategoryFieldKind(
    selectedTaxonomyNode,
    initialData.category ?? undefined,
    listing,
  );
  const categoryRows = buildPublicListingDetailRows(categoryFieldKind, listing, text);
  const locationLabel = resolvePublicLocationLabel({
    canonicalPath: initialData.locationPath,
    listing,
    language,
  });
  const phone = detailString(listing, ["phone"]);
  const whatsapp = detailString(listing, ["whatsapp"]);
  const callHref = listing.contactOptions.phone ? phoneHref(phone) : null;
  const whatsappUrl = listing.contactOptions.whatsapp ? whatsappHref(whatsapp) : null;
  const canCall = Boolean(callHref);
  const canWhatsapp = Boolean(whatsappUrl);
  const sellerName = listing.contactName?.trim() || text("معلن على رواج", "RAWAJ advertiser");
  const isOwner = auth.profile?.id === listing.ownerId;
  const mediaImages = normalizePublicListingImages(images, listing);
  const listingCategory = categoryName(
    listing.categoryId,
    listing.categoryNameAr ?? undefined,
    language,
  );
  const taxonomyLabel = taxonomyPathLabel(initialData.taxonomyPath, language);
  const breadcrumbItems = buildListingBreadcrumbItems({
    taxonomyPath: initialData.taxonomyPath,
    listingCategory,
    categoryId: listing.categoryId,
    subcategoryId: listing.subcategoryId,
    legacySubcategory: initialData.legacySubcategory,
    language,
  });
  const listingBreadcrumbs = buildBreadcrumbStructuredData([
    { name: "RAWAJ / رواج", path: "/" },
    { name: text("الإعلانات", "Listings"), path: "/listings" },
    ...breadcrumbItems.map((item) => ({ name: item.label, path: item.path })),
    { name: listing.title, path: `/listings/${listing.id}` },
  ]);

  return (
    <>
      <main className="rawaj-detail-v2">
        <ListingMediaExperience
          images={mediaImages}
          title={listing.title}
          placeholder={listing.categoryPlaceholder ?? "misc"}
          favorite={fav}
          favoriteBusy={favoriteBusy}
          showFavorite={!isOwner}
          imageError={
            imagesUnavailable
              ? text("تعذر تحميل بعض الصور.", "Some listing images could not be loaded.")
              : null
          }
          onBack={goBack}
          onShare={() => void shareListing()}
          onToggleFavorite={() => void toggleFavorite()}
          text={text}
        />

        <div className="rawaj-detail-v2__container">
          {listing.reservedAt ? (
            <section className="rawaj-detail-reserved">
              <Clock aria-hidden="true" />
              <div>
                <h2>{text("هذا الإعلان محجوز حالياً", "This listing is currently reserved")}</h2>
                <p>
                  {text(
                    "أبقاه المعلن ظاهراً للمرجعية، لكن قد تكون السلعة ملتزماً بها لمشترٍ آخر. يمكنك الاستفسار من البائع عن آخر حالة.",
                    "The seller kept it public for reference, but the item may be committed to another buyer. You can ask the seller for the latest status.",
                  )}
                </p>
              </div>
            </section>
          ) : null}

          <div className="rawaj-detail-v2__layout">
            <article className="rawaj-detail-v2__content">
              <section className="rawaj-detail-summary">
                <ListingTaxonomyBreadcrumb
                  items={breadcrumbItems}
                  pathLabel={taxonomyLabel}
                  text={text}
                />
                <div className="rawaj-detail-summary__badges">
                  {listing.isFeatured ? <Badge>{text("مميز", "Featured")}</Badge> : null}
                  <span>{breadcrumbItems.at(-1)?.label ?? listingCategory}</span>
                  <span>{text("متاح", "Available")}</span>
                </div>
                <h1>{listing.title}</h1>
                <div className="rawaj-detail-summary__meta">
                  <span>
                    <MapPin aria-hidden="true" />
                    {locationLabel}
                  </span>
                  <span>
                    <Clock aria-hidden="true" />
                    {formatDate(listing.createdAt, language)}
                  </span>
                </div>
                <PriceDisplay listing={listing} language={language} text={text} />
              </section>

              {categoryRows.length > 0 ? (
                <section className="rawaj-detail-section">
                  <SectionHeading
                    title={text("المواصفات", "Specifications")}
                    subtitle={text(
                      "أهم تفاصيل الإعلان في مكان واحد",
                      "Key listing details at a glance",
                    )}
                  />
                  <div className="rawaj-detail-specs">
                    {categoryRows.map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rawaj-detail-section">
                <SectionHeading
                  title={text("الوصف", "Description")}
                  subtitle={text(
                    "تفاصيل يضيفها المعلن عن السلعة",
                    "Details provided by the advertiser",
                  )}
                />
                <p className="rawaj-detail-description break-words">
                  {listing.description?.trim() ||
                    text(
                      "لم يضف البائع وصفا مفصلا.",
                      "The seller has not added a detailed description.",
                    )}
                </p>
              </section>

              <section className="rawaj-detail-section">
                <SectionHeading
                  title={text("الموقع", "Location")}
                  subtitle={text("الموقع المعلن للسلعة", "Advertised item location")}
                />
                <div className="rawaj-detail-location">
                  <span>
                    <MapPin aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{locationLabel}</strong>
                    <p>
                      {text(
                        "اتفق على نقطة عامة وآمنة للمعاينة.",
                        "Agree on a safe public inspection point.",
                      )}
                    </p>
                  </div>
                </div>
              </section>

              <ListingSafetyAndAlert
                showVisitorActions={!isOwner}
                alertBusy={alertBusy}
                reportBusy={reportBusy}
                alertCreated={alertCreated}
                onCreateAlert={() => void createPriceAlert()}
                onReport={() => void reportListing()}
                text={text}
              />
            </article>

            <aside className="rawaj-detail-v2__sidebar">
              <ListingSellerProfileCard
                listing={listing}
                seller={seller}
                loading={sellerLoading}
                fallbackName={sellerName}
                canMessage={!isOwner}
                messageBusy={messageBusy}
                onMessage={messageSeller}
                language={language}
                text={text}
              />
              <section className="rawaj-detail-reference">
                <ShieldAlert aria-hidden="true" />
                <div>
                  <span>{text("رقم مرجعي", "Reference")}</span>
                  <strong>{listing.id}</strong>
                </div>
              </section>
            </aside>
          </div>

          {actionMessage ? (
            <p className="rawaj-detail-v2__message" role="status">
              {actionMessage}
            </p>
          ) : null}

          <SimilarListingsRail
            listings={similarListings}
            categoryId={listing.categoryId}
            loading={similarLoading}
            text={text}
          />
        </div>

        <script
          {...jsonLdScript(
            buildListingStructuredData(
              { ...listing, districtAr: locationLabel },
              categoryFieldKind,
            ),
          )}
        />
        <script {...jsonLdScript(listingBreadcrumbs)} />
      </main>

      <ListingContactDock
        listingId={listing.id}
        isOwner={isOwner}
        canCall={canCall}
        canWhatsapp={canWhatsapp}
        callHref={callHref}
        whatsappUrl={whatsappUrl}
        messageBusy={messageBusy}
        onMessage={() => void messageSeller()}
        onOffer={() => void messageSeller()}
        text={text}
      />
    </>
  );
}

function PriceDisplay({
  listing,
  language,
  text,
}: {
  listing: ClassifiedListing;
  language: Language;
  text: (ar: string, en: string) => string;
}) {
  return (
    <div className="rawaj-detail-price">
      <span>{text("السعر", "Price")}</span>
      <strong>
        {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
      </strong>
    </div>
  );
}

interface ListingBreadcrumbItem {
  key: string;
  label: string;
  path: string;
}

function ListingTaxonomyBreadcrumb({
  items,
  pathLabel,
  text,
}: {
  items: ListingBreadcrumbItem[];
  pathLabel: string;
  text: (ar: string, en: string) => string;
}) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label={text("مسار التصنيف", "Category path")}
      title={pathLabel || undefined}
      className="mb-3 flex max-w-full flex-wrap items-center gap-1 overflow-hidden text-[11px] text-muted-foreground"
    >
      {items.map((item, index) => (
        <span key={item.key} className="inline-flex min-w-0 items-center gap-1">
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          <a href={item.path} className="max-w-[11rem] truncate hover:text-primary">
            {item.label}
          </a>
        </span>
      ))}
    </nav>
  );
}

function buildListingBreadcrumbItems({
  taxonomyPath,
  listingCategory,
  categoryId,
  subcategoryId,
  legacySubcategory,
  language,
}: {
  taxonomyPath: TaxonomyNode[];
  listingCategory: string;
  categoryId: string;
  subcategoryId: string | null;
  legacySubcategory: { nameAr: string; nameEn: string | null } | null;
  language: Language;
}): ListingBreadcrumbItem[] {
  const canonicalItems = taxonomyPath.map((node) => ({
    key: node.id,
    label: taxonomyNodeName(node, language),
    path: `/listings?taxonomy=${encodeURIComponent(node.id)}`,
  }));
  const source =
    canonicalItems.length > 0
      ? canonicalItems
      : [
          {
            key: `category-${categoryId}`,
            label: listingCategory,
            path: `/listings?category=${encodeURIComponent(categoryId)}`,
          },
          ...(subcategoryId && legacySubcategory
            ? [
                {
                  key: `subcategory-${subcategoryId}`,
                  label:
                    language === "en"
                      ? legacySubcategory.nameEn || legacySubcategory.nameAr
                      : legacySubcategory.nameAr,
                  path: `/listings?category=${encodeURIComponent(categoryId)}&subcategory=${encodeURIComponent(subcategoryId)}`,
                },
              ]
            : []),
        ];
  const labels = new Set<string>();
  return source.filter((item) => {
    const label = item.label.trim();
    if (!label || labels.has(label)) return false;
    labels.add(label);
    return true;
  });
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rawaj-detail-section__heading">
      <span aria-hidden="true" />
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span data-tone="featured">{children}</span>;
}

function StateCard({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="rawaj-surface rounded-3xl p-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {actionLabel && actionTo ? (
        <Link to={actionTo} className="rawaj-button-primary mt-4 px-4 py-2">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function detailString(listing: ClassifiedListing, keys: string[]) {
  for (const key of keys) {
    const value = listing.details[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

async function copyPublicListingUrl(url: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }
  const input = document.createElement("textarea");
  input.value = url;
  input.readOnly = true;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("clipboard_unavailable");
}

function formatDate(value: string, language: Language) {
  if (!value) return language === "ar" ? "تاريخ غير محدد" : "Date unavailable";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
