import { Link } from "@tanstack/react-router";
import { Bell, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { governorates } from "@/data/mockData";

interface Props {
  /** Compact header (used on inner pages). */
  compact?: boolean;
  title?: string;
}

export function AppHeader({ compact = false, title }: Props) {
  const [gov, setGov] = useState("كل سوريا");
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-soft">
      <div className="container-wide flex items-center gap-3 py-3">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          {!compact && (
            <div className="leading-tight">
              <div className="text-xs text-primary-foreground/70">السوق القريب بثقة</div>
            </div>
          )}
        </Link>

        {compact && title && (
          <h1 className="ms-1 flex-1 truncate text-base font-bold">{title}</h1>
        )}

        <div className="ms-auto flex items-center gap-2">
          {!compact && (
            <span className="hidden items-center gap-1 rounded-full bg-primary-foreground/10 px-2.5 py-1 text-[11px] font-medium sm:inline-flex">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> سوريا فقط
            </span>
          )}
          <button
            aria-label="الإشعارات"
            className="grid h-9 w-9 place-items-center rounded-full bg-primary-foreground/10 transition hover:bg-primary-foreground/20"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!compact && (
        <div className="container-wide flex items-center justify-between pb-3">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-sm font-medium transition hover:bg-primary-foreground/20"
          >
            <MapPin className="h-4 w-4 text-gold" />
            {gov}
          </button>
          <span className="text-[11px] text-primary-foreground/70">سوق سوري مجاني ومنظّم</span>
        </div>
      )}

      {open && (
        <div className="container-wide pb-3">
          <div className="rounded-xl bg-card p-2 text-foreground shadow-premium">
            <button
              onClick={() => { setGov("كل سوريا"); setOpen(false); }}
              className="block w-full rounded-lg px-3 py-2 text-start text-sm font-medium hover:bg-muted-surface"
            >
              كل سوريا
            </button>
            {governorates.map((g) => (
              <button
                key={g.id}
                onClick={() => { setGov(g.nameAr); setOpen(false); }}
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
        {/* Arabic ر inspired arch mark */}
        <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 22 Q6 10 16 10 Q26 10 26 22" />
          <path d="M10 22 V25" />
          <path d="M22 22 V25" />
          <circle cx="16" cy="6" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-base font-extrabold tracking-tight">رَوَاج</span>
        <span className="text-[10px] font-semibold tracking-widest text-gold">RAWAJ</span>
      </span>
    </span>
  );
}
