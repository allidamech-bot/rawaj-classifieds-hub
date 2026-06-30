import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Languages,
  LogIn,
  MapPin,
  Moon,
  ShieldCheck,
  Sun,
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, text, theme, toggleLanguage, toggleTheme } = useUiPreferences();

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
    <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-soft">
      <div className="container-wide flex items-center gap-3 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <Logo />
          {!compact && (
            <span className="hidden text-[11px] font-medium text-primary-foreground/70 sm:inline">
              {text("· سوق سوريا المجاني للإعلانات", "· Syria classifieds marketplace")}
            </span>
          )}
        </Link>

        {compact && title && <h1 className="ms-1 flex-1 truncate text-base font-bold">{title}</h1>}

        <div className="ms-auto flex shrink-0 items-center gap-2">
          {!compact && (
            <span className="hidden items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-medium sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> {text("سوريا فقط", "Syria only")}
            </span>
          )}
          <button
            type="button"
            onClick={toggleLanguage}
            aria-label={text("تبديل اللغة", "Switch language")}
            title={text("العربية / English", "English / العربية")}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 text-[11px] font-bold text-primary-foreground/85 transition hover:bg-primary-foreground/20"
          >
            <Languages className="h-4 w-4" />
            <span>{language === "ar" ? "English" : "العربية"}</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={text("تبديل النمط", "Switch theme")}
            title={theme === "light" ? text("داكن", "Dark") : text("فاتح", "Light")}
            className="grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/10 text-primary-foreground/85 transition hover:bg-primary-foreground/20"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setNotificationsOpen((value) => !value)}
            aria-label={text("التنبيهات", "Notifications")}
            title={text("التنبيهات", "Notifications")}
            className="relative grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/10 text-primary-foreground/70 transition hover:bg-primary-foreground/20"
          >
            <Bell className="h-4 w-4" />
          </button>
          {auth.canAccessOwnerControls && (
            <Link
              to="/admin"
              aria-label={text("لوحة المالك", "Owner dashboard")}
              title={text("لوحة المالك", "Owner dashboard")}
              className="grid h-9 w-9 place-items-center rounded-full bg-gold text-gold-foreground transition hover:opacity-90"
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
            className="grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/10 text-primary-foreground/80 transition hover:bg-primary-foreground/20"
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
        <div className="container-wide flex flex-wrap items-center justify-between gap-2 pb-3">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-sm font-medium transition hover:bg-primary-foreground/20"
          >
            <MapPin className="h-4 w-4 text-gold" />
            {text("اختر المحافظة", "Choose governorate")}
          </button>
          <span className="inline-flex items-center gap-1 text-[11px] text-primary-foreground/60 sm:hidden">
            <ShieldCheck className="h-3 w-3 text-gold" /> {text("سوريا فقط", "Syria only")}
          </span>
          <span className="hidden text-[11px] text-primary-foreground/60 sm:inline">
            {text(
              "إعلانات محلية حسب المحافظة - بسيطة وواضحة",
              "Local listings by governorate - simple and clear",
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

      {notificationsOpen && (
        <div className="container-wide pb-3">
          <div className="ms-auto max-w-sm rounded-xl bg-card p-3 text-foreground shadow-premium hairline">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-extrabold">{text("التنبيهات", "Notifications")}</p>
              <button
                type="button"
                onClick={() => setNotificationsOpen(false)}
                className="rounded-full bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground"
              >
                {text("إغلاق", "Close")}
              </button>
            </div>
            <div className="mt-3 rounded-lg bg-muted-surface p-3">
              <p className="text-xs font-bold">
                {text("لا توجد تنبيهات جديدة", "No new notifications")}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                {text(
                  "تظهر هنا تحديثات الإعلانات والمفضلة والحساب عند توفرها.",
                  "Listing, favorite, and account updates appear here when available.",
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-gold-foreground shadow-soft">
        <svg
          viewBox="0 0 32 32"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 23 Q5 9 16 9 Q27 9 27 23" />
          <path d="M9 23 V26" />
          <path d="M23 23 V26" />
          <path d="M5 26 H27" strokeWidth="1.6" opacity="0.7" />
          <circle cx="16" cy="5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-base font-extrabold tracking-tight">رواج</span>
        <span className="text-[10px] font-semibold tracking-[0.18em] text-gold">RAWAJ · SY</span>
      </span>
    </span>
  );
}
