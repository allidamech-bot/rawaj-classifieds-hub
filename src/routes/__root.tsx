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
import { AuthProvider } from "@/lib/auth";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { shouldShowSiteFooter, shouldShowBottomNav } from "@/lib/primary-navigation";
import { createSeo } from "@/lib/seo";
import { UiPreferencesProvider, useUiPreferences } from "@/lib/ui-preferences";
import homeSignatureCss from "../home-signature.css?url";
import listingStudioSignatureCss from "../listing-studio-signature.css?url";
import messagingSignatureCss from "../messaging-signature.css?url";
import offersSignatureCss from "../offers-signature.css?url";
import signatureCss from "../signature.css?url";
import appCss from "../styles.css?url";

const ROOT_TITLE = "RAWAJ / رواج | سوق إعلانات مبوبة في سوريا";
const ROOT_DESCRIPTION =
  "سوق إعلانات مبوبة في سوريا لبيع وشراء العقارات والسيارات والمنتجات والخدمات بطريقة آمنة ومنظمة.";

function NotFoundComponent() {
  const { text } = useUiPreferences();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-extrabold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-bold text-foreground">
          {text("الصفحة غير موجودة", "Page not found")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {text(
            "الصفحة التي تبحث عنها غير متاحة أو تم نقلها.",
            "The page you are looking for is unavailable or has moved.",
          )}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {text("العودة للرئيسية", "Back to home")}
          </Link>
        </div>
      </div>
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
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-foreground">
          {text("حدث خطأ غير متوقع", "Something went wrong")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {text("حاول تحديث الصفحة أو العودة للرئيسية.", "Refresh the page or return home.")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            {text("إعادة المحاولة", "Try again")}
          </button>
          <a
            href="/"
            className="rounded-xl border border-input bg-card px-5 py-2.5 text-sm font-bold text-foreground"
          >
            {text("الرئيسية", "Home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#123047" },
      { name: "author", content: "RAWAJ" },
      ...createSeo({ title: ROOT_TITLE, description: ROOT_DESCRIPTION }).meta,
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: signatureCss },
      { rel: "stylesheet", href: homeSignatureCss },
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
        href: "https://fonts.googleapis.com/css2?family=Alexandria:wght@500;600;700;800&family=Cairo:wght@400;500;600;700;800;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Tajawal:wght@500;700;800;900&display=swap",
      },
    ],
  }),
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

  return (
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <AuthProvider>
          <HtmlAttributes />
          <div
            className={`min-h-dvh bg-background text-foreground lg:pb-8 ${
              showBottomNav ? "pb-24" : "pb-6"
            }`}
          >
            <Outlet />
            {showFooter && <SiteFooter />}
          </div>
          <BottomNav />
        </AuthProvider>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}
