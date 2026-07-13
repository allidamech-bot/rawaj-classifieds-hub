import { Link } from "@tanstack/react-router";
import { Grid3X3, Home, MessageCircle, Plus, User } from "lucide-react";

import {
  resolvePrimaryNavigationSection,
  shouldShowBottomNav,
  type PrimaryNavigationSection,
} from "@/lib/primary-navigation";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useUnreadActivityCounts } from "@/lib/unread-activity";

interface BottomDockProps {
  pathname: string;
}

type NavItem = {
  to: "/" | "/categories" | "/add-listing" | "/chats" | "/more";
  section: Exclude<PrimaryNavigationSection, "offers" | "none">;
  labelAr: string;
  labelEn: string;
  icon: typeof Home;
  primary?: boolean;
};

const items: NavItem[] = [
  { to: "/", section: "home", labelAr: "الرئيسية", labelEn: "Home", icon: Home },
  {
    to: "/categories",
    section: "categories",
    labelAr: "اكتشف",
    labelEn: "Discover",
    icon: Grid3X3,
  },
  {
    to: "/add-listing",
    section: "addListing",
    labelAr: "أضف إعلان",
    labelEn: "Post",
    icon: Plus,
    primary: true,
  },
  {
    to: "/chats",
    section: "chats",
    labelAr: "المحادثات",
    labelEn: "Chats",
    icon: MessageCircle,
  },
  { to: "/more", section: "account", labelAr: "حسابي", labelEn: "Account", icon: User },
];

export function BottomDock({ pathname }: BottomDockProps) {
  const { text } = useUiPreferences();
  const { counts } = useUnreadActivityCounts();
  const activeSection = resolvePrimaryNavigationSection(pathname);

  if (!shouldShowBottomNav(pathname)) return null;

  return (
    <nav
      className="rawaj-mobile-dock pointer-events-none fixed inset-x-0 z-40 lg:hidden"
      data-shell-region="bottom-dock-region"
      aria-label={text("التنقل الرئيسي", "Primary navigation")}
    >
      <div className="rawaj-bottom-nav-shell pointer-events-auto mx-auto grid max-w-[31rem] grid-cols-5 items-end px-1.5 pb-1 pt-1.5">
        {items.map((item) => {
          const active = activeSection === item.section;
          const Icon = item.icon;
          const label = text(item.labelAr, item.labelEn);
          const badgeCount =
            item.section === "chats"
              ? counts.messages
              : item.section === "account"
                ? counts.notifications
                : 0;

          return (
            <Link
              key={item.to}
              to={item.to}
              data-active={active}
              data-primary={item.primary === true}
              className={`rawaj-dock-item relative flex min-h-[3.7rem] min-w-0 flex-col items-center justify-end gap-1 rounded-[0.95rem] px-1 pb-1.5 pt-1 active:scale-[0.98] ${
                item.primary ? "text-brand-orange" : ""
              }`}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <span
                data-active={active && !item.primary}
                className={`relative grid place-items-center ${
                  item.primary
                    ? "rawaj-dock-create -mt-5 h-12 w-12 rounded-[1.15rem] ring-4 ring-card"
                    : "rawaj-dock-icon h-8 w-9 rounded-xl"
                }`}
              >
                <Icon
                  className={item.primary ? "h-6 w-6" : "h-5 w-5"}
                  strokeWidth={active || item.primary ? 2.2 : 1.8}
                />
                {badgeCount > 0 ? (
                  <span className="rawaj-bottom-dock__badge rawaj-notification-badge absolute -end-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-none ring-2 ring-card">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                ) : null}
              </span>
              <span
                className={`rawaj-bottom-dock__label max-w-full truncate text-[11px] leading-tight ${
                  active || item.primary ? "font-bold" : "font-medium"
                }`}
              >
                {label}
              </span>
              {active && !item.primary ? (
                <span className="rawaj-dock-active-indicator absolute inset-x-4 bottom-0 h-0.5 rounded-full" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
