import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User, Heart, Bookmark, BadgeCheck, LifeBuoy, FileText, ShieldCheck,
  Trash2, ChevronLeft, FileSpreadsheet, MessageCircle, Plus, Settings,
  Bell, Globe, MapPin, Lock, Store, Sparkles, Mail, Phone, Eye,
  ShieldAlert, LogIn, UserPlus, LogOut,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "حسابي | رَوَاج" }] }),
  component: ProfilePage,
});

const accountMenu: { to: string; label: string; icon: typeof User; badge?: string }[] = [
  { to: "/listings", label: "إعلاناتي", icon: FileSpreadsheet, badge: "تجريبي" },
  { to: "/add-listing", label: "إضافة إعلان", icon: Plus },
  { to: "/favorites", label: "المفضلة", icon: Heart },
  { to: "/saved-searches", label: "عمليات البحث المحفوظة", icon: Bookmark },
  { to: "/chats", label: "الرسائل", icon: MessageCircle, badge: "قريباً" },
  { to: "/promotion", label: "الترويج والتمييز", icon: Sparkles, badge: "قريباً" },
  { to: "/support", label: "الدعم والمساعدة", icon: LifeBuoy },
  { to: "/safety", label: "نصائح الأمان", icon: ShieldAlert },
  { to: "/terms", label: "شروط الاستخدام", icon: FileText },
  { to: "/privacy", label: "سياسة الخصوصية", icon: ShieldCheck },
];

const identityFields = [
  { label: "اسم المستخدم", value: "—", icon: User },
  { label: "رقم الهاتف", value: "غير مضاف", icon: Phone },
  { label: "البريد الإلكتروني", value: "غير مضاف", icon: Mail },
  { label: "المحافظة الأساسية", value: "غير محددة", icon: MapPin },
  { label: "نوع الحساب", value: "مستخدم عادي", icon: User },
  { label: "حالة التوثيق", value: "غير موثّق", icon: BadgeCheck },
  { label: "تاريخ الانضمام", value: "—", icon: User },
  { label: "تقييم المستخدم", value: "—", icon: BadgeCheck },
];

const stats = [
  { label: "إعلانات", value: 0 },
  { label: "مفضلة", value: 0 },
  { label: "رسائل", value: 0 },
];

const settingsGroups: { title: string; items: { label: string; icon: typeof User; hint?: string }[] }[] = [
  {
    title: "المعلومات الشخصية",
    items: [
      { label: "الاسم الظاهر", icon: User, hint: "قريباً" },
      { label: "الصورة الشخصية", icon: User, hint: "قريباً" },
      { label: "نبذة عني", icon: FileText, hint: "قريباً" },
      { label: "المحافظة والمنطقة", icon: MapPin, hint: "قريباً" },
    ],
  },
  {
    title: "بيانات التواصل",
    items: [
      { label: "رقم الهاتف", icon: Phone, hint: "قريباً" },
      { label: "واتساب", icon: MessageCircle, hint: "قريباً" },
      { label: "البريد الإلكتروني", icon: Mail, hint: "قريباً" },
      { label: "وقت التواصل المفضل", icon: Bell, hint: "قريباً" },
    ],
  },
  {
    title: "الخصوصية",
    items: [
      { label: "إظهار رقم الهاتف للمشترين الجادّين فقط", icon: Eye, hint: "قريباً" },
      { label: "إخفاء واتساب", icon: Eye, hint: "قريباً" },
      { label: "السماح بالرسائل", icon: MessageCircle, hint: "قريباً" },
      { label: "المستخدمون المحظورون", icon: ShieldAlert, hint: "قريباً" },
    ],
  },
  {
    title: "الإشعارات",
    items: [
      { label: "إشعارات الرسائل الجديدة", icon: Bell, hint: "قريباً" },
      { label: "تحديثات المفضلة", icon: Bell, hint: "قريباً" },
      { label: "تنبيهات البحث المحفوظ", icon: Bell, hint: "قريباً" },
      { label: "تحديثات الترويج", icon: Bell, hint: "قريباً" },
      { label: "إشعارات الإدارة", icon: Bell, hint: "قريباً" },
    ],
  },
  {
    title: "الأمان وكلمة المرور",
    items: [
      { label: "تغيير كلمة المرور", icon: Lock, hint: "قريباً" },
      { label: "التحقق بخطوتين", icon: ShieldCheck, hint: "قريباً" },
      { label: "الجلسات النشطة", icon: ShieldCheck, hint: "قريباً" },
      { label: "حذف الحساب", icon: Trash2, hint: "قريباً" },
    ],
  },
  {
    title: "اللغة والتفضيلات",
    items: [
      { label: "اللغة", icon: Globe, hint: "العربية" },
      { label: "المحافظة الافتراضية", icon: MapPin, hint: "قريباً" },
      { label: "العملة المفضلة", icon: Settings, hint: "ل.س" },
    ],
  },
  {
    title: "إعدادات البائع/المتجر",
    items: [
      { label: "نوع الحساب (متجر/نشاط تجاري)", icon: Store, hint: "قريباً" },
      { label: "اسم المتجر", icon: Store, hint: "قريباً" },
      { label: "النشاط التجاري", icon: Store, hint: "قريباً" },
      { label: "وثائق التوثيق", icon: BadgeCheck, hint: "قريباً" },
      { label: "طلب التمييز", icon: Sparkles, hint: "قريباً" },
    ],
  },
];

