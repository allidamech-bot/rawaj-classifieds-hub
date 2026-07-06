import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  ChevronLeft,
  FileText,
  Heart,
  HelpCircle,
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
import type { ComponentType } from "react";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/more")({
  component: MorePage,
});

type AccountRow = {
  titleAr: string;
  titleEn: string;
  hintAr?: string;
  hintEn?: string;
  to?:
    | "/chats"
    | "/favorites"
    | "/notifications"
    | "/privacy"
    | "/profile"
    | "/profile/listings"
    | "/saved-searches"
    | "/safety"
    | "/support"
    | "/terms"
    | "/verification";
  href?: string;
  onClick?: () => void;
  icon: ComponentType<{ className?: string }>;
};

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

  const marketplaceActivity: AccountRow[] = [
    {
      titleAr: "معلومات الحساب",
      titleEn: "Account details",
      hintAr: "بياناتك الأساسية ووسائل التواصل",
      hintEn: "Your basic details and contact methods",
      to: "/profile",
      icon: User,
    },
    {
      titleAr: "إعلاناتي",
      titleEn: "My listings",
      hintAr: "إدارة المسودات، المعتمدة، وقيد المراجعة",
      hintEn: "Manage drafts, approved, and pending listings",
      to: "/profile/listings",
      icon: FileText,
    },
    {
      titleAr: "المفضلة",
      titleEn: "Favorites",
      hintAr: "الإعلانات التي حفظتها",
      hintEn: "Listings you saved",
      to: "/favorites",
      icon: Heart,
    },
    {
      titleAr: "عمليات البحث المحفوظة",
      titleEn: "Saved searches",
      hintAr: "استرجاع نتائج البحث بسرعة",
      hintEn: "Quickly reopen your saved queries",
      to: "/saved-searches",
      icon: Bookmark,
    },
    {
      titleAr: "الرسائل",
      titleEn: "Messages",
      hintAr: "محادثات البيع والشراء",
      hintEn: "Buyer and seller conversations",
      to: "/chats",
      icon: MessageCircle,
    },
    {
      titleAr: "الإشعارات",
      titleEn: "Notifications",
      hintAr: "مركز الإشعارات ومتابعة الأحداث",
      hintEn: "Notification center and follow-ups",
      to: "/notifications",
      icon: Bell,
    },
  ];

  const accountSettings: AccountRow[] = [
    {
      titleAr: "اللغة",
      titleEn: "Language",
      hintAr: "العربية / English",
      hintEn: "Arabic / English",
      icon: Languages,
      onClick: toggleLanguage,
    },
    {
      titleAr: "التوثيق",
      titleEn: "Verification",
      hintAr: "طلبات توثيق تخضع للمراجعة اليدوية",
      hintEn: "Manual-review verification requests",
      to: "/verification",
      icon: BadgeCheck,
    },
  ];

  const helpGroup: AccountRow[] = [
    {
      titleAr: "الدعم والمساعدة",
      titleEn: "Support & help",
      hintAr: "أرسل استفسارك أو طلبك للفريق",
      hintEn: "Send a question or request to the team",
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
    {
      titleAr: "الأسئلة الشائعة",
      titleEn: "FAQ",
      hintAr: "إجابات سريعة عن استخدام رواج",
      hintEn: "Quick answers about using RAWAJ",
      to: "/support",
      icon: HelpCircle,
    },
  ];

  const legalGroup: AccountRow[] = [
    {
      titleAr: "سياسة الخصوصية",
      titleEn: "Privacy policy",
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

  const groups: Array<{
    titleAr: string;
    titleEn: string;
    rows: AccountRow[];
  }> = [
    { titleAr: "نشاطي في السوق", titleEn: "Marketplace activity", rows: marketplaceActivity },
    { titleAr: "إعدادات الحساب", titleEn: "Account & settings", rows: accountSettings },
    { titleAr: "المساعدة", titleEn: "Help", rows: helpGroup },
    { titleAr: "المعلومات القانونية", titleEn: "Legal", rows: legalGroup },
    ...(user
      ? [
          {
            titleAr: "الجلسة",
            titleEn: "Session",
            rows: [
              {
                titleAr: "تسجيل الخروج",
                titleEn: "Log out",
                hintAr: "الخروج من هذا الحساب",
                hintEn: "Sign out of this account",
                icon: LogOut,
                onClick: handleLogout,
              } satisfies AccountRow,
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-dvh bg-background" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader compact title={text("حسابي", "My account")} />

      <main className="mobile-page-bottom mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-border bg-primary text-primary-foreground shadow-premium">
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-bold text-primary-foreground/70">
                {text("حسابي", "My account")}
              </p>
              <h1 className="mt-1 text-xl font-extrabold md:text-2xl">
                {text("مركز إدارة حسابك", "Your account control center")}
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-6 text-primary-foreground/80 sm:text-sm">
                {text(
                  "إعلاناتك، المفضلة، البحث المحفوظ، الرسائل، الإشعارات، والإعدادات في مكان واحد.",
                  "Your listings, favorites, saved searches, messages, notifications, and settings in one place.",
                )}
              </p>
            </div>

            <div className="rounded-xl border border-white/15 bg-white/10 p-3">
              {user ? (
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <User className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{user.email}</p>
                      <p className="text-xs text-primary-foreground/70">
                        {text("حساب مسجّل", "Signed-in account")}
                      </p>
                    </div>
                  </div>
                  <Button
                    asChild
                    className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Link to="/profile">{text("فتح صفحة الحساب", "Open profile")}</Link>
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <LogIn className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">{text("تصفح كزائر", "Browsing as guest")}</p>
                      <p className="text-xs text-primary-foreground/70">
                        {text("سجّل الدخول لإدارة نشاطك", "Sign in to manage your activity")}
                      </p>
                    </div>
                  </div>
                  <Button
                    asChild
                    className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Link to="/login">{text("تسجيل الدخول", "Sign in")}</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
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
          {groups.map((group) => (
            <section key={group.titleEn} className="rounded-2xl border border-border bg-card p-3">
              <h2 className="px-2 pb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                {text(group.titleAr, group.titleEn)}
              </h2>
              <div className="divide-y divide-border/70">
                {group.rows.map((row) => (
                  <AccountItem key={`${group.titleEn}-${row.titleEn}`} row={row} text={text} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function AccountItem({ row, text }: { row: AccountRow; text: (ar: string, en: string) => string }) {
  const Icon = row.icon;
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-foreground">
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

  const rowClass =
    "flex w-full min-h-11 items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-start transition hover:bg-muted/70 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

  if (row.onClick) {
    return (
      <button type="button" onClick={row.onClick} className={rowClass}>
        {content}
      </button>
    );
  }

  if (row.href) {
    return (
      <a href={row.href} className={rowClass}>
        {content}
      </a>
    );
  }

  if (!row.to) {
    return (
      <div
        className="flex min-h-11 items-center justify-between gap-3 px-2 py-2.5 opacity-80"
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }

  return (
    <Link to={row.to} className={rowClass}>
      {content}
    </Link>
  );
}
