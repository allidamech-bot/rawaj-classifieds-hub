import { Link, useNavigate } from "@tanstack/react-router";
import { Languages, LogIn, MapPin, User, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationTrigger } from "@/components/NotificationTrigger";
import { fetchPublicGovernorates } from "@/lib/classifieds-api";
import type { ClassifiedGovernorate } from "@/lib/classifieds-types";
import { governorateName } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

interface Props {
  compact?: boolean;
  title?: string;
}

export function AppHeader({ compact = false, title }: Props) {
  const [open, setOpen] = useState(false);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, text, toggleLanguage } = useUiPreferences();

  useEffect(() => {
    let cancelled = false;
    async function loadGovernorates() {
      const result = await fetchPublicGovernorates();
      if (!cancelled && result.ok) setGovernorates(result.data);
    }
    void loadGovernorates();
    return () => {
      cancelled = true;
    };
  }, []);

  function goToGovernorate(governorateId?: string) {
    setOpen(false);
    if (governorateId) {
      void navigate({ to: "/listings", search: { gov: governorateId } });
      return;
    }
    void navigate({ to: "/listings" });
  }

  return (
    <header className="sticky top-0 z-30 overflow-hidden border-b border-gold/20 text-primary-foreground shadow-premium backdrop-blur-xl">
      {/* Luxe layered background */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_140%_at_100%_0%,#1b4e78_0%,#0e2740_45%,#08182a_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_100%_at_0%_100%,rgba(217,164,65,0.22),transparent_60%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <div className="container-wide flex items-center gap-3 py-3 sm:gap-6 sm:py-4 lg:py-5">
        {/* Far-left action cluster (visual left in RTL = end) */}
        <div className="order-3 flex shrink-0 items-center gap-1.5 sm:gap-2">
          <NotificationTrigger tone="dark" />
          {auth.canAccessOwnerControls && (
            <Link
              to="/admin"
              aria-label={text("لوحة المالك", "Owner dashboard")}
              title={text("لوحة المالك", "Owner dashboard")}
              className="hidden h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold via-gold/90 to-gold/60 text-gold-foreground shadow-soft ring-1 ring-gold/40 transition hover:from-gold hover:to-gold sm:grid"
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
            className="grid h-9 w-9 place-items-center rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.06] text-primary-foreground/85 backdrop-blur transition hover:border-gold/50 hover:bg-primary-foreground/10 hover:text-gold active:scale-[0.98] sm:h-10 sm:w-10"
          >
            {auth.status === "signedIn" ? (
              <User className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
          </Link>
        </div>

        {/* Logo (right side in RTL) */}
        <Link to="/" className="order-1 flex min-w-0 items-center gap-3 group">
          <Logo />
        </Link>

        {compact && title && (
          <h1 className="order-2 ms-1 flex-1 truncate text-base font-bold">{title}</h1>
        )}

        {/* Middle: governorate + language, pushed to the left cluster */}
        <div className="order-2 ms-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={text("تبديل اللغة", "Switch language")}
            title={text("العربية / English", "English / العربية")}
            className="hidden h-9 items-center gap-1.5 rounded-full border border-primary-foreground/15 bg-primary-foreground/[0.06] px-3 text-[11px] font-bold text-primary-foreground/90 backdrop-blur transition hover:border-gold/50 hover:bg-primary-foreground/10 hover:text-gold sm:inline-flex"
          >
            <Languages className="h-4 w-4" />
            <span>{language === "ar" ? "English" : "العربية"}</span>
          </button>
          {!compact && (
            <>
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gold/40 bg-gradient-to-b from-gold/20 to-gold/5 px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-gold/70 hover:from-gold/30 hover:to-gold/10 active:scale-[0.98] sm:text-sm"
              >
                <MapPin className="h-4 w-4 shrink-0 text-gold" />
                <span className="whitespace-nowrap leading-5">
                  {text("اختر المحافظة", "Choose governorate")}
                </span>
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="container-wide pb-3">
          <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-card p-2 text-foreground shadow-premium">
            <button
              type="button"
              onClick={() => goToGovernorate()}
              className="block w-full rounded-lg px-3 py-2 text-start text-sm font-medium hover:bg-muted-surface"
            >
              {text("كل سوريا", "All Syria")}
            </button>
            {governorates.map((governorate) => (
              <button
                key={governorate.id}
                type="button"
                onClick={() => goToGovernorate(governorate.id)}
                className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-muted-surface"
              >
                {governorateName(governorate.id, governorate.nameAr, language)}
              </button>
            ))}
          </div>
        </div>
      )}
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
