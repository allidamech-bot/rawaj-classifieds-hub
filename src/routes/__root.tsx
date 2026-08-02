import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { Analytics } from "@vercel/analytics/react";
import { Suspense, lazy, useEffect, type ReactNode } from "react";

import { FeedbackState } from "@/components/feedback/FeedbackState";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import {
  ListingComparisonProvider,
  useListingComparison,
} from "@/features/comparison/listing-comparison";
import { AuthProvider } from "@/lib/auth";
import { rawajBuildInfo } from "@/lib/build-info";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { resolveRouteStyleScope, routeStyleHrefs } from "@/lib/route-styles";
import { buildSiteStructuredData, createSeo, jsonLdScript } from "@/lib/seo";
import { UiPreferencesProvider, useUiPreferences } from "@/lib/ui-preferences";
import { UnreadActivityProvider } from "@/lib/unread-activity";
import { useAuth } from "@/lib/use-auth";
import adaptiveListingCardsCss from "../adaptive-listing-cards.css?url";
import authAccountFoundationCss from "../auth-account-foundation.css?url";
import authAccountV2Css from "../auth-account-v2.css?url";
import comparisonFoundationCss from "../comparison-foundation.css?url";
import designSystemV2Css from "../design-system-v2.css?url";
import desktopExperienceV1Css from "../desktop-experience-v1.css?url";
import designFoundationCss from "../design-foundation.css?url";
import discoveryMarketplaceV4Css from "../discovery-marketplace-v4.css?url";
import launchReadinessVisualPolishCss from "../launch-readiness-visual-polish.css?url";
import marketplaceDiscoveryCss from "../marketplace-discovery.css?url";
import marketplaceSystemCss from "../marketplace-system.css?url";
import signatureCss from "../signature.css?url";
import spatialAppShellCss from "../spatial-app-shell.css?url";
import appCss from "../styles.css?url";
import visualFoundationCss from "../visual-foundation.css?url";

const ROOT_TITLE = "RAWAJ / رواج | سوق إعلانات مبوبة في السعودية";
const ROOT_DESCRIPTION =
  "سوق إعلانات مبوبة في السعودية لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة آمنة ومنظمة.";

const LazyDraftRecoveryBanner = lazy(() =>
  import("@/features/listing-studio/DraftRecoveryBanner").then((module) => ({
    default: module.DraftRecoveryBanner,
  })),
);
const LazyViewedBeforeBanner = lazy(() =>
  import("@/features/listing-detail/ViewedBeforeBanner").then((module) => ({
    default: module.ViewedBeforeBanner,
  })),
);
const LazyExistingConversationBanner = lazy(() =>
  import("@/features/listing-detail/ExistingConversationBanner").then((module) => ({
    default: module.ExistingConversationBanner,
  })),
);
const LazySavedSearchAlertBackgroundScanner = lazy(() =>
  import("@/features/saved-searches/SavedSearchAlertBackgroundScanner").then((module) => ({
    default: module.SavedSearchAlertBackgroundScanner,
  })),
);
const LazyListingComparisonDock = lazy(() => import("@/features/comparison/ListingComparisonDock"));

