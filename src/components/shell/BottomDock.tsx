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
    labelAr: "إعلان",
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
      <div
        className="rawaj-bottom-nav-shell pointer-events-auto mx-auto grid max-w-[30rem] grid-cols-5 items-end px-1.5 pb-1 pt-1.5"
        role="list"
      >
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
          const accessibleLabel =
            badgeCount > 0
              ? text(
                  `${label}، ${badgeCount > 99 ? "أكثر من 99" : badgeCount} غير مقروء`,
                  `${label}, ${badgeCount > 99 ? "more than 99" : badgeCount} unread`,
                )
              : label;

          return (
            <Link
              key={item.to}
              to={item.to}
              search={item.to === "/chats" ? {} : undefined}
              preload="intent"
              role="listitem"
              data-active={active}
              data-primary={item.primary === true}
              data-badge-count={badgeCount > 0 ? badgeCount : undefined}
              className={`rawaj-dock-item relative flex min-h-[3.6rem] min-w-0 flex-col items-center justify-end gap-1 rounded-[0.85rem] px-1 pb-1.5 pt-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                item.primary ? "text-brand-orange" : ""
              }`}
              aria-label={accessibleLabel}
              aria-current={active ? "page" : undefined}
            >
              <span
                data-active={active && !item.primary}
                className={`relative grid place-items-center ${
                  item.primary
                    ? "rawaj-dock-create -mt-3 h-11 w-11 rounded-[1rem] ring-[3px] ring-card"
                    : "rawaj-dock-icon h-8 w-9 rounded-xl"
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={item.primary ? "h-6 w-6" : "h-5 w-5"}
                  strokeWidth={active || item.primary ? 2.2 : 1.8}
                />
                {badgeCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="rawaj-bottom-dock__badge rawaj-notification-badge absolute -end-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold leading-none ring-2 ring-card"
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                ) : null}
              </span>
              <span
                className={`rawaj-bottom-dock__label max-w-full truncate text-xs leading-tight ${
                  active || item.primary ? "font-bold" : "font-medium"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
