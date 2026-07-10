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
import { useEffect, type ReactNode } from "react";

import { BottomNav } from "@/components/BottomNav";
import { SiteFooter } from "@/components/SiteFooter";
import { FeedbackState } from "@/components/feedback/FeedbackState";
import { Button } from "@/components/ui/button";
import { ExistingConversationBanner } from "@/features/listing-detail/ExistingConversationBanner";
import { ViewedBeforeBanner } from "@/features/listing-detail/ViewedBeforeBanner";
import { DraftRecoveryBanner } from "@/features/listing-studio/DraftRecoveryBanner";
import { AuthProvider } from "@/lib/auth";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { shouldShowSiteFooter, shouldShowBottomNav } from "@/lib/primary-navigation";
import { buildSiteStructuredData, createSeo, jsonLdScript } from "@/lib/seo";
import { UiPreferencesProvider, useUiPreferences } from "@/lib/ui-preferences";
import { UnreadActivityProvider } from "@/lib/unread-activity";
import activityMoreFoundationCss from "../activity-more-foundation.css?url";
import authAccountFoundationCss from "../auth-account-foundation.css?url";
import homeSignatureCss from "../home-signature.css?url";
import listingDetailFoundationCss from "../listing-detail-foundation.css?url";
import listingStudioSignatureCss from "../listing-studio-signature.css?url";
import listingsResultsCss from "../listings-results.css?url";
import marketplaceDiscoveryCss from "../marketplace-discovery.css?url";
import messagingSignatureCss from "../messaging-signature.css?url";
import offersSignatureCss from "../offers-signature.css?url";
import signatureCss from "../signature.css?url";
import appCss from "../styles.css?url";
import visualFoundationCss from "../visual-foundation.css?url";

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
        { name: "theme-color", content: "#123047" },
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
        { rel: "stylesheet", href: activityMoreFoundationCss },
        { rel: "stylesheet", href: offersSignatureCss },
        { rel: "stylesheet", href: listingStudioSignatureCss },
        { rel: "stylesheet", href: messagingSignatureCss },
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showFooter = shouldShowSiteFooter(pathname);
  const showBottomNav = shouldShowBottomNav(pathname);
  const showDraftRecovery = pathname === "/add-listing";
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
            <div
              className={`min-h-dvh bg-background text-foreground lg:pb-8 ${
                showBottomNav ? "rawaj-bottom-nav-offset" : "pb-6"
              }`}
            >
              {showDraftRecovery && <DraftRecoveryBanner />}
              {listingDetailId && <ViewedBeforeBanner listingId={listingDetailId} />}
              {listingDetailId && <ExistingConversationBanner listingId={listingDetailId} />}
              <Outlet />
              {showFooter && <SiteFooter />}
            </div>
            <BottomNav />
          </UnreadActivityProvider>
        </AuthProvider>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}
