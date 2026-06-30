import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Filter,
  Lock,
  Search,
  ShieldAlert,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { adminTeam, demoNotice, managedUsers, sellerVerificationQueue } from "@/data/adminMockData";
import type { ClassifiedsError } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

const summary = [
  ["إجمالي المستخدمين", "18,420"],
  ["نشط", "12,860"],
  ["مجمّد", "86"],
  ["قيد المراجعة", "214"],
  ["موثّق", "1,240"],
  ["حسابات أعمال", "430"],
  ["مشرفون", "6"],
];

const filters = ["الدور", "الحالة", "التوثيق", "المحافظة", "البحث بالاسم/المعرف"];

function UsersPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFetchError(null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
          {uiLabel(
            "إدارة المستخدمين نموذج تجريبي فقط. الحذف/التعطيل يحتاج صلاحية المالك. التجميد والتوثيق والتميز إجراءات تجريبية حالياً.",
            language,
          )}
        </div>
        <div className="rounded-2xl bg-card p-10 text-center hairline text-sm text-muted-foreground">
          {uiLabel("جارٍ تجهيز لوحة المستخدمين...", language)}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
          {uiLabel(
            "إدارة المستخدمين نموذج تجريبي فقط. الحذف/التعطيل يحتاج صلاحية المالك. التجميد والتوثيق والتميز إجراءات تجريبية حالياً.",
            language,
          )}
        </div>
        <div className="rounded-2xl bg-card p-10 text-center hairline">
          <p className="text-sm font-semibold">
            {uiLabel("تعذر تحميل بيانات المستخدمين", language)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{fetchError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-warning/10 p-3 hairline text-xs text-foreground/90">
        {uiLabel(
          "إدارة المستخدمين نموذج تجريبي فقط. الحذف/التعطيل يحتاج صلاحية المالك. التجميد والتوثيق والتميز إجراءات تجريبية حالياً.",
          language,
        )}
      </div>

      {managedUsers.length === 0 &&
      adminTeam.length === 0 &&
      sellerVerificationQueue.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center hairline text-sm text-muted-foreground">
          {uiLabel(
            "لا توجد بيانات مستخدمين حقيقية حالياً. ستظهر هنا بيانات المستخدمين بعد اكتمال ربط الحسابات والصلاحيات.",
            language,
          )}
        </div>
      ) : (
        <div>
          <section>
            <Title icon={Users} text={uiLabel("ملخص المستخدمين", language)} />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              {summary.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-card p-3 hairline">
                  <div className="text-xl font-extrabold">{value}</div>
                  <p className="text-xs text-muted-foreground">{uiLabel(label, language)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-card p-4 hairline">
            <Title icon={Filter} text={uiLabel("فلاتر تجريبية", language)} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {filters.map((filter) => (
                <button
                  key={filter}
                  disabled
                  className="flex items-center justify-between rounded-xl bg-muted-surface p-3 text-xs font-bold opacity-70 cursor-not-allowed"
                >
                  <span className="inline-flex items-center gap-2">
                    {filter.includes("البحث") ? (
                      <Search className="h-3.5 w-3.5" />
                    ) : (
                      <Filter className="h-3.5 w-3.5" />
                    )}
                    {uiLabel(filter, language)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {uiLabel("غير مفعّل", language)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <Title icon={UserCog} text={uiLabel("جدول التحكم بالمستخدمين", language)} />
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {managedUsers.map((user) => (
                <article key={user.id} className="rounded-2xl bg-card p-4 hairline">
                  <div className="mb-3 flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground">
                      {user.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-extrabold">{user.name}</h3>
                        <Badge>{uiLabel(user.type, language)}</Badge>
                        <Badge>{uiLabel(user.status, language)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{user.id}</p>
                    </div>
                  </div>
                  <Info
                    rows={[
                      ["نوع الحساب", uiLabel(user.type, language)],
                      ["حالة الحساب", uiLabel(user.status, language)],
                      ["حالة التوثيق", uiLabel(user.verification, language)],
                      ["حالة التميز", uiLabel(user.featured, language)],
                      ["المحافظة", uiLabel(user.governorate, language)],
                      ["تاريخ الانضمام", user.joined],
                      ["آخر نشاط", user.last],
                      ["عدد الإعلانات", String(user.listings)],
                      ["عدد البلاغات", String(user.reports)],
                      ["تقييم المستخدم", user.rating],
                      ["ملاحظات إدارية", uiLabel(user.note, language)],
                    ]}
                    language={language}
                  />
                  <ActionRow
                    actions={[
                      "عرض الملف",
                      "عرض الإعلانات",
                      "تجميد المستخدم",
                      "إلغاء التجميد",
                      "تعطيل الحساب",
                      "حذف/إزالة الحساب",
                      "منح توثيق",
                      "سحب التوثيق",
                      "منح تميز للبائع",
                      "إزالة التميز",
                      "إضافة ملاحظة إدارية",
                    ]}
                    language={language}
                  />
                  <InternalNote language={language} />
                </article>
              ))}
            </div>
          </section>

          <section>
            <Title icon={BadgeCheck} text={uiLabel("طلبات توثيق وتمييز البائعين", language)} />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {sellerVerificationQueue.map((seller) => (
                <article key={seller.seller} className="rounded-2xl bg-card p-4 hairline">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold">{seller.seller}</h3>
                      <p className="text-xs text-muted-foreground">
                        {uiLabel(seller.type, language)}
                      </p>
                    </div>
                    <Sparkles className="h-4 w-4 text-gold" />
                  </div>
                  <Info
                    rows={[
                      ["حالة التوثيق", uiLabel(seller.verification, language)],
                      ["حالة التميز", uiLabel(seller.featured, language)],
                      ["مستندات التوثيق", uiLabel(seller.docs, language)],
                      ["تاريخ الطلب", seller.date],
                      ["آخر مراجعة", uiLabel(seller.review, language)],
                      ["ملاحظة الإدارة", uiLabel(seller.note, language)],
                    ]}
                    language={language}
                  />
                  <ActionRow
                    actions={[
                      "قبول التوثيق",
                      "رفض التوثيق",
                      "سحب التوثيق",
                      "منح تميز",
                      "إزالة التميز",
                      "تمديد التميز",
                      "طلب مستندات إضافية",
                    ]}
                    language={language}
                  />
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {uiLabel("لا يوجد رفع ملفات حقيقي. تسميات المستندات تجريبية فقط.", language)}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-card p-4 hairline">
            <Title
              icon={ShieldAlert}
              text={uiLabel("إدارة المشرفين داخل صفحة المستخدمين", language)}
            />
            <p className="mb-3 text-xs text-muted-foreground">
              {uiLabel("إدارة المشرفين متاحة للمالك فقط عند تفعيل الحسابات والصلاحيات.", language)}
            </p>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {adminTeam.map((admin) => (
                <div key={admin.id} className="rounded-xl bg-muted-surface p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>{admin.name}</b>
                    <Badge>{uiLabel(admin.status, language)}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {admin.id} · {uiLabel(admin.role, language)} ·{" "}
                    {text("آخر نشاط:", "Last active:")} {uiLabel(admin.last, language)}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {admin.count} {text("إجراء", "actions")} · {uiLabel(admin.perms, language)} ·{" "}
                    {uiLabel(admin.note, language)}
                  </p>
                  <ActionRow
                    actions={[
                      "عرض الصلاحيات",
                      "تعديل الصلاحيات",
                      "إيقاف المشرف",
                      "إزالة صلاحية الأدمن",
                      "إضافة ملاحظة",
                      "عرض سجل النشاط",
                    ]}
                    compact
                    language={language}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-2xl bg-destructive/10 p-3 text-xs text-foreground/90 hairline">
            <Lock className="me-1 inline h-3.5 w-3.5 text-destructive" />
            {uiLabel(demoNotice, language)}.{" "}
            {uiLabel("لا توجد قاعدة بيانات أو صلاحيات أو حذف حقيقي في هذه الصفحة.", language)}
          </div>
        </div>
      )}
    </div>
  );
}

function Title({ icon: Icon, text }: { icon: typeof Users; text: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
      <Icon className="h-4 w-4 text-primary" />
      {text}
    </h2>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function Info({ rows, language }: { rows: string[][]; language: Language }) {
  return (
    <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-muted-surface px-2 py-1.5">
          <dt className="text-muted-foreground">{uiLabel(label, language)}</dt>
          <dd className="mt-0.5 font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionRow({
  actions,
  compact = false,
  language,
}: {
  actions: string[];
  compact?: boolean;
  language: Language;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-2" : "mt-3"}`}>
      {actions.map((action) => (
        <button
          key={action}
          disabled
          className="rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline opacity-70 cursor-not-allowed"
        >
          {uiLabel(action, language)} · {uiLabel("نموذج تجريبي", language)}
        </button>
      ))}
    </div>
  );
}

function InternalNote({ language }: { language: Language }) {
  return (
    <div className="mt-3 rounded-xl bg-muted-surface p-3 text-xs">
      <div className="font-extrabold">{uiLabel("ملاحظة داخلية", language)}</div>
      <p className="mt-1 text-muted-foreground">
        {uiLabel("أضيفت بواسطة: مشرف تجريبي · التاريخ: قيد التجهيز · الحالة: غير مفعّلة", language)}
      </p>
      <button
        disabled
        className="mt-2 rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline cursor-not-allowed"
      >
        {uiLabel("إضافة ملاحظة · قريباً", language)}
      </button>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {uiLabel("الملاحظات الداخلية لا تظهر للمستخدمين.", language)}
      </p>
    </div>
  );
}
