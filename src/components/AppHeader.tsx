import { Link, useRouterState } from "@tanstack/react-router";
import { Languages, LogIn, Plus, User, UserCog } from "lucide-react";
import { NotificationTrigger } from "@/components/NotificationTrigger";
import { PublicAdPlacementSlot } from "@/components/PublicAdPlacementSlot";
import type { AdPlacementPage } from "@/lib/api/ad-placements";
import { resolvePrimaryNavigationSection } from "@/lib/primary-navigation";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

interface Props {
  compact?: boolean;
  title?: string;
}

function resolveAdPlacementPage(pathname: string): AdPlacementPage | null {
  if (pathname === "/") return "home";
  if (pathname === "/listings" || pathname === "/listings/") return "search_results";
  if (pathname.startsWith("/listings/")) return "listing_detail";
  if (pathname === "/categories" || pathname === "/categories/") return "categories";
  if (pathname === "/offers" || pathname === "/offers/") return "offers";
  return null;
}

export function AppHeader({ compact = false, title }: Props) {
  const auth = useAuth();
  const { language, text, toggleLanguage } = useUiPreferences();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = resolvePrimaryNavigationSection(pathname);

  const navItems = [
    { to: "/" as const, section: "home" as const, label: text("الرئيسية", "Home") },
    {
      to: "/categories" as const,
      section: "categories" as const,
      label: text("الأقسام", "Categories"),
    },
    { to: "/offers" as const, section: "offers" as const, label: text("العروض", "Offers") },
  ];

  return (
    <>
      <header className="rawaj-app-header sticky top-0 z-30 text-foreground">
        <div className="container-wide flex min-h-[3.75rem] items-center gap-2 py-1.5 sm:min-h-16 sm:gap-4 sm:py-2 lg:min-h-[4.5rem]">
          <Link to="/" className="order-1 flex min-w-0 items-center gap-2 sm:gap-3">
            <Logo />
          </Link>

          {compact && title ? (
            <h1 className="order-2 ms-1 flex-1 truncate text-sm font-bold text-primary sm:text-base lg:hidden">
              {title}
            </h1>
          ) : null}

          <nav
            aria-label={text("التنقل الرئيسي", "Primary navigation")}
            className="order-2 ms-7 hidden items-center gap-1 rounded-2xl bg-card/70 p-1 ring-1 ring-border/70 lg:flex"
          >
            {navItems.map((item) => {
              const active = activeSection === item.section;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex min-h-10 items-center rounded-xl px-4 py-2 text-[13px] font-semibold transition-colors duration-150 ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted-surface hover:text-primary"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="order-2 ms-auto" />

          <div className="order-3 flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              to="/add-listing"
              className="hidden min-h-11 items-center gap-2 rounded-[var(--rawaj-radius-button)] bg-brand-orange px-4 text-[12px] font-extrabold text-white shadow-[0_10px_24px_rgba(217,111,50,0.24)] transition hover:bg-brand-orange/92 lg:inline-flex"
            >
              <Plus className="h-4 w-4" strokeWidth={2.1} />
              {text("أضف إعلان", "Post listing")}
            </Link>

            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={text("تبديل اللغة", "Switch language")}
              title={text("العربية / English", "English / العربية")}
              className="hidden min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--rawaj-radius-button)] bg-card px-3 text-[10px] font-semibold text-muted-foreground hairline transition-colors hover:border-primary/20 hover:bg-muted-surface hover:text-primary sm:inline-flex"
            >
              <Languages className="h-3.5 w-3.5" strokeWidth={1.9} />
              <span>{language === "ar" ? "English" : "العربية"}</span>
            </button>

            <NotificationTrigger tone="light" />

            {auth.canAccessAdmin ? (
              <Link
                to="/admin"
                aria-label={text("لوحة الإدارة", "Admin dashboard")}
                title={text("لوحة الإدارة", "Admin dashboard")}
                className="rawaj-touch-target grid shrink-0 place-items-center rounded-[var(--rawaj-radius-button)] bg-gold text-gold-foreground transition-colors hover:bg-gold/85"
              >
                <UserCog className="h-4 w-4" />
              </Link>
            ) : null}

            <Link
              to={auth.status === "signedIn" ? "/more" : "/login"}
              aria-label={
                auth.status === "signedIn"
                  ? text("حسابي", "My account")
                  : text("تسجيل الدخول", "Log in")
              }
              title={
                auth.status === "signedIn"
                  ? text("حسابي", "My account")
                  : text("تسجيل الدخول", "Log in")
              }
              className="rawaj-header-account rawaj-icon-button rawaj-touch-target shrink-0 shadow-none"
            >
              {auth.status === "signedIn" ? (
                <User className="h-4 w-4" strokeWidth={1.9} />
              ) : (
                <LogIn className="h-4 w-4" strokeWidth={1.9} />
              )}
            </Link>
          </div>
        </div>
      </header>
      <PublicAdPlacementSlot placementPage={resolveAdPlacementPage(pathname)} />
    </>
  );
}

function Logo() {
  return (
    <span className="rawaj-brand-lockup flex items-center gap-2.5 sm:gap-3">
      <span className="rawaj-brand-mark grid h-10 w-10 shrink-0 place-items-center">
        <img
          src="/brand/rawaj-mark-transparent-header.png"
          alt="RAWAJ"
          decoding="async"
          className="h-7 w-auto object-contain sm:h-8"
        />
      </span>

      <span className="flex items-center gap-1.5 leading-none sm:gap-2">
        <span className="font-display text-[17px] font-extrabold text-primary sm:text-[18px]">
          رواج
        </span>
        <span className="rawaj-brand-divider h-4 w-px sm:h-5" aria-hidden="true" />
        <span className="text-[8px] font-extrabold tracking-[0.22em] text-brand-orange sm:text-[9px]">
          RAWAJ
        </span>
      </span>
    </span>
  );
}
