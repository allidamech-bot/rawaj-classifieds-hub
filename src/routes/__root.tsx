import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { BottomNav } from "@/components/BottomNav";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthProvider } from "@/lib/auth";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { UiPreferencesProvider, useUiPreferences } from "@/lib/ui-preferences";
import appCss from "../styles.css?url";

const ROOT_TITLE = "رَوَاج | سوق سوريا المجاني للإعلانات";
const ROOT_DESCRIPTION =
  "سوق إعلانات مبوبة مجاني لسوريا. بيع واشتري سيارات، عقارات، موبايلات، وظائف وخدمات حسب المحافظة بسهولة وبدون تعقيد.";

function NotFoundComponent() {
  const { text } = useUiPreferences();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
      { name: "theme-color", content: "#101722" },
      { title: ROOT_TITLE },
      { name: "description", content: ROOT_DESCRIPTION },
      { name: "author", content: "RAWAJ" },
      { property: "og:title", content: ROOT_TITLE },
      { property: "og:description", content: ROOT_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: ROOT_TITLE },
      { name: "twitter:description", content: ROOT_DESCRIPTION },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@500;700;800;900&display=swap",
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
        <AuthProvider>
          <div className="min-h-screen bg-background pb-24 text-foreground lg:pb-8">
            <Outlet />
            <SiteFooter />
          </div>
          <BottomNav />
        </AuthProvider>
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}
