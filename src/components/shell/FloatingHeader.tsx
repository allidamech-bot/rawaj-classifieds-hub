import { Link, useRouterState } from "@tanstack/react-router";
import { Languages, LogIn, MapPin, Plus, User, UserCog } from "lucide-react";

import { NotificationTrigger } from "@/components/NotificationTrigger";
import { OfflineNotice } from "@/components/OfflineNotice";
import { PublicAdPlacementSlot } from "@/components/PublicAdPlacementSlot";
import type { AdPlacementPage } from "@/lib/api/ad-placements";
import { resolvePrimaryNavigationSection } from "@/lib/primary-navigation";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export interface FloatingHeaderProps {
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

export function FloatingHeader({ compact = false, title }: FloatingHeaderProps) {
  const auth = useAuth();
  const { language, text, toggleLanguage } = useUiPreferences();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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
      <header
        className="rawaj-app-header sticky top-0 z-30 text-foreground"
        data-shell-region="header-region"
      >
        <div className="rawaj-floating-header-shell container-wide flex min-h-14 items-center gap-2 py-1.5 sm:min-h-[3.75rem] sm:gap-3 lg:min-h-16 lg:gap-4 lg:py-2">
          <Link
            to="/"
            className="order-1 flex min-w-0 items-center gap-2 sm:gap-3"
            aria-label={text("العودة إلى الرئيسية", "Back to home")}
          >
            <Logo />
          </Link>

          {compact && title ? (
            <h1 className="order-2 ms-1 flex-1 truncate font-display text-sm font-bold text-primary sm:text-base lg:hidden">
              {title}
            </h1>
          ) : (
            <Link
              to="/listings"
              search={{ open_filters: true }}
              className="rawaj-header-location order-2 hidden min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold md:inline-flex lg:px-3.5"
              aria-label={text("تصفح الإعلانات في كل سوريا", "Browse listings across Syria")}
            >
              <MapPin className="h-4 w-4 text-brand-orange" strokeWidth={2.1} />
              <span>{text("كل سوريا", "All Syria")}</span>
            </Link>
          )}

          <nav
            aria-label={text("التنقل الرئيسي", "Primary navigation")}
            className="rawaj-header-nav order-2 ms-4 hidden items-center gap-1 rounded-2xl p-1 lg:flex"
          >
            {navItems.map((item) => {
              const active = activeSection === item.section;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-active={active}
                  className="rawaj-header-nav-item inline-flex min-h-11 items-center rounded-xl px-4 py-2 text-[13px] font-semibold"
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
              className="rawaj-header-cta hidden min-h-11 items-center gap-2 rounded-[var(--rawaj-radius-button)] bg-brand-orange px-4 text-xs font-bold text-white shadow-[0_8px_20px_rgba(244,95,56,0.18)] transition hover:bg-brand-orange/92 lg:inline-flex"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              {text("أضف إعلان", "Post listing")}
            </Link>

            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={text("تبديل اللغة", "Switch language")}
              title={text("العربية / English", "English / العربية")}
              className="rawaj-header-action hidden min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--rawaj-radius-button)] px-3 text-xs font-medium lg:inline-flex"
            >
              <Languages className="h-4 w-4" strokeWidth={1.9} />
              <span>{language === "ar" ? "English" : "العربية"}</span>
            </button>

            <NotificationTrigger tone="light" />

            {auth.canAccessAdmin ? (
              <Link
                to="/admin"
                aria-label={text("لوحة الإدارة", "Admin dashboard")}
                title={text("لوحة الإدارة", "Admin dashboard")}
                className="rawaj-touch-target grid shrink-0 place-items-center rounded-[var(--rawaj-radius-button)] bg-gold text-gold-foreground shadow-[var(--rawaj-shadow-xs)] transition-colors hover:bg-gold/85"
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
              className="rawaj-header-account rawaj-header-action rawaj-touch-target grid shrink-0 place-items-center rounded-[var(--rawaj-radius-button)]"
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
      <OfflineNotice />
      <PublicAdPlacementSlot placementPage={resolveAdPlacementPage(pathname)} />
    </>
  );
}

function Logo() {
  return (
    <span className="rawaj-brand-lockup flex items-center gap-2 sm:gap-2.5">
      <span className="rawaj-brand-mark grid h-9 w-9 shrink-0 place-items-center sm:h-10 sm:w-10">
        <img
          src="/brand/rawaj-mark-transparent-192.png"
          alt=""
          decoding="async"
          width={32}
          height={32}
          draggable={false}
          className="h-7 w-auto object-contain sm:h-8"
        />
      </span>

      <span className="flex items-center gap-1.5 leading-none sm:gap-2">
        <span className="font-display text-base font-bold text-primary sm:text-[18px]">رواج</span>
        <span className="rawaj-brand-divider h-4 w-px sm:h-5" aria-hidden="true" />
        <span className="text-[11px] font-bold tracking-[0.16em] text-brand-orange">RAWAJ</span>
      </span>
    </span>
  );
}
