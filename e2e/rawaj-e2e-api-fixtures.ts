import type { Plugin } from "vite";

type FixtureResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

interface FixtureListingInput {
  id: string;
  categoryId: string;
  categoryNameAr: string;
  categoryPlaceholder: "car" | "realestate" | "phone";
  taxonomyNodeId: string;
  title: string;
  price: number;
  isFeatured: boolean;
  createdAt: string;
}

const SELLER_ID = "00000000-0000-4000-8000-000000000010";
const GOVERNORATE_ID = "gov-damascus";
const FIXTURE_TIMESTAMP = "2026-07-01T10:00:00.000Z";
const FIXTURE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000' viewBox='0 0 1600 1000'%3E%3Crect width='1600' height='1000' fill='%23e6ece9'/%3E%3Cpath d='M0 700L430 360L730 620L1050 270L1600 720V1000H0Z' fill='%23123f38'/%3E%3C/svg%3E";
const FIXTURE_AD_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='700' viewBox='0 0 1600 700'%3E%3Crect width='1600' height='700' fill='%23123f38'/%3E%3Ccircle cx='800' cy='350' r='150' fill='%23f4e6c4'/%3E%3C/svg%3E";

const fixtureCategories = [
  {
    id: "cat-vehicles",
    slug: "vehicles",
    nameAr: "السيارات",
    nameEn: "Vehicles",
    hintAr: "سيارات ومركبات للبيع",
    hintEn: "Vehicles for sale",
    placeholder: "car",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: "cat-real-estate",
    slug: "real-estate",
    nameAr: "العقارات",
    nameEn: "Real estate",
    hintAr: "منازل وعقارات",
    hintEn: "Homes and properties",
    placeholder: "realestate",
    sortOrder: 2,
    isActive: true,
  },
  {
    id: "cat-phones",
    slug: "phones",
    nameAr: "الموبايلات",
    nameEn: "Phones",
    hintAr: "هواتف وأجهزة محمولة",
    hintEn: "Phones and mobile devices",
    placeholder: "phone",
    sortOrder: 3,
    isActive: true,
  },
];

const fixtureSubcategories = [
  {
    id: "sub-cars",
    categoryId: "cat-vehicles",
    nameAr: "سيارات",
    nameEn: "Cars",
    sortOrder: 1,
  },
  {
    id: "sub-apartments",
    categoryId: "cat-real-estate",
    nameAr: "شقق",
    nameEn: "Apartments",
    sortOrder: 1,
  },
  {
    id: "sub-smartphones",
    categoryId: "cat-phones",
    nameAr: "هواتف ذكية",
    nameEn: "Smartphones",
    sortOrder: 1,
  },
];

const fixtureGovernorates = [
  {
    id: GOVERNORATE_ID,
    slug: "damascus",
    nameAr: "دمشق",
    nameEn: "Damascus",
    districtsAr: ["المزة", "أبو رمانة"],
    districtsEn: ["Mezzeh", "Abu Rummaneh"],
    sortOrder: 1,
    isActive: true,
  },
];

