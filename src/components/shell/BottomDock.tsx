import { Link } from "@tanstack/react-router";
import { Grid3X3, Home, MessageCircle, Plus, User } from "lucide-react";

import {
  resolvePrimaryNavigationSection,
  shouldShowBottomNav,
  type PrimaryNavigationSection,
} from "@/lib/primary-navigation";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useUnreadActivityCounts } from "@/lib/unread-activity";
import { scrollPageToTop } from "@/lib/scroll-utils";
import { useAuth } from "@/lib/use-auth";

interface BottomDockProps {
  pathname: string;
}

type NavItem = {
  to: "/" | "/categories" | "/add-listing" | "/chats" | "/more" | "/login";
  section: Exclude<PrimaryNavigationSection, "offers" | "none">;
  labelAr: string;
  labelEn: string;
  icon: typeof Home;
  primary?: boolean;
};

const coreItems: NavItem[] = [
  { to: "/", section: "home", labelAr: "الرئيسية", labelEn: "Home", icon: Home },
  {
    to: "/categories",
    section: "categories",
    labelAr: "الأقسام",
    labelEn: "Categories",
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
];

export function BottomDock({ pathname }: BottomDockProps) {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const { counts } = useUnreadActivityCounts();
  const activeSection = resolvePrimaryNavigationSection(pathname);
  const signedIn = auth.status === "signedIn";
  const items: NavItem[] = [
    ...coreItems,
    {
      to: signedIn ? "/more" : "/login",
      section: "account",
      labelAr: "حسابي",
      labelEn: "Account",
      icon: User,
    },
  ];

  if (!shouldShowBottomNav(pathname)) return null;

  return (
    <nav
      className="rawaj-mobile-dock pointer-events-none fixed inset-x-0 z-40 lg:hidden"
      data-shell-region="bottom-dock-region"
      aria-label={text("التنقل الرئيسي", "Primary navigation")}
    >
      <div
        className="rawaj-bottom-nav-shell pointer-events-auto mx-auto grid grid-cols-5 items-end"
        role="list"
      >
        {items.map((item) => {
          const active = activeSection === item.section;
          const Icon = item.icon;
          const label = text(item.labelAr, item.labelEn);
          const badgeCount =
            item.section === "chats"
              ? counts.messages
              : item.section === "account" && signedIn
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
              key={item.section}
              to={item.to}
              search={item.to === "/chats" ? {} : undefined}
              preload="intent"
              role="listitem"
              data-section={item.section}
              data-active={active}
              data-primary={item.primary === true}
              data-badge-count={badgeCount > 0 ? badgeCount : undefined}
              className="rawaj-dock-item relative flex min-w-0 flex-col items-center justify-end active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              aria-label={accessibleLabel}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                if (!active || item.primary) return;
                event.preventDefault();
                scrollPageToTop();
              }}
            >
              <span
                data-active={active && !item.primary}
                className={`relative grid place-items-center ${
                  item.primary
                    ? "rawaj-dock-create -mt-3 h-11 w-11 ring-[3px] ring-card"
                    : "rawaj-dock-icon rounded-xl"
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
                className={`rawaj-bottom-dock__label max-w-full truncate ${
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
