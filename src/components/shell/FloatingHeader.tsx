import { Link, useRouterState } from "@tanstack/react-router";
import { Languages, LogIn, MapPin, Menu, Plus, Search, User, UserCog } from "lucide-react";

import { NotificationTrigger } from "@/components/NotificationTrigger";
import { OfflineNotice } from "@/components/OfflineNotice";
import { BrandLockup } from "@/components/shell/BrandLockup";
import { ShellHeaderFrame } from "@/components/shell/ShellHeaderFrame";
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
      <ShellHeaderFrame pathname={pathname} variant="brand">
        <Link
          to="/"
          className="rawaj-shell-header__brand flex min-w-0 items-center"
          aria-label={text("العودة إلى الرئيسية", "Back to home")}
        >
          <BrandLockup compact={compact} />
        </Link>

        {compact && title ? (
          <p className="rawaj-shell-header__compact-title min-w-0 flex-1 truncate text-sm font-bold lg:hidden">
            {title}
          </p>
        ) : null}

        {!compact ? (
          <Link
            to="/listings"
            search={{ open_filters: true }}
            className="rawaj-header-location hidden min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold xl:inline-flex"
            aria-label={text("تصفح الإعلانات في كل سوريا", "Browse listings across Syria")}
          >
            <MapPin className="h-4 w-4 text-brand-orange" strokeWidth={2.1} />
            <span>{text("كل سوريا", "All Syria")}</span>
          </Link>
        ) : null}

        <nav
          aria-label={text("التنقل الرئيسي", "Primary navigation")}
          className="rawaj-header-nav hidden items-center gap-1 rounded-2xl p-1 lg:flex"
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

        <div className="rawaj-shell-header__spacer min-w-0 flex-1" />

        <Link
          to="/listings"
          className="rawaj-header-search hidden min-h-11 min-w-[12rem] items-center gap-2 rounded-[var(--rawaj-radius-button)] px-3.5 text-sm xl:inline-flex"
          aria-label={text("ابحث في رواج", "Search RAWAJ")}
        >
          <Search className="h-4 w-4" strokeWidth={1.9} />
          <span className="truncate">{text("ابحث في رواج", "Search RAWAJ")}</span>
        </Link>

        <div className="rawaj-shell-header__actions flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            to="/add-listing"
            className="rawaj-header-cta hidden min-h-11 items-center gap-2 rounded-[var(--rawaj-radius-button)] px-4 text-sm font-bold lg:inline-flex"
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
              className="rawaj-header-admin rawaj-touch-target grid shrink-0 place-items-center rounded-[var(--rawaj-radius-button)]"
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
      </ShellHeaderFrame>
      <OfflineNotice />
    </>
  );
}
