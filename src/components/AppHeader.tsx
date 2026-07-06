import { Link, useRouterState } from "@tanstack/react-router";
import { Languages, LogIn, Plus, User, UserCog } from "lucide-react";
import { NotificationTrigger } from "@/components/NotificationTrigger";
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

  const navItems: Array<{ to: "/" | "/categories" | "/offers"; label: string; exact?: boolean }> = [
    { to: "/", label: text("الرئيسية", "Home"), exact: true },
    { to: "/categories", label: text("الأقسام", "Categories") },
    { to: "/offers", label: text("العروض", "Offers") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-gold/20 text-primary-foreground shadow-premium backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(120%_140%_at_100%_0%,#1b4e78_0%,#0e2740_45%,#08182a_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_100%_at_0%_100%,rgba(217,164,65,0.22),transparent_60%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </div>

      <div className="container-wide flex items-center gap-3 py-3 sm:gap-4 sm:py-4 lg:py-5">
        <Link to="/" className="order-1 flex min-w-0 items-center gap-2.5 group sm:gap-3">
          <Logo />
        </Link>

        {compact && title && (
          <h1 className="order-2 ms-1 flex-1 truncate text-base font-bold lg:hidden">{title}</h1>
        )}

        {/* Desktop primary nav */}
        <nav
          aria-label={text("التنقل الرئيسي", "Primary")}
          className="order-2 ms-6 hidden items-center gap-1 lg:flex"
        >
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                  active
                    ? "bg-primary-foreground/10 text-gold"
                    : "text-primary-foreground/85 hover:bg-primary-foreground/[0.06] hover:text-gold"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="order-2 ms-auto" />

        <div className="order-3 flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Desktop Add Listing CTA */}
          <Link
            to="/add-listing"
            className="hidden h-10 items-center gap-1.5 rounded-full bg-gradient-to-br from-gold via-gold/95 to-gold/70 px-4 text-sm font-extrabold text-gold-foreground shadow-soft ring-1 ring-gold/40 transition hover:brightness-105 lg:inline-flex"
          >
            <Plus className="h-4 w-4" />
            {text("أضف إعلان", "Post listing")}
          </Link>

          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={text("تبديل اللغة", "Switch language")}
            title={text("العربية / English", "English / العربية")}
            className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.06] px-3 text-[11px] font-bold text-primary-foreground/90 backdrop-blur transition hover:border-gold/50 hover:bg-primary-foreground/10 hover:text-gold sm:inline-flex"
          >
            <Languages className="h-4 w-4" />
            <span>{language === "ar" ? "English" : "العربية"}</span>
          </button>
          <NotificationTrigger tone="dark" />
          {auth.canAccessOwnerControls && (
            <Link
              to="/admin"
              aria-label={text("لوحة المالك", "Owner dashboard")}
              title={text("لوحة المالك", "Owner dashboard")}
              className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold via-gold/90 to-gold/60 text-gold-foreground shadow-soft ring-1 ring-gold/40 transition hover:from-gold hover:to-gold sm:grid"
            >
              <UserCog className="h-4 w-4" />
            </Link>
          )}
          <Link
            to={auth.status === "signedIn" ? "/profile" : "/login"}
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
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.06] text-primary-foreground/85 backdrop-blur transition hover:border-gold/50 hover:bg-primary-foreground/10 hover:text-gold active:scale-[0.98] sm:h-10 sm:w-10"
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
    <span className="flex items-center gap-2.5 sm:gap-3">
      <img
        src="/brand/rawaj-mark-transparent-header.png"
        alt="RAWAJ"
        decoding="async"
        className="h-16 w-auto shrink-0 object-contain sm:h-20"
      />

      <span className="flex items-center gap-2 leading-none sm:gap-2.5">
        <span className="text-base font-extrabold tracking-normal text-primary-foreground sm:text-xl">
          رواج
        </span>

        <span className="h-6 w-px bg-gold/80 sm:h-8" aria-hidden="true" />

        <span className="text-xs font-semibold tracking-[0.22em] text-gold sm:text-base">
          RAWAJ
        </span>
      </span>
    </span>
  );
}