function NotFoundComponent() {
  const { text } = useUiPreferences();

  return (
    <>
      <title>{text("الصفحة غير موجودة | رواج", "Page not found | RAWAJ")}</title>
      <meta name="robots" content="noindex, nofollow" />
      <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
        <FeedbackState
          code="404"
          title={text("الصفحة غير موجودة", "Page not found")}
          description={text(
            "الصفحة التي تبحث عنها غير متاحة أو تم نقلها.",
            "The page you are looking for is unavailable or has moved.",
          )}
          action={
            <Button asChild>
              <Link to="/">{text("العودة للرئيسية", "Back to home")}</Link>
            </Button>
          }
        />
      </div>
    </>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const { text } = useUiPreferences();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <FeedbackState
        tone="error"
        title={text("حدث خطأ غير متوقع", "Something went wrong")}
        description={text(
          "تعذر إكمال الطلب الآن. حاول مرة أخرى.",
          "The request could not be completed. Try again.",
        )}
        action={
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            {text("إعادة المحاولة", "Try again")}
          </Button>
        }
      />
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    const seo = createSeo({ title: ROOT_TITLE, description: ROOT_DESCRIPTION });
    const activeMatch = matches[matches.length - 1];
    const routeStyleScope = resolveRouteStyleScope(activeMatch?.pathname ?? "/");
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#242529" },
        { name: "author", content: "RAWAJ" },
        { name: "rawaj-build-commit", content: rawajBuildInfo.commitSha },
        { name: "rawaj-build-environment", content: rawajBuildInfo.environment },
        ...seo.meta,
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "stylesheet", href: visualFoundationCss },
        { rel: "stylesheet", href: signatureCss },
        ...(routeStyleScope.home
          ? [{ rel: "stylesheet", href: routeStyleHrefs.homeSignature }]
          : []),
        { rel: "stylesheet", href: marketplaceDiscoveryCss },
        ...(routeStyleScope.listingResults
          ? [{ rel: "stylesheet", href: routeStyleHrefs.listingsResults }]
          : []),
        ...(routeStyleScope.listingDetail
          ? [{ rel: "stylesheet", href: routeStyleHrefs.listingDetailFoundation }]
          : []),
        { rel: "stylesheet", href: authAccountFoundationCss },
        { rel: "stylesheet", href: authAccountV2Css },
        ...(routeStyleScope.personalSpace
          ? [{ rel: "stylesheet", href: routeStyleHrefs.activityMoreFoundation }]
          : []),
        ...(routeStyleScope.trustSupport
          ? [{ rel: "stylesheet", href: routeStyleHrefs.trustSupportHubV2 }]
          : []),
        ...(routeStyleScope.storefront
          ? [{ rel: "stylesheet", href: routeStyleHrefs.sellerStorefrontFoundation }]
          : []),
        ...(routeStyleScope.storefront
          ? [{ rel: "stylesheet", href: routeStyleHrefs.sellerStorefrontV2 }]
          : []),
        ...(routeStyleScope.ownerStore
          ? [{ rel: "stylesheet", href: routeStyleHrefs.myStoreRedesign }]
          : []),
        ...(routeStyleScope.offers
          ? [{ rel: "stylesheet", href: routeStyleHrefs.offersSignature }]
          : []),
        ...(routeStyleScope.listingStudio
          ? [{ rel: "stylesheet", href: routeStyleHrefs.listingStudioSignature }]
          : []),
        ...(routeStyleScope.listingStudio
          ? [{ rel: "stylesheet", href: routeStyleHrefs.listingStudioV2 }]
          : []),
        ...(routeStyleScope.listingStudio
          ? [{ rel: "stylesheet", href: routeStyleHrefs.listingStudioV3 }]
          : []),
        ...(routeStyleScope.listingStudio
          ? [{ rel: "stylesheet", href: routeStyleHrefs.listingStudioV4 }]
          : []),
        ...(routeStyleScope.communication
          ? [{ rel: "stylesheet", href: routeStyleHrefs.communicationCenterV2 }]
          : []),
        ...(routeStyleScope.messaging
          ? [{ rel: "stylesheet", href: routeStyleHrefs.messagingV4 }]
          : []),
        { rel: "stylesheet", href: comparisonFoundationCss },
        { rel: "stylesheet", href: marketplaceSystemCss },
        ...(routeStyleScope.ownerStore
          ? [{ rel: "stylesheet", href: routeStyleHrefs.myStoreHeaderRefinement }]
          : []),
        ...(routeStyleScope.ownerStore
          ? [{ rel: "stylesheet", href: routeStyleHrefs.myStoreBrandPolish }]
          : []),
        ...(routeStyleScope.personalSpace
          ? [{ rel: "stylesheet", href: routeStyleHrefs.personalSpacePolish }]
          : []),
        { rel: "stylesheet", href: designSystemV2Css },
        { rel: "stylesheet", href: spatialAppShellCss },
        ...(routeStyleScope.home
          ? [{ rel: "stylesheet", href: routeStyleHrefs.homeMarketplaceV2 }]
          : []),
        ...(routeStyleScope.home
          ? [{ rel: "stylesheet", href: routeStyleHrefs.homeDiscoveryV3 }]
          : []),
        { rel: "stylesheet", href: adaptiveListingCardsCss },
        ...(routeStyleScope.listingResults
          ? [{ rel: "stylesheet", href: routeStyleHrefs.searchFiltersV1 }]
          : []),
        ...(routeStyleScope.listingResults
          ? [{ rel: "stylesheet", href: routeStyleHrefs.searchFiltersV2 }]
          : []),
        ...(routeStyleScope.listingDetail
          ? [{ rel: "stylesheet", href: routeStyleHrefs.listingDetailV2 }]
          : []),
        ...(routeStyleScope.listingDetail
          ? [{ rel: "stylesheet", href: routeStyleHrefs.listingDetailV3 }]
          : []),
        { rel: "stylesheet", href: desktopExperienceV1Css },
        { rel: "stylesheet", href: launchReadinessVisualPolishCss },
        { rel: "stylesheet", href: designFoundationCss },
        { rel: "stylesheet", href: discoveryMarketplaceV4Css },
        { rel: "icon", href: "/favicon.ico" },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/brand/rawaj-mark-transparent-192.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap",
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <script {...jsonLdScript(buildSiteStructuredData())} />
        <Analytics />
        <Scripts />
      </body>
    </html>
  );
}

