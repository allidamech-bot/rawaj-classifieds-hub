import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, Plus, MessageCircle, User } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  primary?: boolean;
};

const items: NavItem[] = [
  { to: "/", label: "الرئيسية", icon: Home, exact: true },
  { to: "/categories", label: "الأقسام", icon: LayoutGrid },
  { to: "/add-listing", label: "أضف إعلان", icon: Plus, primary: true },
  { to: "/chats", label: "الرسائل", icon: MessageCircle },
  { to: "/profile", label: "حسابي", icon: User },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="التنقل السفلي"
    >
      <div className="container-wide mx-auto grid grid-cols-5 items-end">
        {items.map((it) => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const Icon = it.icon;
          if (it.primary) {
            return (
              <Link
                key={it.to}
                to={it.to as "/"}
                className="flex flex-col items-center gap-1 pt-1 pb-2"
                aria-label={it.label}
              >
                <span className="grid h-12 w-12 -translate-y-3 place-items-center rounded-full bg-gold text-gold-foreground shadow-premium">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="-mt-1 text-[11px] font-bold text-foreground">{it.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={it.to}
              to={it.to as "/"}
              className={`flex flex-col items-center gap-1 py-2 transition ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.2]" : ""}`} />
              <span className="text-[11px] font-medium">{it.label}</span>
              {active && <span className="h-1 w-1 rounded-full bg-gold" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
