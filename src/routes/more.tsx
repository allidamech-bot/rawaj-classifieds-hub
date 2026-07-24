import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Bookmark,
  ChevronLeft,
  Heart,
  Languages,
  LifeBuoy,
  Lock,
  LogOut,
  ScrollText,
  ShieldAlert,
  Store,
  User,
  UserCog,
} from "lucide-react";
import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TrustHubHero, TrustSectionHeader } from "@/features/trust/TrustSupportExperience";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useUnreadActivityCounts } from "@/lib/unread-activity";
import { useAuth } from "@/lib/use-auth";
import { resolveDisplayName } from "@/lib/cloudflare-auth";

export const Route = createFileRoute("/more")({
  component: MorePage,
});

type AccountRoute =
  | "/activity"
  | "/admin"
  | "/chats"
  | "/favorites"
  | "/login"
  | "/notifications"
  | "/privacy"
  | "/profile"
  | "/profile/listings"
  | "/saved-searches"
  | "/safety"
  | "/support"
  | "/terms"
  | "/verification";

type AccountRow = {
  titleAr: string;
  titleEn: string;
  hintAr?: string;
  hintEn?: string;
  to?: AccountRoute;
  onClick?: () => void;
  icon: ComponentType<{ className?: string }>;
  destructive?: boolean;
  disabled?: boolean;
};

const primaryShortcuts: (AccountRow & { world: string })[] = [
  {
    titleAr: "متجري",
    titleEn: "My store",
    hintAr: "إعلاناتك وإدارة واجهتك",
    hintEn: "Listings and storefront",
    to: "/profile/listings",
    icon: Store,
    world: "rawaj-world-orange",
  },
  {
    titleAr: "النشاط",
    titleEn: "Activity",
    hintAr: "رسائلك وما يحتاج انتباهك",
    hintEn: "Messages and what needs attention",
    to: "/activity",
    icon: Activity,
    world: "rawaj-world-indigo",
  },
];

const secondaryShortcuts: (AccountRow & { world: string })[] = [
  {
    titleAr: "المفضلة",
    titleEn: "Favorites",
    to: "/favorites",
    icon: Heart,
    world: "rawaj-world-plum",
  },
  {
    titleAr: "بحث محفوظ",
    titleEn: "Saved searches",
    to: "/saved-searches",
    icon: Bookmark,
    world: "rawaj-world-gold",
  },
  {
    titleAr: "التوثيق",
    titleEn: "Verification",
    to: "/verification",
    icon: BadgeCheck,
    world: "rawaj-world-emerald",
  },
];

function MorePage() {
  const { language, text, toggleLanguage } = useUiPreferences();
  const auth = useAuth();
  const { counts } = useUnreadActivityCounts();
  const unreadTotal = counts.messages + counts.notifications;
  const { user } = auth;
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutInFlightRef = useRef(false);
  const isArabic = language === "ar";
  const profile = auth.profile;
  const displayName = resolveDisplayName(profile, user?.email, text);

  async function handleLogout() {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const result = await auth.signOut();
      if (result.error) setLogoutError(result.error);
    } finally {
      logoutInFlightRef.current = false;
      setLoggingOut(false);
    }
  }

  const settingsRows: AccountRow[] = [
    {
      titleAr: "معلومات الحساب",
      titleEn: "Account information",
      hintAr: "الهوية ووسائل التواصل",
      hintEn: "Identity and contact details",
      to: "/profile",
      icon: User,
    },
    {
      titleAr: "اللغة",
      titleEn: "Language",
      hintAr: "العربية / English",
      hintEn: "Arabic / English",
      icon: Languages,
      onClick: toggleLanguage,
    },
  ];

  if (auth.canAccessOwnerControls) {
    settingsRows.unshift({
      titleAr: "لوحة الإدارة",
      titleEn: "Admin dashboard",
      hintAr: "إدارة رواج والمراجعات",
      hintEn: "Manage RAWAJ and reviews",
      to: "/admin",
      icon: UserCog,
    });
  }

  const helpRows: AccountRow[] = [
    {
      titleAr: "الدعم والمساعدة",
      titleEn: "Support & help",
      hintAr: "تواصل مع فريق رواج",
      hintEn: "Contact the RAWAJ team",
      to: "/support",
      icon: LifeBuoy,
    },
    {
      titleAr: "إرشادات الأمان",
      titleEn: "Safety guidelines",
      hintAr: "بيع وشراء بوعي",
      hintEn: "Buy and sell with care",
      to: "/safety",
      icon: ShieldAlert,
    },
  ];

  const legalRows: AccountRow[] = [
    { titleAr: "الخصوصية", titleEn: "Privacy", to: "/privacy", icon: Lock },
    { titleAr: "الشروط والأحكام", titleEn: "Terms & conditions", to: "/terms", icon: ScrollText },
  ];

  return (
    <div className="rawaj-trust-v2 rawaj-more-v2 min-h-dvh" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader compact title={text("مساحتي", "My space")} />

      <main className="container-wide rawaj-account-command-v3 rawaj-content-stack mobile-page-bottom pb-8 pt-3 sm:pt-5">
        <TrustHubHero
          mode="more"
          displayName={displayName}
          location={profile?.cityArea || profile?.governorate || undefined}
          avatarUrl={profile?.avatarUrl}
          signedIn={Boolean(user)}
          verified={profile?.verificationStatus === "verified"}
          unreadActivity={unreadTotal}
        />

        <section className="rawaj-more-v2__command">
          <TrustSectionHeader
            eyebrow={text("الاختصارات", "Shortcuts")}
            title={text("مركز العمليات", "Command center")}
            description={text(
              "وصول سريع إلى الإعلانات والرسائل والتنبيهات.",
              "Quick access to listings, messages, and notifications.",
            )}
          />
          <div className="rawaj-more-v2__command">
            {primaryShortcuts.map((row) => (
              <PrimaryShortcut
                key={row.titleEn}
                row={row}
                text={text}
                badgeCount={row.to === "/activity" ? counts.messages + counts.notifications : 0}
              />
            ))}
          </div>
        </section>

        <section className="rawaj-more-v2__secondary">
          {secondaryShortcuts.map((row) => (
            <SecondaryShortcut key={row.titleEn} row={row} text={text} />
          ))}
        </section>

        <div className="rawaj-more-v2__sections">
          {logoutError && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive lg:col-span-2"
            >
              {logoutError}
            </p>
          )}

          <AccountSection title={text("الحساب والتفضيلات", "Account & preferences")}>
            {settingsRows.map((row) => (
              <AccountItem key={row.titleEn} row={row} text={text} />
            ))}
          </AccountSection>

          <AccountSection title={text("المساعدة والأمان", "Help & safety")}>
            {helpRows.map((row) => (
              <AccountItem key={row.titleEn} row={row} text={text} />
            ))}
          </AccountSection>

          <AccountSection title={text("القانوني", "Legal")} quiet>
            {legalRows.map((row) => (
              <AccountItem key={row.titleEn} row={row} text={text} quiet />
            ))}
          </AccountSection>

          {user && (
            <AccountSection title={text("الجلسة", "Session")} quiet>
              <AccountItem
                row={{
                  titleAr: loggingOut ? "جارٍ تسجيل الخروج" : "تسجيل الخروج",
                  titleEn: loggingOut ? "Signing out" : "Log out",
                  hintAr: loggingOut ? "يتم إنهاء الجلسة بأمان" : "الخروج من هذا الحساب",
                  hintEn: loggingOut ? "Ending this session safely" : "Sign out of this account",
                  icon: LogOut,
                  onClick: handleLogout,
                  destructive: true,
                  disabled: loggingOut,
                }}
                text={text}
              />
            </AccountSection>
          )}
        </div>
      </main>
    </div>
  );
}

