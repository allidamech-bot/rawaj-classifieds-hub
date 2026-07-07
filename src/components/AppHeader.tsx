import { Link, useRouterState } from "@tanstack/react-router";
import { Languages, LogIn, Plus, User, UserCog } from "lucide-react";
import { NotificationTrigger } from "@/components/NotificationTrigger";
import { resolvePrimaryNavigationSection } from "@/lib/primary-navigation";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

interface Props {
  compact?: boolean;
  title?: string;
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
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/92 text-foreground shadow-[0_6px_24px_rgba(14,42,68,0.05)] backdrop-blur-xl">
      <div
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-orange via-gold to-brand-orange/70"
        aria-hidden="true"
      />

      <div className="container-wide flex min-h-14 items-center gap-2 py-1.5 sm:min-h-16 sm:gap-4 sm:py-2 lg:min-h-[4.5rem]">
        <Link to="/" className="group order-1 flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo />
        </Link>

        {compact && title ? (
          <h1 className="order-2 ms-1 flex-1 truncate text-sm font-extrabold text-primary sm:text-base lg:hidden">
            {title}
          </h1>
        ) : null}

        <nav
          aria-label={text("التنقل الرئيسي", "Primary navigation")}
          className="order-2 ms-6 hidden items-center gap-1 lg:flex"
        >
          {navItems.map((item) => {
            const active = activeSection === item.section;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-card hover:text-primary"
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
            className="hidden h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-extrabold text-primary-foreground shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-navy lg:inline-flex"
          >
            <Plus className="h-4 w-4" />
            {text("أضف إعلان", "Post listing")}
          </Link>

          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={text("تبديل اللغة", "Switch language")}
            title={text("العربية / English", "English / العربية")}
            className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full bg-card px-3 text-[11px] font-bold text-muted-foreground hairline transition hover:border-gold/60 hover:text-primary sm:inline-flex"
          >
            <Languages className="h-4 w-4" />
            <span>{language === "ar" ? "English" : "العربية"}</span>
          </button>

          <NotificationTrigger tone="light" />

          {auth.canAccessOwnerControls ? (
            <Link
              to="/admin"
              aria-label={text("لوحة المالك", "Owner dashboard")}
              title={text("لوحة المالك", "Owner dashboard")}
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-gold-foreground shadow-soft transition hover:-translate-y-0.5 sm:grid"
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
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-primary hairline shadow-soft transition hover:bg-muted-surface active:scale-[0.98] sm:h-10 sm:w-10"
          >
            {auth.status === "signedIn" ? (
              <User className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2 sm:gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary shadow-soft sm:h-10 sm:w-10">
        <img
          src="/brand/rawaj-mark-transparent-header.png"
          alt="RAWAJ"
          decoding="async"
          className="h-7 w-auto object-contain sm:h-8"
        />
      </span>

      <span className="flex items-center gap-1.5 leading-none sm:gap-2">
        <span className="text-base font-extrabold text-primary sm:text-lg">رواج</span>
        <span className="h-4 w-px bg-gold/70 sm:h-5" aria-hidden="true" />
        <span className="text-[9px] font-extrabold tracking-[0.2em] text-brand-orange sm:text-[10px]">
          RAWAJ
        </span>
      </span>
    </span>
  );
}