const fixtureTaxonomyNodes = [
  {
    id: "taxonomy-vehicles",
    parentId: null,
    slug: "vehicles",
    nameAr: "السيارات والمركبات",
    nameEn: "Vehicles",
    descriptionAr: "تصفح السيارات والمركبات المتاحة.",
    descriptionEn: "Browse available vehicles.",
    iconKey: "car",
    sortOrder: 1,
    depth: 0,
    isActive: true,
    isLeaf: false,
    filterSchemaKey: null,
    classificationKey: null,
    classificationValue: null,
    legacyCategoryId: null,
    legacySubcategoryId: null,
  },
  {
    id: "taxonomy-cars",
    parentId: "taxonomy-vehicles",
    slug: "cars",
    nameAr: "السيارات",
    nameEn: "Cars",
    descriptionAr: "اختر نوع السيارة.",
    descriptionEn: "Choose the vehicle type.",
    iconKey: "car",
    sortOrder: 1,
    depth: 1,
    isActive: true,
    isLeaf: false,
    filterSchemaKey: null,
    classificationKey: null,
    classificationValue: null,
    legacyCategoryId: null,
    legacySubcategoryId: null,
  },
  {
    id: "taxonomy-passenger-cars",
    parentId: "taxonomy-cars",
    slug: "passenger-cars",
    nameAr: "سيارات الركوب",
    nameEn: "Passenger cars",
    descriptionAr: "سيارات للاستخدام اليومي.",
    descriptionEn: "Cars for everyday use.",
    iconKey: "car",
    sortOrder: 1,
    depth: 2,
    isActive: true,
    isLeaf: false,
    filterSchemaKey: null,
    classificationKey: null,
    classificationValue: null,
    legacyCategoryId: null,
    legacySubcategoryId: null,
  },
  {
    id: "taxonomy-cars-sale",
    parentId: "taxonomy-passenger-cars",
    slug: "cars-for-sale",
    nameAr: "سيارات للبيع",
    nameEn: "Cars for sale",
    descriptionAr: "اختر هذا القسم لبيع سيارة.",
    descriptionEn: "Choose this category to sell a car.",
    iconKey: "car",
    sortOrder: 1,
    depth: 3,
    isActive: true,
    isLeaf: true,
    filterSchemaKey: null,
    classificationKey: null,
    classificationValue: null,
    legacyCategoryId: "cat-vehicles",
    legacySubcategoryId: "sub-cars",
  },
  {
    id: "taxonomy-cars-rent",
    parentId: "taxonomy-passenger-cars",
    slug: "cars-for-rent",
    nameAr: "سيارات للإيجار",
    nameEn: "Cars for rent",
    descriptionAr: "اختر هذا القسم لتأجير سيارة.",
    descriptionEn: "Choose this category to rent out a car.",
    iconKey: "car",
    sortOrder: 2,
    depth: 3,
    isActive: true,
    isLeaf: true,
    filterSchemaKey: null,
    classificationKey: null,
    classificationValue: null,
    legacyCategoryId: "cat-vehicles",
    legacySubcategoryId: "sub-cars",
  },
  {
    id: "taxonomy-real-estate",
    parentId: null,
    slug: "real-estate",
    nameAr: "العقارات",
    nameEn: "Real estate",
    descriptionAr: "تصفح العقارات المتاحة.",
    descriptionEn: "Browse available properties.",
    iconKey: "home",
    sortOrder: 2,
    depth: 0,
    isActive: true,
    isLeaf: true,
    filterSchemaKey: null,
    classificationKey: null,
    classificationValue: null,
    legacyCategoryId: "cat-real-estate",
    legacySubcategoryId: "sub-apartments",
  },
  {
    id: "taxonomy-phones",
    parentId: null,
    slug: "phones",
    nameAr: "الموبايلات",
    nameEn: "Phones",
    descriptionAr: "تصفح الهواتف والأجهزة المحمولة.",
    descriptionEn: "Browse phones and mobile devices.",
    iconKey: "smartphone",
    sortOrder: 3,
    depth: 0,
    isActive: true,
    isLeaf: true,
    filterSchemaKey: null,
    classificationKey: null,
    classificationValue: null,
    legacyCategoryId: "cat-phones",
    legacySubcategoryId: "sub-smartphones",
  },
];

