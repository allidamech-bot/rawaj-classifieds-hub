import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  ChevronLeft,
  FileSpreadsheet,
  FileText,
  Heart,
  LifeBuoy,
  Lock,
  LogIn,
  MessageCircle,
  Plus,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  User,
  UserCog,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { demoNotice } from "@/data/adminMockData";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "حسابي | رَوَاج" }] }),
  component: ProfilePage,
});

const accountMenu = [
  { to: "/listings", label: "إعلاناتي", icon: FileSpreadsheet, badge: "تجريبي" },
  { to: "/add-listing", label: "إضافة إعلان", icon: Plus },
  { to: "/favorites", label: "المفضلة", icon: Heart },
  { to: "/saved-searches", label: "عمليات البحث المحفوظة", icon: Bookmark },
  { to: "/chats", label: "الرسائل", icon: MessageCircle, badge: "قريباً" },
  { to: "/promotion", label: "الترويج والتمييز", icon: Sparkles, badge: "قريباً" },
  {
    to: "/admin",
    label: "لوحة الإدارة — تظهر فقط للحسابات المخوّلة لاحقاً",
    icon: UserCog,
    badge: "نموذج تجريبي",
  },
  { to: "/support", label: "الدعم والمساعدة", icon: LifeBuoy },
  { to: "/safety", label: "نصائح الأمان", icon: ShieldAlert },
  { to: "/terms", label: "شروط الاستخدام", icon: FileText },
  { to: "/privacy", label: "سياسة الخصوصية", icon: ShieldCheck },
];

const accountLevels = [
  ["مستخدم عادي", "تصفح وحفظ وإضافة إعلانات لاحقاً"],
  ["بائع", "حساب يملك إعلانات منشورة"],
  ["بائع موثّق", "توثيق تجريبي يحتاج Backend لاحقاً"],
  ["متجر", "واجهة بائع تجارية ضمن سوريا"],
  ["نشاط تجاري", "حساب أعمال placeholder"],
  ["مشرف", "صلاحيات إدارية يحددها المالك لاحقاً"],
  ["مالك المنصة", "أعلى مستوى صلاحيات في RAWAJ"],
];

const settings = [
  ["المعلومات الشخصية", User],
  ["بيانات التواصل", MessageCircle],
  ["الخصوصية", Lock],
  ["الإشعارات", Bell],
  ["إعدادات البائع/المتجر", Store],
  ["توثيق الحساب", BadgeCheck],
  ["إعدادات الحساب", Settings],
];

function ProfilePage() {
  return (
    <>
      <PageHeader title="حسابي" back={false} />
      <main className="container-wide pt-4 pb-10 space-y-5">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-foreground/10">
              <User className="h-6 w-6 text-gold" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold">زائر</h2>
              <p className="text-xs text-primary-foreground/80">
                تسجيل الدخول غير مفعّل حالياً — صلاحيات الإدارة ستُربط بالحسابات عند تفعيل تسجيل
                الدخول.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              disabled
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold px-3 py-2 text-xs font-bold text-gold-foreground opacity-90 cursor-not-allowed"
            >
              <LogIn className="h-4 w-4" /> تسجيل الدخول · قريباً
            </button>
            <button
              disabled
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-foreground/10 px-3 py-2 text-xs font-bold opacity-90 cursor-not-allowed"
            >
              <UserPlus className="h-4 w-4" /> إنشاء حساب · قريباً
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-card p-4 hairline">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold">مستويات الحساب في RAWAJ</h3>
            <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
              {demoNotice}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {accountLevels.map(([level, note]) => (
              <div key={level} className="rounded-xl bg-muted-surface p-3">
                <div className="text-sm font-extrabold">{level}</div>
                <p className="mt-1 text-xs text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-warning/10 p-4 hairline">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
            <UserCog className="h-4 w-4 text-warning" />
            لوحة الإدارة
          </h3>
          <p className="text-xs text-foreground/90">
            لوحة الإدارة — تظهر فقط للحسابات المخوّلة لاحقاً. لا يوجد Auth حقيقي الآن، ولا يتم منح
            أي مستخدم صلاحيات فعلية من الملف الشخصي.
          </p>
          <Link
            to="/admin"
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs font-bold hairline"
          >
            عرض نموذج لوحة الإدارة
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-extrabold">قائمة الحساب</h3>
          <nav className="overflow-hidden rounded-2xl bg-card hairline">
            {accountMenu.map((it, i) => (
              <Link
                key={it.to}
                to={it.to as "/"}
                className={`flex items-center gap-3 p-4 transition hover:bg-muted-surface ${i !== 0 ? "border-t border-border" : ""}`}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted-surface text-primary">
                  <it.icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-semibold">{it.label}</span>
                {it.badge && (
                  <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {it.badge}
                  </span>
                )}
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </nav>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-extrabold">إعدادات الحساب</h3>
            <span className="text-[10px] text-muted-foreground">جميع الخيارات قريباً</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {settings.map(([label, Icon]) => (
              <button
                key={label as string}
                disabled
                className="flex items-center justify-between rounded-2xl bg-card p-4 hairline opacity-80 cursor-not-allowed"
              >
                <span className="inline-flex items-center gap-2 text-sm font-bold">
                  <Icon className="h-4 w-4 text-primary" />
                  {label as string}
                </span>
                <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  قريباً
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-card-warm p-4 hairline">
          <h3 className="mb-2 inline-flex items-center gap-2 text-sm font-extrabold">
            <BadgeCheck className="h-4 w-4 text-emerald-trust" />
            توثيق الحساب
          </h3>
          <p className="text-xs text-muted-foreground">
            التوثيق وميزات المتاجر وإدارة المشرفين غير مفعّلة حالياً. سيتم ربطها لاحقاً بالحسابات،
            Backend، صلاحيات حقيقية، وقيود أمان.
          </p>
          <button
            disabled
            className="mt-3 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold text-muted-foreground cursor-not-allowed"
          >
            طلب التوثيق · قريباً
          </button>
        </section>
      </main>
    </>
  );
}