function HtmlAttributes() {
  const { language } = useUiPreferences();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language === "en" ? "en" : "ar";
    root.dir = language === "en" ? "ltr" : "rtl";
  }, [language]);

  return null;
}

function DeferredAccountBackgroundServices() {
  const auth = useAuth();
  const profileId = auth.profile?.id ?? null;

  if (auth.status !== "signedIn" || !profileId) return null;

  return (
    <Suspense fallback={null}>
      <LazySavedSearchAlertBackgroundScanner key={profileId} />
    </Suspense>
  );
}

function DeferredRouteAnnouncements({
  showDraftRecovery,
  listingDetailId,
}: {
  showDraftRecovery: boolean;
  listingDetailId: string | null;
}) {
  if (!showDraftRecovery && !listingDetailId) return null;

  return (
    <Suspense fallback={null}>
      {showDraftRecovery ? <LazyDraftRecoveryBanner /> : null}
      {listingDetailId ? <LazyViewedBeforeBanner listingId={listingDetailId} /> : null}
      {listingDetailId ? <LazyExistingConversationBanner listingId={listingDetailId} /> : null}
    </Suspense>
  );
}

function ListingComparisonDockBoundary() {
  const { entries } = useListingComparison();
  if (entries.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <LazyListingComparisonDock />
    </Suspense>
  );
}

function personalSpaceRouteClass(pathname: string) {
  if (pathname === "/favorites") return "rawaj-route-favorites";
  if (pathname === "/saved-searches") return "rawaj-route-saved-searches";
  if (pathname === "/activity") return "rawaj-route-activity";
  if (pathname === "/chats") return "rawaj-route-chats";
  if (pathname === "/notifications") return "rawaj-route-notifications";
  if (pathname === "/more") return "rawaj-route-more";
  if (pathname === "/profile" || pathname === "/profile/") return "rawaj-route-profile";
  return "";
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const routeNavigation = useRouterState({
    select: (state) => {
      const resolvedPathname = state.resolvedLocation?.pathname ?? state.location.pathname;
      return {
        resolvedPathname,
        pendingPathname: state.location.pathname,
        isRouteNavigating:
          Boolean(state.resolvedLocation) &&
          state.isLoading &&
          state.location.pathname !== resolvedPathname,
      };
    },
  });
  const { resolvedPathname, pendingPathname, isRouteNavigating } = routeNavigation;
  const showDraftRecovery = resolvedPathname === "/add-listing";
  const routeScopeClass = personalSpaceRouteClass(resolvedPathname);
  const listingDetailMatch = resolvedPathname.match(/^\/listings\/([^/]+)$/);
  const listingDetailId = listingDetailMatch?.[1]
    ? decodeURIComponent(listingDetailMatch[1])
    : null;

  return (
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <AuthProvider>
          <UnreadActivityProvider>
            <ListingComparisonProvider>
              <DeferredAccountBackgroundServices />
              <HtmlAttributes />
              <AppShell
                pathname={resolvedPathname}
                pendingPathname={pendingPathname}
                isRouteNavigating={isRouteNavigating}
                routeClassName={routeScopeClass}
                announcements={
                  <DeferredRouteAnnouncements
                    showDraftRecovery={showDraftRecovery}
                    listingDetailId={listingDetailId}
                  />
                }
              >
                <Outlet />
              </AppShell>
              <ListingComparisonDockBoundary />
            </ListingComparisonProvider>
          </UnreadActivityProvider>
        </AuthProvider>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}
