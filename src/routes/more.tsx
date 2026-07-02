import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Ban,
  Bell,
  Bookmark,
  Building2,
  ChevronLeft,
  FileText,
  Heart,
  Languages,
  LifeBuoy,
  Lock,
  LogIn,
  MessageCircle,
  Plus,
  ScrollText,
  ShieldAlert,
  Sparkles,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/use-auth";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/more")({
  component: MorePage,
});

type MoreRow = {
  titleAr: string;
  titleEn: string;
  hintAr?: string;
  hintEn?: string;
  to?: "/" | "/add-listing" | "/admin" | "/chats" | "/favorites" | "/login" | "/notifications" | "/profile" | "/profile/listings" | "/prohibited" | "/promotion" | "/saved-searches" | "/safety" | "/support" | "/terms" | "/verification";
  onClick?: () => void;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
};

function MorePage() {
  const { language, toggleLanguage } = useUiPreferences();
  const { user } = useAuth();
  const isArabic = language === "ar";
  const text = (ar: string, en: string) => (isArabic ? ar : en);

  const groups: Array<{
    titleAr: string;
    titleEn: string;
    rows: MoreRow[];
  }> = [
    {
      titleAr: "الحساب",
      titleEn: "Account",
      rows: [
        {
          titleAr: "معلومات الحساب",
          titleEn: "Account details",
          hintAr: "إدارة بياناتك العامة",
          hintEn: "Manage your public details",
          to: "/profile",
          icon: User,
        },
        {
          titleAr: "تعديل الملف الشخصي",
          titleEn: "Edit profile",
          hintAr: "الاسم ووسائل التواصل الظاهرة",
          hintEn: "Name and visible contact details",
          to: "/profile",
          icon: FileText,
        },
        {
          titleAr: "اللغة",
          titleEn: "Language",
          hintAr: "العربية / English",
          hintEn: "Arabic / English",
          icon: Languages,
          onClick: toggleLanguage,
        },
      ],
    },
    {
      titleAr: "نشاطي",
      titleEn: "My activity",
      rows: [
        {
          titleAr: "إعلاناتي",
          titleEn: "My listings",
          hintAr: "الإعلانات النشطة وقيد المراجعة",
          hintEn: "Active and pending listings",
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
          titleAr: "الرسائل والمحادثات",
          titleEn: "Messages",
          hintAr: "تواصل مع البائعين والمشترين",
          hintEn: "Contact sellers and buyers",
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
          titleAr: "الدعم والمساعدة",
          titleEn: "Help and support",
          hintAr: "أسئلة ومساعدة المنصة",
          hintEn: "Platform help and questions",
          to: "/support",
          icon: LifeBuoy,
        },
      ],
    },
    {
      titleAr: "الأمان والقوانين",
      titleEn: "Safety and rules",
      rows: [
        {
          titleAr: "مركز الأمان",
          titleEn: "Safety center",
          hintAr: "نصائح للبيع والشراء بأمان",
          hintEn: "Tips for safer buying and selling",
          to: "/safety",
          icon: ShieldAlert,
        },
        {
          titleAr: "الإعلانات المحظورة",
          titleEn: "Prohibited listings",
          hintAr: "ما لا يمكن نشره على RAWAJ",
          hintEn: "What cannot be posted on RAWAJ",
          to: "/prohibited",
          icon: Ban,
        },
        {
          titleAr: "الشروط والخصوصية",
          titleEn: "Terms and privacy",
          hintAr: "قواعد الاستخدام وحماية البيانات",
          hintEn: "Usage rules and data privacy",
          to: "/terms",
          icon: ScrollText,
        },
      ],
    },
    {
      titleAr: "للشركات والمعلنين",
      titleEn: "For businesses",
      rows: [
        {
          titleAr: "باقات الترويج",
          titleEn: "Promotion packages",
          hintAr: "طلبات ترويج يراجعها فريق الإدارة",
          hintEn: "Admin-reviewed promotion requests",
          to: "/promotion",
          icon: Sparkles,
        },
        {
          titleAr: "حساب منشأة",
          titleEn: "Business account",
          hintAr: "حدّث اسم المنشأة ووسائل التواصل",
          hintEn: "Update business name and contact details",
          to: "/profile",
          icon: Building2,
        },
        {
          titleAr: "طلب توثيق",
          titleEn: "Verification request",
          hintAr: "إرسال طلب توثيق للمراجعة اليدوية",
          hintEn: "Submit a verification request for manual review",
          to: "/verification",
          icon: BadgeCheck,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24" dir={isArabic ? "rtl" : "ltr"}>
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[28px] border border-border bg-primary text-primary-foreground shadow-sm">
          <div className="grid gap-5 p-5 sm:p-7 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/70">
                {text("المزيد", "More")}
              </p>
              <h1 className="mt-2 text-2xl font-black md:text-3xl">
                {text("حسابك وخدمات RAWAJ في مكان واحد", "Your RAWAJ account and services in one place")}
              </h1>
<p className="mt-2 max-w-2xl text-sm leading-7 text-primary-foreground/78">
                 {text(
                   "إدارة الإعلانات، الرسائل، الأمان، وخدمات المعلنين من مكان واحد.",
                   "Manage listings, messages, safety, and advertiser services in one place.",
                 )}
               </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
              {user ? (
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <User className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{user.email}</p>
                      <p className="text-xs text-primary-foreground/70">{text("حساب مسجّل", "Signed-in account")}</p>
                    </div>
                  </div>
                  <Button asChild className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/90">
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
                      <p className="text-sm font-black">{text("تصفح كزائر", "Browsing as guest")}</p>
                      <p className="text-xs text-primary-foreground/70">{text("سجّل الدخول لإدارة نشاطك", "Sign in to manage your activity")}</p>
                    </div>
                  </div>
                  <Button asChild className="mt-4 w-full bg-accent text-accent-foreground hover:bg-accent/90">
                    <Link to="/login">{text("تسجيل الدخول", "Sign in")}</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Link
            to="/add-listing"
            className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:border-accent/60 hover:shadow-md"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Plus className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-black text-foreground">{text("أضف إعلاناً جديداً", "Post a new listing")}</span>
                <span className="block text-xs text-muted-foreground">{text("ابدأ إعلانك بخطوات بسيطة", "Start with a simple listing flow")}</span>
              </span>
            </span>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </Link>

          <Link
            to="/promotion"
            className="flex items-center justify-between rounded-2xl border border-border bg-white p-4 shadow-sm transition hover:border-accent/60 hover:shadow-md"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-black text-foreground">{text("ترويج الإعلانات", "Promote listings")}</span>
                <span className="block text-xs text-muted-foreground">{text("طلبات يراجعها فريق الإدارة", "Requests reviewed by admins")}</span>
              </span>
            </span>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>

        <div className="mt-6 space-y-4">
          {groups.map((group) => (
            <section key={group.titleEn} className="rounded-2xl border border-border bg-white p-3 shadow-sm">
              <h2 className="px-2 pb-2 text-sm font-black text-foreground">
                {text(group.titleAr, group.titleEn)}
              </h2>
              <div className="divide-y divide-border/70">
                {group.rows.map((row) => (
                  <MoreItem key={`${group.titleEn}-${row.titleEn}`} row={row} text={text} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card-warm p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-black text-foreground">{text("تذكير أمان", "Safety reminder")}</h2>
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

      <BottomNav />
    </div>
  );
}

function MoreItem({ row, text }: { row: MoreRow; text: (ar: string, en: string) => string }) {
  const Icon = row.icon;
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-foreground">{text(row.titleAr, row.titleEn)}</span>
          {(row.hintAr || row.hintEn) && (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {text(row.hintAr ?? row.titleAr, row.hintEn ?? row.titleEn)}
            </span>
          )}
        </span>
      </span>
      <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );

  if (row.onClick && !row.disabled) {
    return (
      <button
        type="button"
        onClick={row.onClick}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-start transition hover:bg-muted/70"
      >
        {content}
      </button>
    );
  }

  if (!row.to || row.disabled) {
    return (
      <div className="flex items-center justify-between gap-3 px-2 py-3 opacity-80" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link
      to={row.to}
      className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-muted/70"
    >
      {content}
    </Link>
  );
}
