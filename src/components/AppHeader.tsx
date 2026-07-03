import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Languages,
  LogIn,
  MapPin,
  ShieldCheck,
  User,
  UserCog,
} from "lucide-react";
import { useEffect, useState } from "react";
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
    <header className="sticky top-0 z-30 border-b border-primary-foreground/10 bg-gradient-to-b from-primary via-primary to-primary/95 text-primary-foreground shadow-premium backdrop-blur">
      <div className="container-wide flex items-center gap-3 py-3 sm:gap-4 sm:py-4">
        <Link to="/" className="flex min-w-0 items-center gap-3 group">
          <Logo />
        </Link>

        {compact && title && <h1 className="ms-1 flex-1 truncate text-base font-bold">{title}</h1>}

        <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!compact && (
            <span className="hidden items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-semibold text-gold sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5" /> {text("سوريا فقط", "Syria only")}
            </span>
          )}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={text("تبديل اللغة", "Switch language")}
            title={text("العربية / English", "English / العربية")}
            className="hidden h-9 items-center gap-1.5 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 px-3 text-[11px] font-bold text-primary-foreground/90 transition hover:border-gold/40 hover:bg-primary-foreground/10 hover:text-gold sm:inline-flex"
          >
            <Languages className="h-4 w-4" />
            <span>{language === "ar" ? "English" : "العربية"}</span>
          </button>
          <Link
            to="/notifications"
            aria-label={text("التنبيهات", "Notifications")}
            title={text("التنبيهات", "Notifications")}
            className="relative grid h-9 w-9 place-items-center rounded-full border border-primary-foreground/15 bg-primary-foreground/5 text-primary-foreground/80 transition hover:border-gold/40 hover:bg-primary-foreground/10 hover:text-gold active:scale-[0.98] sm:h-10 sm:w-10"
          >
            <Bell className="h-4 w-4" />
          </Link>
          {auth.canAccessOwnerControls && (
            <Link
              to="/admin"
              aria-label={text("لوحة المالك", "Owner dashboard")}
              title={text("لوحة المالك", "Owner dashboard")}
              className="hidden h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold to-gold/70 text-gold-foreground shadow-soft transition hover:from-gold hover:to-gold sm:grid"
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
            className="grid h-9 w-9 place-items-center rounded-full border border-primary-foreground/15 bg-primary-foreground/5 text-primary-foreground/85 transition hover:border-gold/40 hover:bg-primary-foreground/10 hover:text-gold active:scale-[0.98] sm:h-10 sm:w-10"
          >
            {auth.status === "signedIn" ? (
              <User className="h-4 w-4" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
          </Link>
        </div>
      </div>

      {!compact && (
        <div className="container-wide flex items-center justify-between gap-2 pb-3 sm:pb-4">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="order-3 ms-auto inline-flex min-w-0 items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:border-gold/60 hover:bg-gold/20 active:scale-[0.98] sm:text-sm"
          >
            <MapPin className="h-4 w-4 text-gold" />
            {text("اختر المحافظة", "Choose governorate")}
          </button>
          <span className="hidden text-[11px] text-primary-foreground/60 sm:inline">
            {text(
              "إعلانات محلية حسب المحافظة — بسيطة وواضحة",
              "Local listings by governorate — simple and clear",
            )}
          </span>
        </div>
      )}

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

        <span
          className="h-6 w-px bg-gold/80 sm:h-8"
          aria-hidden="true"
        />

        <span className="text-xs font-semibold tracking-[0.22em] text-gold sm:text-base">
          RAWAJ
        </span>
      </span>
    </span>
  );
}