function AccountSection({
  title,
  children,
  quiet = false,
}: {
  title: string;
  children: ReactNode;
  quiet?: boolean;
}) {
  return (
    <section className="rawaj-account-section" data-tone={quiet ? "muted" : "default"}>
      <h2 className="relative px-2 pb-2.5 text-[10px] font-semibold tracking-[0.04em] text-brand-orange">
        {title}
      </h2>
      <div className="relative divide-y divide-border/70">{children}</div>
    </section>
  );
}

function PrimaryShortcut({
  row,
  text,
  badgeCount = 0,
}: {
  row: AccountRow & { world: string };
  text: (ar: string, en: string) => string;
  badgeCount?: number;
}) {
  const Icon = row.icon;
  return (
    <Link
      to={row.to ?? "/more"}
      className={`rawaj-color-card ${row.world} group min-h-36 rounded-[1.35rem] p-4 transition hover:-translate-y-0.5`}
    >
      <span className="relative grid h-11 w-11 place-items-center rounded-[1rem] bg-primary text-primary-foreground shadow-soft">
        <Icon className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -end-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[9px] font-extrabold text-white ring-2 ring-card">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </span>
      <span className="relative mt-5 block text-base font-bold text-primary">
        {text(row.titleAr, row.titleEn)}
      </span>
      <span className="relative mt-1.5 block text-[11px] leading-5 text-muted-foreground">
        {text(row.hintAr ?? row.titleAr, row.hintEn ?? row.titleEn)}
      </span>
      <ChevronLeft className="relative mt-4 h-4 w-4 text-brand-orange rtl:rotate-180" />
    </Link>
  );
}

function SecondaryShortcut({
  row,
  text,
}: {
  row: AccountRow & { world: string };
  text: (ar: string, en: string) => string;
}) {
  const Icon = row.icon;
  return (
    <Link
      to={row.to ?? "/more"}
      className={`rawaj-color-card ${row.world} flex min-h-20 flex-col items-center justify-center gap-2 rounded-[1.15rem] p-2 text-center transition hover:-translate-y-0.5`}
    >
      <Icon className="relative h-4.5 w-4.5 text-primary" />
      <span className="relative text-[10.5px] font-semibold text-foreground">
        {text(row.titleAr, row.titleEn)}
      </span>
    </Link>
  );
}

function AccountItem({
  row,
  text,
  quiet = false,
}: {
  row: AccountRow;
  text: (ar: string, en: string) => string;
  quiet?: boolean;
}) {
  const Icon = row.icon;
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${row.destructive ? "bg-destructive/10 text-destructive" : quiet ? "bg-card-warm text-muted-foreground" : "bg-primary/7 text-primary"}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span
            className={`block truncate text-sm font-semibold ${row.destructive ? "text-destructive" : "text-foreground"}`}
          >
            {text(row.titleAr, row.titleEn)}
          </span>
          {(row.hintAr || row.hintEn) && (
            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
              {text(row.hintAr ?? row.titleAr, row.hintEn ?? row.titleEn)}
            </span>
          )}
        </span>
      </span>
      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
    </>
  );

  const rowClass =
    "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-start transition hover:bg-card/65 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50";

  if (row.to) {
    return (
      <Link to={row.to} className={rowClass}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={row.onClick} disabled={row.disabled} className={rowClass}>
      {content}
    </button>
  );
}
