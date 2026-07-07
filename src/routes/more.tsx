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
  User,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
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

const primaryShortcuts: AccountRow[] = [
  {
    titleAr: "إعلاناتي",
    titleEn: "My listings",
    hintAr: "إدارة إعلاناتك",
    hintEn: "Manage your listings",
    to: "/profile/listings",
    icon: FileText,
  },
  {
    titleAr: "الرسائل",
    titleEn: "Messages",
    hintAr: "محادثات البيع والشراء",
    hintEn: "Buyer & seller chats",
    to: "/chats",
    icon: MessageCircle,
  },
  {
    titleAr: "الإشعارات",
    titleEn: "Notifications",
    hintAr: "آخر التنبيهات",
    hintEn: "Recent alerts",
    to: "/notifications",
    icon: Bell,
  },
];

const secondaryShortcuts: AccountRow[] = [
  {
    titleAr: "المفضلة",
    titleEn: "Favorites",
    to: "/favorites",
    icon: Heart,
  },
  {
    titleAr: "البحث المحفوظ",
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
  const { user } = auth;
  const [logoutError, setLogoutError] = useState("");
  const isArabic = language === "ar";

  async function handleLogout() {
    setLogoutError("");
    const result = await auth.signOut();
    if (result.error) setLogoutError(result.error);
  }

  // Messages/Notifications are now elevated into primaryShortcuts, so activityRows is retired.

  const settingsRows: AccountRow[] = [
    {
      titleAr: "معلومات الحساب",
      titleEn: "Account information",
      hintAr: "البيانات الأساسية ووسائل التواصل",
      hintEn: "Basic details and contact methods",
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
      hintAr: "نصائح للبيع والشراء بأمان",
      hintEn: "Tips for safer buying and selling",
      to: "/safety",
      icon: ShieldAlert,
    },
  ];

  const legalRows: AccountRow[] = [
    {
      titleAr: "الخصوصية",
      titleEn: "Privacy",
      to: "/privacy",
      icon: Lock,
    },
    {
      titleAr: "الشروط والأحكام",
      titleEn: "Terms & conditions",
      to: "/terms",
      icon: ScrollText,
    },
  ];

  return (
    <div className="min-h-dvh bg-background" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader compact title={text("حسابي", "My account")} />

      <main className="mobile-page-bottom mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {user ? <User className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-foreground">
                  {user
                    ? (user.email ?? text("حساب مسجل", "Signed-in account"))
                    : text("تتصفح كزائر", "Browsing as guest")}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                  {user
                    ? text(
                        "إدارة الحساب والنشاط من مكان واحد",
                        "Manage account and activity in one place",
                      )
                    : text(
                        "سجل الدخول لإدارة إعلاناتك ونشاطك",
                        "Sign in to manage listings and activity",
                      )}
                </p>
              </div>
            </div>

            <Button
              asChild
              className="w-full bg-gold text-gold-foreground hover:bg-gold/90 sm:w-auto"
            >
              <Link to={user ? "/profile" : "/login"}>
                {user ? text("تعديل الحساب", "Edit account") : text("تسجيل الدخول", "Sign in")}
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
          {primaryShortcuts.map((row) => (
            <PrimaryShortcut key={row.titleEn} row={row} text={text} />
          ))}
        </section>

        <section className="mt-3 grid grid-cols-3 gap-2.5 sm:gap-3">
          {secondaryShortcuts.map((row) => (
            <SecondaryShortcut key={row.titleEn} row={row} text={text} />
          ))}
        </section>

        <div className="mt-5 space-y-3">
          {logoutError && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive"
            >
              {logoutError}
            </p>
          )}


          <AccountSection title={text("الإعدادات", "Settings")}>
            {settingsRows.map((row) => (
              <AccountItem key={row.titleEn} row={row} text={text} />
            ))}
          </AccountSection>

          <AccountSection title={text("المساعدة", "Help")}>
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
    <section className={`rounded-xl border border-border bg-card p-3 ${quiet ? "bg-card/80" : ""}`}>
      <h2 className="px-2 pb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border/70">{children}</div>
    </section>
  );
}

function PrimaryShortcut({
  row,
  text,
}: {
  row: AccountRow;
  text: (ar: string, en: string) => string;
}) {
  const Icon = row.icon;

  return (
    <Link
      to={row.to ?? "/more"}
      className="min-h-28 rounded-xl border border-gold/25 bg-primary p-3 text-primary-foreground shadow-soft transition hover:border-gold/60 hover:bg-primary/95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold text-gold-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <span className="mt-3 block text-sm font-extrabold">{text(row.titleAr, row.titleEn)}</span>
      {(row.hintAr || row.hintEn) && (
        <span className="mt-1 block text-xs font-semibold text-primary-foreground/75">
          {text(row.hintAr ?? row.titleAr, row.hintEn ?? row.titleEn)}
        </span>
      )}
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
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            row.destructive
              ? "bg-destructive/10 text-destructive"
              : quiet
                ? "bg-muted-surface text-muted-foreground"
                : "bg-muted text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span
            className={`block truncate text-sm font-bold ${
              row.destructive ? "text-destructive" : "text-foreground"
            }`}
          >
            {text(row.titleAr, row.titleEn)}
          </span>
          {(row.hintAr || row.hintEn) && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {text(row.hintAr ?? row.titleAr, row.hintEn ?? row.titleEn)}
            </span>
          )}
        </span>
      </span>
      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
    </>
  );

  const rowClass = `flex w-full min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-start transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
    row.destructive ? "hover:bg-destructive/10" : "hover:bg-muted/70"
  }`;

  if (row.onClick) {
    return (
      <button type="button" onClick={row.onClick} className={rowClass}>
        {content}
      </button>
    );
  }

  return (
    <Link to={row.to ?? "/more"} className={rowClass}>
      {content}
    </Link>
  );
}
