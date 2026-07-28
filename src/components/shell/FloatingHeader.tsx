import { Link, useRouterState } from "@tanstack/react-router";
import { Languages, LogIn, MapPin, Menu, Plus, User, UserCog } from "lucide-react";

import { NotificationTrigger } from "@/components/NotificationTrigger";
import { OfflineNotice } from "@/components/OfflineNotice";
import { PublicAdPlacementSlot } from "@/components/PublicAdPlacementSlot";
import { BrandLockup } from "@/components/shell/BrandLockup";
import { resolveAdPlacementPage } from "@/lib/ad-placement-route";
import { resolvePrimaryNavigationSection } from "@/lib/primary-navigation";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export interface FloatingHeaderProps {
  compact?: boolean;
  title?: string;
}

export function FloatingHeader({ compact = false, title }: FloatingHeaderProps) {
  const auth = useAuth();
  const { language, text, toggleLanguage } = useUiPreferences();
  const pathname = useRouterState({
    select: (state) => state.resolvedLocation?.pathname ?? state.location.pathname,
  });
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
        data-resolved-pathname={pathname}
      >
        <div className="rawaj-floating-header-shell container-wide flex min-h-14 items-center gap-2 py-1.5 sm:min-h-[3.75rem] sm:gap-3 lg:min-h-16 lg:gap-4 lg:py-2">
          <Link
            to="/"
            className="order-1 flex min-w-0 items-center gap-2 sm:gap-3"
            aria-label={text("العودة إلى الرئيسية", "Back to home")}
          >
            <BrandLockup compact={compact} />
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
              className="rawaj-header-cta hidden min-h-11 items-center gap-2 rounded-[var(--rawaj-radius-button)] bg-brand-orange px-4 text-sm font-bold text-white shadow-[var(--rawaj-shadow-xs)] transition-colors hover:bg-brand-orange/92 lg:inline-flex"
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

            {pathname === "/" ? (
              <Link
                to="/categories"
                aria-label={text("فتح الأقسام", "Open categories")}
                title={text("الأقسام", "Categories")}
                className="rawaj-home-menu-action rawaj-touch-target grid shrink-0 place-items-center rounded-[var(--rawaj-radius-button)] lg:hidden"
              >
                <Menu className="h-4 w-4" strokeWidth={1.9} />
              </Link>
            ) : null}

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
