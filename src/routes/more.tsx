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
  Rocket,
  ScrollText,
  ShieldAlert,
  User,
} from "lucide-react";
import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ReferralGrowthPanel } from "@/features/growth/ReferralGrowthPanel";
import { AccountRecentlyViewed } from "@/features/retention/AccountRecentlyViewed";
import styles from "@/features/account/account-workspace.module.css";
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
  | "/promotion"
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

const primaryShortcuts: AccountRow[] = [
  {
    titleAr: "النشاط",
    titleEn: "Activity",
    hintAr: "رسائلك وما يحتاج انتباهك",
    hintEn: "Messages and what needs attention",
    to: "/activity",
    icon: Activity,
  },
];

const secondaryShortcuts: AccountRow[] = [
  {
    titleAr: "Boost",
    titleEn: "Boost",
    hintAr: "احصل على عملاء أكثر",
    hintEn: "Get more buyers",
    to: "/promotion",
    icon: Rocket,
  },
  {
    titleAr: "المفضلة",
    titleEn: "Favorites",
    to: "/favorites",
    icon: Heart,
  },
  {
    titleAr: "بحث محفوظ",
    titleEn: "Saved searches",
    to: "/saved-searches",
    icon: Bookmark,
  },
  {
    titleAr: "التوثيق",
    titleEn: "Verification",
    to: "/verification",
    icon: BadgeCheck,
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
    <div className={styles.page} dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader compact />

      <main className={styles.workspace}>
        <header className={styles.identity}>
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" width={56} height={56} decoding="async" />
          ) : (
            <span className={styles.avatar}>
              <User aria-hidden="true" />
            </span>
          )}
          <div>
            <h1 dir="auto">{displayName || text("حسابي", "Account")}</h1>
            {profile?.cityArea || profile?.governorate ? (
              <p dir="auto">{profile.cityArea || profile.governorate}</p>
            ) : null}
            {profile?.verificationStatus === "verified" ? (
              <p className={styles.verified}>
                <BadgeCheck aria-hidden="true" />
                {text("حساب موثّق", "Verified account")}
              </p>
            ) : null}
          </div>
        </header>

        <section aria-labelledby="account-shortcuts">
          <h2 id="account-shortcuts" className={styles.heading}>
            {text("نشاط الحساب", "Account activity")}
          </h2>
          <div className={styles.shortcuts}>
            {primaryShortcuts.map((row) => (
              <PrimaryShortcut
                key={row.titleEn}
                row={row}
                text={text}
                badgeCount={row.to === "/activity" ? unreadTotal : 0}
              />
            ))}
          </div>
        </section>

        <section
          className={styles.shortcuts}
          aria-label={text("اختصارات الحساب", "Account shortcuts")}
        >
          {secondaryShortcuts.map((row) => (
            <SecondaryShortcut key={row.titleEn} row={row} text={text} />
          ))}
        </section>

        {user ? <AccountRecentlyViewed userId={profile?.id ?? user.id} /> : null}
        {user ? <ReferralGrowthPanel /> : null}

        <div className={styles.groups}>
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
    <section className={styles.panel} data-tone={quiet ? "muted" : "default"}>
      <h2 className={styles.heading}>{title}</h2>
      <div className="relative divide-y divide-border/70">{children}</div>
    </section>
  );
}

function PrimaryShortcut({
  row,
  text,
  badgeCount = 0,
}: {
  row: AccountRow;
  text: (ar: string, en: string) => string;
  badgeCount?: number;
}) {
  const Icon = row.icon;
  return (
    <Link to={row.to ?? "/more"} className={styles.shortcut}>
      <span className={styles.icon}>
        <Icon className="h-5 w-5" />
        {badgeCount > 0 && (
          <span className="absolute -end-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[9px] font-extrabold text-white ring-2 ring-card">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </span>
      <span className={styles.shortcutTitle}>{text(row.titleAr, row.titleEn)}</span>
      <span className={styles.hint}>
        {text(row.hintAr ?? row.titleAr, row.hintEn ?? row.titleEn)}
      </span>
    </Link>
  );
}

function SecondaryShortcut({
  row,
  text,
}: {
  row: AccountRow;
  text: (ar: string, en: string) => string;
}) {
  const Icon = row.icon;
  const isBoost = row.to === "/promotion";
  return (
    <Link
      to={row.to ?? "/more"}
      data-boost-shortcut={isBoost ? "true" : undefined}
      aria-label={
        isBoost ? text("Boost — احصل على عملاء أكثر", "Boost — Get more buyers") : undefined
      }
      className={styles.shortcut}
    >
      <span className={styles.icon}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="relative">
        <strong className={styles.shortcutTitle}>{text(row.titleAr, row.titleEn)}</strong>
        {isBoost ? (
          <small className={styles.hint}>{text("احصل على عملاء أكثر", "Get more buyers")}</small>
        ) : null}
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
            className={`block break-words text-sm font-semibold ${row.destructive ? "text-destructive" : "text-foreground"}`}
          >
            {text(row.titleAr, row.titleEn)}
          </span>
          {(row.hintAr || row.hintEn) && (
            <span className="mt-0.5 block break-words text-sm text-muted-foreground">
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
