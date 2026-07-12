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
import { useEffect, type ReactNode } from "react";

import { FeedbackState } from "@/components/feedback/FeedbackState";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/button";
import { ExistingConversationBanner } from "@/features/listing-detail/ExistingConversationBanner";
import { ViewedBeforeBanner } from "@/features/listing-detail/ViewedBeforeBanner";
import { DraftRecoveryBanner } from "@/features/listing-studio/DraftRecoveryBanner";
import { AuthProvider } from "@/lib/auth";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { buildSiteStructuredData, createSeo, jsonLdScript } from "@/lib/seo";
import { UiPreferencesProvider, useUiPreferences } from "@/lib/ui-preferences";
import { UnreadActivityProvider } from "@/lib/unread-activity";
import adaptiveListingCardsCss from "../adaptive-listing-cards.css?url";
import activityMoreFoundationCss from "../activity-more-foundation.css?url";
import trustSupportHubV2Css from "../trust-support-hub-v2.css?url";
import authAccountFoundationCss from "../auth-account-foundation.css?url";
import authAccountV2Css from "../auth-account-v2.css?url";
import designSystemV2Css from "../design-system-v2.css?url";
import homeDiscoveryV3Css from "../home-discovery-v3.css?url";
import homeMarketplaceV2Css from "../home-marketplace-v2.css?url";
import homeSignatureCss from "../home-signature.css?url";
import listingDetailFoundationCss from "../listing-detail-foundation.css?url";
import listingDetailV2Css from "../listing-detail-v2.css?url";
import listingStudioSignatureCss from "../listing-studio-signature.css?url";
import listingStudioV2Css from "../listing-studio-v2.css?url";
import listingsResultsCss from "../listings-results.css?url";
import marketplaceDiscoveryCss from "../marketplace-discovery.css?url";
import messagingSignatureCss from "../messaging-signature.css?url";
import communicationCenterV2Css from "../communication-center-v2.css?url";
import myStoreBrandPolishCss from "../my-store-brand-polish.css?url";
import myStoreHeaderRefinementCss from "../my-store-header-refinement.css?url";
import myStoreRedesignCss from "../my-store-redesign.css?url";
import offersSignatureCss from "../offers-signature.css?url";
import personalSpacePolishCss from "../personal-space-polish.css?url";
import searchFiltersV1Css from "../search-filters-v1.css?url";
import sellerStorefrontFoundationCss from "../seller-storefront-foundation.css?url";
import sellerStorefrontV2Css from "../seller-storefront-v2.css?url";
import signatureCss from "../signature.css?url";
import spatialAppShellCss from "../spatial-app-shell.css?url";
import appCss from "../styles.css?url";
import visualFoundationCss from "../visual-foundation.css?url";
import marketplaceSystemCss from "../marketplace-system.css?url";

const ROOT_TITLE = "RAWAJ / رواج | سوق إعلانات مبوبة في سوريا";
const ROOT_DESCRIPTION =
  "سوق إعلانات مبوبة في سوريا لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة آمنة ومنظمة.";

function NotFoundComponent() {
  const { text } = useUiPreferences();

  return (
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
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { text } = useUiPreferences();

  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
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
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const seo = createSeo({ title: ROOT_TITLE, description: ROOT_DESCRIPTION });
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#123f38" },
        { name: "author", content: "RAWAJ" },
        ...seo.meta,
      ],
      links: [
        ...seo.links,
        { rel: "stylesheet", href: appCss },
        { rel: "stylesheet", href: visualFoundationCss },
        { rel: "stylesheet", href: signatureCss },
        { rel: "stylesheet", href: homeSignatureCss },
        { rel: "stylesheet", href: marketplaceDiscoveryCss },
        { rel: "stylesheet", href: listingsResultsCss },
        { rel: "stylesheet", href: listingDetailFoundationCss },
        { rel: "stylesheet", href: authAccountFoundationCss },
        { rel: "stylesheet", href: authAccountV2Css },
        { rel: "stylesheet", href: activityMoreFoundationCss },
        { rel: "stylesheet", href: trustSupportHubV2Css },
        { rel: "stylesheet", href: sellerStorefrontFoundationCss },
        { rel: "stylesheet", href: sellerStorefrontV2Css },
        { rel: "stylesheet", href: myStoreRedesignCss },
        { rel: "stylesheet", href: offersSignatureCss },
        { rel: "stylesheet", href: listingStudioSignatureCss },
        { rel: "stylesheet", href: listingStudioV2Css },
        { rel: "stylesheet", href: messagingSignatureCss },
        { rel: "stylesheet", href: communicationCenterV2Css },
        { rel: "stylesheet", href: marketplaceSystemCss },
        { rel: "stylesheet", href: myStoreHeaderRefinementCss },
        { rel: "stylesheet", href: myStoreBrandPolishCss },
        { rel: "stylesheet", href: personalSpacePolishCss },
        { rel: "stylesheet", href: designSystemV2Css },
        { rel: "stylesheet", href: spatialAppShellCss },
        { rel: "stylesheet", href: homeMarketplaceV2Css },
        { rel: "stylesheet", href: homeDiscoveryV3Css },
        { rel: "stylesheet", href: adaptiveListingCardsCss },
        { rel: "stylesheet", href: searchFiltersV1Css },
        { rel: "stylesheet", href: listingDetailV2Css },
        { rel: "icon", href: "/favicon.ico" },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/brand/rawaj-mark-transparent-192.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Alexandria:wght@500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap",
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showDraftRecovery = pathname === "/add-listing";
  const routeScopeClass = personalSpaceRouteClass(pathname);
  const listingDetailMatch = pathname.match(/^\/listings\/([^/]+)$/);
  const listingDetailId = listingDetailMatch?.[1]
    ? decodeURIComponent(listingDetailMatch[1])
    : null;

  return (
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <AuthProvider>
          <UnreadActivityProvider>
            <HtmlAttributes />
            <AppShell
              pathname={pathname}
              routeClassName={routeScopeClass}
              announcements={
                <>
                  {showDraftRecovery ? <DraftRecoveryBanner /> : null}
                  {listingDetailId ? <ViewedBeforeBanner listingId={listingDetailId} /> : null}
                  {listingDetailId ? (
                    <ExistingConversationBanner listingId={listingDetailId} />
                  ) : null}
                </>
              }
            >
              <Outlet />
            </AppShell>
          </UnreadActivityProvider>
        </AuthProvider>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}
