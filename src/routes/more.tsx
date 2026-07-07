import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  ChevronLeft,
  FileText,
  Heart,
  Languages,
  LifeBuoy,
  Lock,
  LogIn,
  LogOut,
  MessageCircle,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Store,
  User,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/more")({
  component: MorePage,
});

type AccountRoute =
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
    titleAr: "الرسائل",
    titleEn: "Messages",
    hintAr: "محادثات البيع والشراء",
    hintEn: "Buyer and seller chats",
    to: "/chats",
    icon: MessageCircle,
    world: "rawaj-world-indigo",
  },
  {
    titleAr: "الإشعارات",
    titleEn: "Notifications",
    hintAr: "آخر ما يحتاج انتباهك",
    hintEn: "What needs your attention",
    to: "/notifications",
    icon: Bell,
    world: "rawaj-world-emerald",
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
  const { user } = auth;
  const [logoutError, setLogoutError] = useState("");
  const isArabic = language === "ar";
  const profile = auth.profile;
  const displayName =
    profile?.businessName ||
    profile?.displayName ||
    user?.email ||
    text("حساب رواج", "RAWAJ account");
  const location = profile?.cityArea || profile?.governorate || text("سوريا", "Syria");

  async function handleLogout() {
    setLogoutError("");
    const result = await auth.signOut();
    if (result.error) setLogoutError(result.error);
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
    <div className="rawaj-pulse-page min-h-dvh" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader compact title={text("مساحتي", "My space")} />

      <main className="mobile-page-bottom mx-auto max-w-6xl px-4 pb-8 pt-3 sm:px-6 sm:pt-5 lg:px-8">
        <section className="rawaj-id-card rounded-[1.7rem] p-5 sm:rounded-[2rem] sm:p-7">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span className="rawaj-id-avatar h-20 w-20 shrink-0 rounded-[1.35rem] text-2xl font-bold sm:h-24 sm:w-24">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : user ? (
                  displayName.slice(0, 1).toUpperCase()
                ) : (
                  <LogIn className="h-7 w-7" />
                )}
              </span>

              <div className="min-w-0">
                <span className="rawaj-signature-kicker text-gold">
                  {user
                    ? text("RAWAJ ID", "RAWAJ ID")
                    : text("مساحتك على رواج", "Your RAWAJ space")}
                </span>
                <h1 className="mt-2 truncate text-xl font-bold text-[#fffaf0] sm:text-2xl">
                  {displayName}
                </h1>
                <p className="mt-1 text-xs text-[#fffaf0]/70">{location}</p>
                <p className="mt-2 max-w-xl text-xs leading-6 text-[#fffaf0]/72">
                  {user
                    ? text(
                        "مساحتك الشخصية لإدارة متجرك ونشاطك ومحادثاتك من مكان واحد.",
                        "Your personal space for managing your store, activity, and conversations.",
                      )
                    : text(
                        "سجل الدخول لتفتح مساحتك الشخصية وتدير إعلاناتك كواجهة متجر.",
                        "Sign in to unlock your personal space and manage listings like a storefront.",
                      )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {user && profile?.id ? (
                <Link
                  to="/seller/$id"
                  params={{ id: profile.id }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[1rem] border border-white/15 bg-white/8 px-4 text-xs font-semibold text-[#fffaf0] backdrop-blur transition hover:bg-white/12"
                >
                  <Sparkles className="h-4 w-4 text-gold" />
                  {text("عرض واجهتي", "View storefront")}
                </Link>
              ) : null}
              <Link
                to={user ? "/profile" : "/login"}
                className="inline-flex min-h-11 items-center justify-center rounded-[1rem] bg-brand-orange px-4 text-xs font-bold text-white shadow-[0_10px_24px_rgba(232,111,50,0.25)] transition hover:-translate-y-0.5"
              >
                {user ? text("تعديل هويتي", "Edit identity") : text("تسجيل الدخول", "Sign in")}
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
            {[
              [text("واجهة", "Storefront"), text("متجر شخصي", "Personal store")],
              [text("نشاط", "Activity"), text("في مكان واحد", "One place")],
              [text("هوية", "Identity"), text("خاصة بك", "Yours")],
            ].map(([label, value]) => (
              <div key={label} className="rawaj-id-stat rounded-[1rem] p-3">
                <span className="block text-[9px] font-semibold text-[#fffaf0]/55 sm:text-[10px]">
                  {label}
                </span>
                <strong className="mt-1 block truncate text-[11px] sm:text-xs">{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3.5 flex items-end justify-between gap-3">
            <div>
              <span className="rawaj-signature-kicker">
                {text("مركز التحكم", "Command center")}
              </span>
              <h2 className="mt-1 text-lg font-bold text-primary">
                {text("أهم ما تحتاجه الآن", "What matters now")}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {primaryShortcuts.map((row) => (
              <PrimaryShortcut key={row.titleEn} row={row} text={text} />
            ))}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
          {secondaryShortcuts.map((row) => (
            <SecondaryShortcut key={row.titleEn} row={row} text={text} />
          ))}
        </section>

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
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
                  titleAr: "تسجيل الخروج",
                  titleEn: "Log out",
                  hintAr: "الخروج من هذا الحساب",
                  hintEn: "Sign out of this account",
                  icon: LogOut,
                  onClick: handleLogout,
                  destructive: true,
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
    <section
      className={`rawaj-color-card rounded-[1.35rem] p-3 ${quiet ? "rawaj-world-gold" : "rawaj-world-indigo"}`}
    >
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
}: {
  row: AccountRow & { world: string };
  text: (ar: string, en: string) => string;
}) {
  const Icon = row.icon;
  return (
    <Link
      to={row.to ?? "/more"}
      className={`rawaj-color-card ${row.world} group min-h-36 rounded-[1.35rem] p-4 transition hover:-translate-y-0.5`}
    >
      <span className="relative grid h-11 w-11 place-items-center rounded-[1rem] bg-primary text-primary-foreground shadow-soft">
        <Icon className="h-5 w-5" />
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
    "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-start transition hover:bg-card/65 active:scale-[0.985]";

  if (row.to) {
    return (
      <Link to={row.to} className={rowClass}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={row.onClick} className={rowClass}>
      {content}
    </button>
  );
}
