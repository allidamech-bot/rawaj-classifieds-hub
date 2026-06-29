import { Link } from "@tanstack/react-router";
import { Bell, LogIn, MapPin, ShieldCheck, User, UserCog } from "lucide-react";
import { useState } from "react";
import { governorates } from "@/data/mockData";
import { useAuth } from "@/lib/use-auth";

interface Props {
  /** Compact header (used on inner pages). */
  compact?: boolean;
  title?: string;
}

export function AppHeader({ compact = false, title }: Props) {
  const [gov, setGov] = useState("كل سوريا");
  const [open, setOpen] = useState(false);
  const auth = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-soft">
      <div className="container-wide flex items-center gap-3 py-3">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <Logo />
          {!compact && (
            <span className="hidden text-[11px] font-medium text-primary-foreground/70 sm:inline">
              · سوق سوريا المجاني للإعلانات
            </span>
          )}
        </Link>

        {compact && title && <h1 className="ms-1 flex-1 truncate text-base font-bold">{title}</h1>}

        <div className="ms-auto flex shrink-0 items-center gap-2">
          {!compact && (
            <span className="hidden items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-medium sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> سوريا فقط
            </span>
          )}
          <button
            aria-label="الإشعارات (قريباً)"
            title="الإشعارات — قريباً"
            className="relative grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/10 text-primary-foreground/70 transition hover:bg-primary-foreground/20"
          >
            <Bell className="h-4 w-4" />
          </button>
          {auth.canAccessOwnerControls && (
            <Link
              to="/admin"
              aria-label="لوحة المالك"
              title="لوحة المالك"
              className="grid h-9 w-9 place-items-center rounded-full bg-gold text-gold-foreground transition hover:opacity-90"
            >
              <UserCog className="h-4 w-4" />
            </Link>
          )}
          <Link
            to={auth.status === "signedIn" ? "/profile" : "/login"}
            aria-label={auth.status === "signedIn" ? "حسابي" : "تسجيل الدخول"}
            title={auth.status === "signedIn" ? "حسابي" : "تسجيل الدخول"}
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
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-sm font-medium transition hover:bg-primary-foreground/20"
          >
            <MapPin className="h-4 w-4 text-gold" />
            {gov}
          </button>
          <span className="inline-flex items-center gap-1 text-[11px] text-primary-foreground/60 sm:hidden">
            <ShieldCheck className="h-3 w-3 text-gold" /> سوريا فقط
          </span>
          <span className="hidden text-[11px] text-primary-foreground/60 sm:inline">
            إعلانات محلية حسب المحافظة — بدون تعقيد
          </span>
        </div>
      )}

      {open && (
        <div className="container-wide pb-3">
          <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-card p-2 text-foreground shadow-premium">
            <button
              onClick={() => {
                setGov("كل سوريا");
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-start text-sm font-medium hover:bg-muted-surface"
            >
              كل سوريا
            </button>
            {governorates.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setGov(g.nameAr);
                  setOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-muted-surface"
              >
                {g.nameAr}
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
    <span className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold text-gold-foreground shadow-soft">
        {/* Arabic ر inspired arch mark — atlas dome */}
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
        <span className="text-base font-extrabold tracking-tight">رَوَاج</span>
        <span className="text-[10px] font-semibold tracking-[0.18em] text-gold">RAWAJ · SY</span>
      </span>
    </span>
  );
}
