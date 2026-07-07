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
    <header className="sticky top-0 z-30 border-b border-border/75 bg-background/88 text-foreground shadow-[0_10px_34px_rgba(16,43,70,0.045)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/80 to-transparent" />
      <div className="absolute start-0 top-0 h-[2px] w-20 bg-gradient-to-r from-brand-orange to-gold" />

      <div className="container-wide flex min-h-14 items-center gap-2 py-1.5 sm:min-h-16 sm:gap-4 sm:py-2 lg:min-h-[4.5rem]">
        <Link to="/" className="group order-1 flex min-w-0 items-center gap-2 sm:gap-3">
          <Logo />
        </Link>

        {compact && title ? (
          <h1 className="order-2 ms-1 flex-1 truncate text-sm font-bold text-primary sm:text-base lg:hidden">
            {title}
          </h1>
        ) : null}

        <nav
          aria-label={text("التنقل الرئيسي", "Primary navigation")}
          className="order-2 ms-7 hidden items-center gap-1 lg:flex"
        >
          {navItems.map((item) => {
            const active = activeSection === item.section;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative rounded-full px-3.5 py-2 text-[13px] font-semibold transition duration-200 ${
                  active
                    ? "bg-card text-primary shadow-soft hairline"
                    : "text-muted-foreground hover:bg-card/70 hover:text-primary"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {active ? (
                  <span className="absolute inset-x-0 -bottom-1 mx-auto h-1 w-1 rounded-full bg-brand-orange" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="order-2 ms-auto" />

        <div className="order-3 flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            to="/add-listing"
            className="rawaj-button-primary hidden h-10 min-h-0 rounded-full px-4 text-[12px] lg:inline-flex"
          >
            <Plus className="h-4 w-4" strokeWidth={2.1} />
            {text("أضف إعلان", "Post listing")}
          </Link>

          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={text("تبديل اللغة", "Switch language")}
            title={text("العربية / English", "English / العربية")}
            className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full bg-card/80 px-3 text-[10px] font-semibold text-muted-foreground hairline transition hover:border-gold/55 hover:text-primary sm:inline-flex"
          >
            <Languages className="h-3.5 w-3.5" strokeWidth={1.9} />
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
            className="rawaj-icon-button h-9 w-9 shrink-0 sm:h-10 sm:w-10"
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
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5 sm:gap-3">
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-[0.95rem] bg-primary shadow-[0_7px_18px_rgba(16,43,70,0.16)] sm:h-10 sm:w-10">
        <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-brand-orange" />
        <img
          src="/brand/rawaj-mark-transparent-header.png"
          alt="RAWAJ"
          decoding="async"
          className="h-7 w-auto object-contain sm:h-8"
        />
      </span>

      <span className="flex items-center gap-1.5 leading-none sm:gap-2">
        <span className="font-display text-[15px] font-bold text-primary sm:text-[17px]">رواج</span>
        <span className="h-4 w-px bg-gold/65 sm:h-5" aria-hidden="true" />
        <span className="text-[8px] font-bold tracking-[0.24em] text-brand-orange sm:text-[9px]">
          RAWAJ
        </span>
      </span>
    </span>
  );
}