function createFixtureListing(input: FixtureListingInput) {
  return {
    id: input.id,
    ownerId: SELLER_ID,
    categoryId: input.categoryId,
    subcategoryId:
      input.categoryId === "cat-vehicles"
        ? "sub-cars"
        : input.categoryId === "cat-real-estate"
          ? "sub-apartments"
          : "sub-smartphones",
    categoryNameAr: input.categoryNameAr,
    categoryPlaceholder: input.categoryPlaceholder,
    governorateId: GOVERNORATE_ID,
    governorateNameAr: "دمشق",
    locationNodeId: null,
    title: input.title,
    description: "إعلان تجريبي ثابت مخصص لاختبارات المتصفح المحلية.",
    price: input.price,
    currency: "SYP",
    priceType: "fixed",
    condition: "used",
    status: "approved",
    districtAr: "المزة",
    contactName: "بائع رواج",
    contactOptions: {
      message: true,
      phone: false,
      whatsapp: false,
    },
    details: {
      _taxonomy_node_id: input.taxonomyNodeId,
    },
    isFeatured: input.isFeatured,
    featuredUntil: input.isFeatured ? "2099-01-01T00:00:00.000Z" : null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    publishedAt: input.createdAt,
    archivedAt: null,
    reservedAt: null,
    expiresAt: "2099-01-01T00:00:00.000Z",
    renewedAt: null,
    expiryDays: 60,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    primaryImageUrl: FIXTURE_IMAGE,
  };
}

const fixtureListings = [
  createFixtureListing({
    id: "e2e-listing-featured",
    categoryId: "cat-vehicles",
    categoryNameAr: "السيارات",
    categoryPlaceholder: "car",
    taxonomyNodeId: "taxonomy-vehicles",
    title: "سيارة عائلية بحالة ممتازة",
    price: 450000000,
    isFeatured: true,
    createdAt: "2026-07-04T10:00:00.000Z",
  }),
  createFixtureListing({
    id: "e2e-listing-property",
    categoryId: "cat-real-estate",
    categoryNameAr: "العقارات",
    categoryPlaceholder: "realestate",
    taxonomyNodeId: "taxonomy-real-estate",
    title: "شقة مرتبة في دمشق",
    price: 900000000,
    isFeatured: false,
    createdAt: "2026-07-03T10:00:00.000Z",
  }),
  createFixtureListing({
    id: "e2e-listing-phone",
    categoryId: "cat-phones",
    categoryNameAr: "الموبايلات",
    categoryPlaceholder: "phone",
    taxonomyNodeId: "taxonomy-phones",
    title: "هاتف ذكي نظيف",
    price: 12000000,
    isFeatured: false,
    createdAt: "2026-07-02T10:00:00.000Z",
  }),
  createFixtureListing({
    id: "e2e-listing-car",
    categoryId: "cat-vehicles",
    categoryNameAr: "السيارات",
    categoryPlaceholder: "car",
    taxonomyNodeId: "taxonomy-vehicles",
    title: "سيارة اقتصادية للبيع",
    price: 280000000,
    isFeatured: false,
    createdAt: "2026-07-01T10:00:00.000Z",
  }),
];

function sendJson(response: FixtureResponse, payload: unknown, status = 200): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.end(JSON.stringify(payload));
}

function selectFixtureListings(url: URL) {
  let selected = [...fixtureListings];

  const categoryId = url.searchParams.get("categoryId");
  const governorateId = url.searchParams.get("governorateId");

  if (categoryId) {
    selected = selected.filter((listing) => listing.categoryId === categoryId);
  }

  if (governorateId) {
    selected = selected.filter((listing) => listing.governorateId === governorateId);
  }

  const sort = url.searchParams.get("sort");
  if (sort === "featured") {
    selected.sort(
      (first, second) =>
        Number(second.isFeatured) - Number(first.isFeatured) ||
        second.createdAt.localeCompare(first.createdAt),
    );
  } else if (sort === "cheapest") {
    selected.sort((first, second) => first.price - second.price);
  } else if (sort === "expensive") {
    selected.sort((first, second) => second.price - first.price);
  }

  const parsedPageSize = Number.parseInt(url.searchParams.get("pageSize") ?? "30", 10);
  const pageSize = Number.isFinite(parsedPageSize) ? Math.max(1, Math.min(parsedPageSize, 50)) : 30;

  return {
    items: selected.slice(0, pageSize),
    nextCursor: null,
    pageSize,
  };
}