function ProfilePage() {
  return (
    <>
      <PageHeader title="حسابي" back={false} />
      <main className="container-wide pt-4 pb-10 space-y-5">
        {/* Guest card */}
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-foreground/10">
              <User className="h-6 w-6 text-gold" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold">زائر</h2>
              <p className="text-xs text-primary-foreground/80">
                تسجيل الدخول غير مفعّل حالياً — سيتم تفعيل الحسابات لاحقاً.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button disabled title="قريباً" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gold px-3 py-2 text-xs font-bold text-gold-foreground opacity-90">
              <LogIn className="h-4 w-4" /> تسجيل الدخول · قريباً
            </button>
            <button disabled title="قريباً" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-foreground/10 px-3 py-2 text-xs font-bold opacity-90">
              <UserPlus className="h-4 w-4" /> إنشاء حساب · قريباً
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-primary-foreground/10 py-2">
                <div className="text-base font-extrabold">{s.value}</div>
                <div className="text-[10px] text-primary-foreground/70">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Identity skeleton */}
        <section className="rounded-2xl bg-card p-4 hairline">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-extrabold">بيانات الحساب</h3>
            <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              نموذج تجريبي — يظهر بعد تفعيل تسجيل الدخول
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {identityFields.map((f) => (
              <div key={f.label} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-b-0">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <f.icon className="h-3.5 w-3.5" /> {f.label}
                </span>
                <span className="font-semibold text-foreground/80">{f.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Account menu */}
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

        {/* Settings */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-extrabold">إعدادات الحساب</h3>
            <span className="text-[10px] text-muted-foreground">جميع الخيارات قريباً</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {settingsGroups.map((g) => (
              <div key={g.title} className="rounded-2xl bg-card p-4 hairline">
                <h4 className="mb-2 text-xs font-extrabold text-foreground">{g.title}</h4>
                <ul className="space-y-1.5">
                  {g.items.map((it) => (
                    <li key={it.label} className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-2 text-foreground/80">
                        <it.icon className="h-3.5 w-3.5 text-muted-foreground" /> {it.label}
                      </span>
                      <span className="rounded-md bg-muted-surface px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {it.hint ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Verification */}
        <section className="rounded-2xl bg-card-warm p-4 hairline">
          <h3 className="mb-2 text-sm font-extrabold inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-emerald-trust" /> توثيق الحساب
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            التوثيق غير مفعّل حالياً — سيتطلب لاحقاً ما يلي:
          </p>
          <ul className="space-y-1 text-xs text-foreground/80 list-disc ps-5">
            <li>الاسم الحقيقي</li>
            <li>رقم الهاتف</li>
            <li>صورة هوية / سجل تجاري للمتاجر</li>
            <li>المحافظة</li>
            <li>مراجعة من فريق رَوَاج</li>
          </ul>
          <button disabled className="mt-3 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold text-muted-foreground cursor-not-allowed">
            طلب التوثيق · قريباً
          </button>
        </section>

        {/* Logout placeholder */}
        <button
          disabled
          title="غير مفعّل حالياً"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card p-4 text-muted-foreground hairline cursor-not-allowed"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-semibold">تسجيل الخروج · غير مفعّل حالياً</span>
        </button>
      </main>
    </>
  );
}
