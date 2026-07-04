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

  const groups: Array<{
    titleAr: string;
    titleEn: string;
    rows: AccountRow[];
  }> = [
    {
      titleAr: "حسابي",
      titleEn: "My account",
      rows: [
        {
          titleAr: "معلومات الحساب",
          titleEn: "Account details",
          hintAr: "البيانات الأساسية ووسائل التواصل",
          hintEn: "Basic details and contact methods",
          href: "/profile#account-info",
          icon: User,
        },
        {
          titleAr: "إعلاناتي",
          titleEn: "My listings",
          hintAr: "الإعلانات النشطة وقيد المراجعة",
          hintEn: "Active and pending listings",
          to: "/profile/listings",
          icon: FileText,
        },
        {
          titleAr: "التوثيق",
          titleEn: "Verification",
          hintAr: "طلبات توثيق تخضع للمراجعة اليدوية",
          hintEn: "Manual-review verification requests",
          to: "/verification",
          icon: BadgeCheck,
        },
      ],
    },
    {
      titleAr: "نشاطي",
      titleEn: "My activity",
      rows: [
        {
          titleAr: "المفضلة",
          titleEn: "Favorites",
          hintAr: "الإعلانات التي حفظتها",
          hintEn: "Listings you saved",
          to: "/favorites",
          icon: Heart,
        },
        {
          titleAr: "البحث المحفوظ",
          titleEn: "Saved searches",
          hintAr: "متابعة نتائج البحث المهمة",
          hintEn: "Track useful searches",
          to: "/saved-searches",
          icon: Bookmark,
        },
      ],
    },
    {
      titleAr: "التواصل",
      titleEn: "Communication",
      rows: [
        {
          titleAr: "الرسائل",
          titleEn: "Messages",
          hintAr: "محادثات البيع والشراء",
          hintEn: "Buyer and seller conversations",
          to: "/chats",
          icon: MessageCircle,
        },
        {
          titleAr: "التنبيهات",
          titleEn: "Notifications",
          hintAr: "مركز التنبيهات وروابط المتابعة",
          hintEn: "Notification center and follow-up links",
          to: "/notifications",
          icon: Bell,
        },
        {
          titleAr: "الدعم",
          titleEn: "Support",
          hintAr: "مساعدة وأسئلة المنصة",
          hintEn: "Platform help and questions",
          to: "/support",
          icon: LifeBuoy,
        },
      ],
    },
    {
      titleAr: "الإعدادات",
      titleEn: "Settings",
      rows: [
        {
          titleAr: "اللغة",
          titleEn: "Language",
          hintAr: "العربية / English",
          hintEn: "Arabic / English",
          icon: Languages,
          onClick: toggleLanguage,
        },
        {
          titleAr: "الأمان",
          titleEn: "Safety",
          hintAr: "نصائح للبيع والشراء بأمان",
          hintEn: "Tips for safer buying and selling",
          to: "/safety",
          icon: ShieldAlert,
        },
        {
          titleAr: "الخصوصية",
          titleEn: "Privacy",
          hintAr: "حماية البيانات واستخدامها",
          hintEn: "Data protection and usage",
          to: "/privacy",
          icon: Lock,
        },
        {
          titleAr: "الشروط",
          titleEn: "Terms",
          hintAr: "قواعد استخدام RAWAJ",
          hintEn: "RAWAJ usage rules",
          to: "/terms",
          icon: ScrollText,
        },
        ...(user
          ? [
              {
                titleAr: "تسجيل الخروج",
                titleEn: "Log out",
                hintAr: "الخروج من هذا الحساب",
                hintEn: "Sign out of this account",
                icon: LogOut,
                onClick: handleLogout,
              },
            ]
          : []),
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader compact title={text("حسابي", "Account")} />

      <main className="mobile-page-bottom mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
        <section className="border border-border bg-primary text-primary-foreground">
          <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-bold text-primary-foreground/70">
                {text("حسابي", "Account")}
              </p>
              <h1 className="mt-1 text-xl font-extrabold md:text-2xl">
                {text("إدارة حسابك ونشاطك", "Manage your account and activity")}
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-6 text-primary-foreground/78 sm:text-sm">
                {text(
                  "مكان واحد للحساب، الإعلانات، المفضلة، الرسائل، التنبيهات، والإعدادات.",
                  "One place for account details, listings, favorites, messages, notifications, and settings.",
                )}
              </p>
            </div>

            <div className="border border-white/15 bg-white/10 p-3">
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
                    <Link to="/profile">{text("فتح الحساب", "Open profile")}</Link>
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
            <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              {logoutError}
            </p>
          )}
          {groups.map((group) => (
            <section key={group.titleEn} className="border border-border bg-card p-3">
              <h2 className="px-2 pb-2 text-sm font-bold text-foreground">
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

        <section className="mt-6 border border-border bg-card-warm p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {text("تذكير أمان", "Safety reminder")}
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "لا تشارك رمز التحقق، ولا ترسل عربوناً قبل التأكد من الإعلان والبائع.",
                  "Do not share verification codes or send deposits before checking the listing and seller.",
                )}
              </p>
            </div>
          </div>
        </section>
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

  if (row.onClick) {
    return (
      <button
        type="button"
        onClick={row.onClick}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-start transition hover:bg-muted/70 active:scale-[0.98]"
      >
        {content}
      </button>
    );
  }

  if (row.href) {
    return (
      <a
        href={row.href}
        className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition hover:bg-muted/70 active:scale-[0.98]"
      >
        {content}
      </a>
    );
  }

  if (!row.to) {
    return (
      <div
        className="flex items-center justify-between gap-3 px-2 py-2.5 opacity-80"
        aria-disabled="true"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      to={row.to}
      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition hover:bg-muted/70 active:scale-[0.98]"
    >
      {content}
    </Link>
  );
}
