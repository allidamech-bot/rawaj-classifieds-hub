import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Crown,
  FileCheck,
  Flag,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import { ownerMetrics } from "@/data/adminMockData";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

const actions = [
  { labelAr: "مراجعة الإعلانات", to: "/admin/pending" },
  { labelAr: "مراجعة البلاغات", to: "/admin/reports" },
  { labelAr: "إدارة المستخدمين", to: "/admin/users" },
  { labelAr: "طلبات الترويج", to: "/admin/promotions" },
] as const;

function AdminOverview() {
  const { language, text } = useUiPreferences();
  const [notice, setNotice] = useState("");

  function acknowledge(ar: string, en: string) {
    setNotice(text(ar, en));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold text-gold-foreground">
              <Crown className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold text-primary-foreground/75">
                {text("مركز تحكم المالك", "Owner control center")}
              </p>
              <h2 className="text-xl font-extrabold">{text("إدارة رَوَاج", "RAWAJ management")}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-6 text-primary-foreground/80">
                {text(
                  "راقب طوابير المراجعة، البلاغات، المستخدمين، وطلبات الترويج من مساحة واحدة واضحة.",
                  "Monitor review queues, reports, users, and promotion requests from one clear workspace.",
                )}
              </p>
            </div>
          </div>
          <Badge tone="gold">{text("صلاحية المالك", "Owner access")}</Badge>
        </div>
      </section>

      <section>
        <SectionTitle icon={Activity} title={text("مؤشرات التشغيل", "Operational indicators")} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {ownerMetrics.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-card p-3 hairline">
              <div className="text-xl font-extrabold">{value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{uiLabel(label, language)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon={ShieldCheck} title={text("مهام الإدارة", "Admin tasks")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="rounded-2xl bg-card p-4 hairline transition hover:bg-muted-surface"
            >
              <div className="text-sm font-extrabold">{uiLabel(action.labelAr, language)}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {text("فتح مساحة العمل", "Open workspace")}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard icon={FileCheck} title={text("مراجعة الإعلانات", "Listing review")}>
          <p className="text-xs leading-6 text-muted-foreground">
            {text(
              "راجع الإعلانات المرسلة، أسباب الرفض، وملاحظات المالك من صفحة المراجعة.",
              "Review submitted listings, rejection reasons, and owner notes from the review page.",
            )}
          </p>
          <button
            type="button"
            onClick={() =>
              acknowledge("تم تسجيل إجراء مراجعة محلياً.", "Review action recorded locally.")
            }
            className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            {text("تسجيل مراجعة", "Record review")}
          </button>
        </AdminCard>
        <AdminCard icon={Flag} title={text("البلاغات والسلامة", "Reports and safety")}>
          <p className="text-xs leading-6 text-muted-foreground">
            {text(
              "تابع البلاغات حسب الحالة والأولوية مع الحفاظ على سجل واضح للمراجعة.",
              "Track reports by status and priority while keeping a clear review trail.",
            )}
          </p>
          <button
            type="button"
            onClick={() =>
              acknowledge(
                "تم تجهيز ملاحظة بلاغ لهذه الجلسة.",
                "Report note prepared for this session.",
              )
            }
            className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            {text("إضافة ملاحظة", "Add note")}
          </button>
        </AdminCard>
        <AdminCard icon={Users} title={text("المستخدمون", "Users")}>
          <p className="text-xs leading-6 text-muted-foreground">
            {text(
              "اعرض الحسابات، حالات التوثيق، وإشارات السلامة بدون تغيير صلاحيات من الواجهة.",
              "Review accounts, verification status, and safety markers without granting permissions from the frontend.",
            )}
          </p>
          <button
            type="button"
            onClick={() =>
              acknowledge("تم تحديث معاينة المستخدم محلياً.", "User view updated locally.")
            }
            className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            {text("تحديث المعاينة", "Update view")}
          </button>
        </AdminCard>
        <AdminCard icon={Sparkles} title={text("الترويج", "Promotion")}>
          <p className="text-xs leading-6 text-muted-foreground">
            {text(
              "تابع طلبات التمييز والدفع اليدوي بدون تنفيذ دفع أو تفعيل تلقائي.",
              "Track featuring and manual-payment requests without executing payment or automatic activation.",
            )}
          </p>
          <button
            type="button"
            onClick={() =>
              acknowledge("تم تسجيل قرار ترويج محلياً.", "Promotion decision recorded locally.")
            }
            className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            {text("تسجيل قرار", "Record decision")}
          </button>
        </AdminCard>
      </section>

      <section className="rounded-2xl bg-card p-4 hairline">
        <SectionTitle icon={Settings} title={text("إعدادات المالك", "Owner settings")} compact />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {["سياسة المراجعة", "إرشادات السلامة", "قوالب الردود"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() =>
                acknowledge(
                  "تم حفظ تفضيل الواجهة لهذه الجلسة.",
                  "Interface preference saved for this session.",
                )
              }
              className="rounded-xl bg-muted-surface p-3 text-start text-xs font-bold"
            >
              {uiLabel(item, language)}
            </button>
          ))}
        </div>
      </section>

      {notice && (
        <div className="rounded-2xl bg-emerald-trust/10 p-3 text-center text-xs font-bold text-emerald-trust hairline">
          {notice}
        </div>
      )}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  compact = false,
}: {
  icon: typeof Crown;
  title: string;
  compact?: boolean;
}) {
  return (
    <h2
      className={`flex items-center gap-2 font-extrabold ${compact ? "mb-3 text-sm" : "mb-3 text-base"}`}
    >
      <Icon className="h-4 w-4 text-primary" />
      {title}
    </h2>
  );
}

function AdminCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Crown;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 hairline">
      <SectionTitle icon={Icon} title={title} compact />
      {children}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "gold" }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-[10px] font-bold ${tone === "gold" ? "bg-gold text-gold-foreground" : "bg-muted-surface text-foreground"}`}
    >
      {children}
    </span>
  );
}