function fixtureImages(listingId: string) {
  return [
    {
      id: `image-${listingId}`,
      listingId,
      storagePath: null,
      publicUrl: FIXTURE_IMAGE,
      altAr: "صورة الإعلان التجريبية",
      sortOrder: 0,
      createdAt: FIXTURE_TIMESTAMP,
    },
  ];
}

export function createRawajE2eApiFixturePlugin(): Plugin {
  return {
    name: "rawaj-e2e-api-fixtures",
    apply: "serve",

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");

        if (!url.pathname.startsWith("/v1")) {
          next();
          return;
        }

        if (request.method === "OPTIONS") {
          response.statusCode = 204;
          response.setHeader("Access-Control-Allow-Origin", "*");
          response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
          response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
          response.end();
          return;
        }

        if (request.method !== "GET") {
          next();
          return;
        }

        if (url.pathname === "/v1/health") {
          sendJson(response, {
            data: {
              service: "rawaj-e2e-fixture",
              version: "v1",
              database: "ready",
            },
          });
          return;
        }

        if (url.pathname === "/v1/references") {
          sendJson(response, {
            data: {
              categories: fixtureCategories,
              subcategories: fixtureSubcategories,
              governorates: fixtureGovernorates,
              taxonomyNodes: fixtureTaxonomyNodes,
            },
          });
          return;
        }

        if (url.pathname === "/v1/ad-placements") {
          sendJson(response, {
            data: [
              {
                id: "00000000-0000-4000-8000-000000000001",
                imageUrl: FIXTURE_AD_IMAGE,
                destinationUrl: "https://example.com/rawaj-ad",
                priority: 100,
              },
            ],
          });
          return;
        }

        if (url.pathname === "/v1/listings") {
          sendJson(response, {
            data: selectFixtureListings(url),
          });
          return;
        }

        const taxonomyMatch = url.pathname.match(/^\/v1\/listings\/([^/]+)\/taxonomy$/);
        if (taxonomyMatch) {
          const listingId = decodeURIComponent(taxonomyMatch[1] ?? "");
          const listing = fixtureListings.find((item) => item.id === listingId);

          if (!listing) {
            next();
            return;
          }

          sendJson(response, {
            data: {
              listingId,
              taxonomyNodeId: String(listing.details._taxonomy_node_id),
              assignmentSource: "explicit",
              updatedAt: FIXTURE_TIMESTAMP,
            },
          });
          return;
        }

        const listingMatch = url.pathname.match(/^\/v1\/listings\/([^/]+)$/);
        if (listingMatch) {
          const listingId = decodeURIComponent(listingMatch[1] ?? "");
          const listing = fixtureListings.find((item) => item.id === listingId);

          if (!listing) {
            next();
            return;
          }

          sendJson(response, {
            data: {
              listing,
              images: fixtureImages(listingId),
            },
          });
          return;
        }

        if (url.pathname === "/v1/sellers") {
          sendJson(response, {
            data: [],
          });
          return;
        }
        const sellerMatch = url.pathname.match(/^\/v1\/sellers\/([^/]+)$/);
        if (sellerMatch) {
          const sellerId = decodeURIComponent(sellerMatch[1] ?? "");

          if (sellerId !== SELLER_ID) {
            next();
            return;
          }

          sendJson(response, {
            data: {
              id: SELLER_ID,
              displayName: "بائع رواج التجريبي",
              verified: true,
              joinedAt: FIXTURE_TIMESTAMP,
              locationAr: "دمشق",
              bio: "حساب ثابت مخصص لاختبارات المتصفح.",
              businessName: null,
              avatarUrl: null,
              coverUrl: null,
              approvedListingCount: fixtureListings.length,
              inventoryStatus: "ready",
              listingDisplayLimit: 12,
              ratingSummary: null,
              reviews: [],
              reviewsStatus: "ready",
              approvedReviewCount: 0,
              reviewDisplayLimit: 6,
              listings: fixtureListings,
            },
          });
          return;
        }

        next();
      });
    },
  };
}
