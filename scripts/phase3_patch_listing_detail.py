from pathlib import Path

path = Path("src/routes/listings.$id.tsx")
text = path.read_text(encoding="utf-8")

helper_import = (
    'import { loadPublicListingDetailPageData } from '
    '"@/features/listing-detail/public-listing-detail-page-data";\n'
)
if helper_import not in text:
    text = text.replace(
        'import { ListingContactDock } from "@/features/listing-detail/ListingContactDock";\n',
        'import { ListingContactDock } from "@/features/listing-detail/ListingContactDock";\n'
        + helper_import,
        1,
    )

for line in (
    "  fetchListingDetail,\n",
    "  fetchListingImages,\n",
    "  fetchPublicListings,\n",
    "  fetchPublicSellerProfile,\n",
):
    text = text.replace(line, "", 1)

old_route = '''export const Route = createFileRoute("/listings/$id")({
  loader: async ({ params }) => {
    const listing = await fetchListingDetail(params.id);
    if (!listing.ok) throw notFound();
    return listing.data;
  },
  notFoundComponent: UnavailableListingRecovery,
  head: ({ loaderData }) =>
    createSeo({
      title: loaderData ? `${loaderData.title} | RAWAJ / رواج` : "إعلان غير متاح | RAWAJ / رواج",
      description: loaderData
        ? plainText(loaderData.description || "تفاصيل إعلان معتمد على رواج.", 160)
        : "هذا الإعلان غير متاح للعرض العام على رواج.",
      path: loaderData ? `/listings/${loaderData.id}` : "/listings",
      type: "article",
      image: loaderData?.primaryImageUrl ?? null,
      noindex: !loaderData,
    }),
  component: ListingDetailsPage,
});
'''
new_route = '''export const Route = createFileRoute("/listings/$id")({
  loader: async ({ params }) => {
    const pageData = await loadPublicListingDetailPageData(params.id);
    if (!pageData) throw notFound();
    return pageData;
  },
  notFoundComponent: UnavailableListingRecovery,
  head: ({ loaderData }) => {
    const listing = loaderData?.listing;
    return createSeo({
      title: listing ? `${listing.title} | RAWAJ / رواج` : "إعلان غير متاح | RAWAJ / رواج",
      description: listing
        ? plainText(listing.description || "تفاصيل إعلان معتمد على رواج.", 160)
        : "هذا الإعلان غير متاح للعرض العام على رواج.",
      path: listing ? `/listings/${listing.id}` : "/listings",
      type: "article",
      image: loaderData?.images[0]?.publicUrl ?? listing?.primaryImageUrl ?? null,
      noindex: !listing,
    });
  },
  component: ListingDetailsPage,
});
'''
if old_route in text:
    text = text.replace(old_route, new_route, 1)
elif new_route not in text:
    raise SystemExit("Listing detail route block not found")

old_state = '''  const initialListing = Route.useLoaderData();
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listing, setListing] = useState<ClassifiedListing | null>(initialListing);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [seller, setSeller] = useState<PublicSellerProfile | null>(null);
  const [similarListings, setSimilarListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(!initialListing);
  const [sellerLoading, setSellerLoading] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [imageError, setImageError] = useState<ClassifiedsError | null>(null);
'''
new_state = '''  const initialData = Route.useLoaderData();
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
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [imageError, setImageError] = useState<ClassifiedsError | null>(initialData.imageError);
'''
if old_state in text:
    text = text.replace(old_state, new_state, 1)
elif new_state not in text:
    raise SystemExit("Listing detail state block not found")

text = text.replace("  const imageRequestIdRef = useRef(0);\n", "", 1)

old_effect_start = '  useEffect(() => {\n    setListing(initialListing);'
favorite_effect = (
    '  useEffect(() => {\n'
    '    let cancelled = false;\n'
    '    const requestId = ++favoriteRequestIdRef.current;'
)
if old_effect_start in text:
    start = text.index(old_effect_start)
    end = text.index(favorite_effect, start)
    replacement = '''  useEffect(() => {
    setListing(initialData.listing);
    setImages(initialData.images);
    setSeller(initialData.seller);
    setSimilarListings(initialData.similarListings);
    setImageError(initialData.imageError);
    setLoading(false);
    setSellerLoading(false);
    setSimilarLoading(false);
    setError(null);
    setAlertCreated(false);
  }, [initialData, id]);

'''
    text = text[:start] + replacement + text[end:]
elif "setImages(initialData.images);" not in text:
    raise SystemExit("Listing detail public-data effects not found")

path.write_text(text, encoding="utf-8")
