import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Crown,
  FileCheck,
  Flag,
  Lock,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import {
  adminQueues,
  adminTeam,
  auditLog,
  demoNotice,
  featuredListingQueue,
  ownerMetrics,
  permissionMatrix,
  platformSettings,
} from "@/data/adminMockData";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

const ownerActions = [
  "إضافة مشرف · قريباً",
  "إدارة صلاحيات المشرفين · قريباً",
  "إعدادات المنصة · قريباً",
  "عرض سجل النشاط · نموذج تجريبي",
  "مراجعة طلبات الترويج",
  "مراجعة البلاغات",
  "مراجعة الإعلانات المعلقة",
];

const adminCan = [
  "مراجعة الإعلانات ضمن الصلاحية",
  "متابعة البلاغات المفتوحة",
  "مراجعة طلبات الترويج",
  "إضافة ملاحظات داخلية لاحقاً",
];
const ownerOnly = [
  "إدارة المالك أو المشرفين",
  "تعطيل أو حذف الحسابات",
  "إعدادات المنصة",
  "تجاوز الصلاحيات المحددة",
];

function AdminOverview() {
  const { language, text } = useUiPreferences();

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
              <h2 className="text-xl font-extrabold">{text("صاحب التطبيق", "App owner")}</h2>
              <p className="mt-1 max-w-2xl text-xs text-primary-foreground/80">
                {text(
                  "هذه لوحة المالك كنموذج تجريبي — سيتم تفعيل الصلاحيات عند اكتمال ربط الحسابات والأنظمة التشغيلية.",
                  "This owner dashboard is a demo model. Permissions will be activated when accounts and operational systems are complete.",
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold">{uiLabel("صلاحيات كاملة", language)}</Badge>
            <Badge>{uiLabel("كل الصلاحيات", language)}</Badge>
            <Badge>{uiLabel(demoNotice, language)}</Badge>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle icon={Activity} title={uiLabel("مؤشرات المالك", language)} />
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
        <SectionTitle icon={Crown} title={uiLabel("إجراءات المالك فقط", language)} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ownerActions.map((action) => (
            <button
              key={action}
              disabled
              className="rounded-xl bg-card p-3 text-start text-xs font-bold hairline opacity-70 cursor-not-allowed"
            >
              {uiLabel(action, language)}
              <span className="mt-1 block text-[10px] font-semibold text-muted-foreground">
                {uiLabel(demoNotice, language)}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon={ShieldCheck} title={uiLabel("مصفوفة الصلاحيات", language)} />
        <div className="overflow-x-auto rounded-2xl bg-card hairline">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted-surface text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-start">{uiLabel("الصلاحية", language)}</th>
                <th className="p-3 text-start">Owner</th>
                <th className="p-3 text-start">Admin</th>
                <th className="p-3 text-start">Moderator</th>
              </tr>
            </thead>
            <tbody>
              {permissionMatrix.map(([label, owner, admin, moderator]) => (
                <tr key={label} className="border-t border-border">
                  <td className="p-3 font-bold">{uiLabel(label, language)}</td>
                  <td className="p-3">
                    <Permission value={owner} language={language} />
                  </td>
                  <td className="p-3">
                    <Permission value={admin} language={language} />
                  </td>
                  <td className="p-3">
                    <Permission value={moderator} language={language} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl bg-card p-4 hairline">
          <SectionTitle icon={UserCog} title={uiLabel("مساحة عمل المشرف", language)} compact />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge>{uiLabel("مشرف", language)}</Badge>
            <Badge>{uiLabel(demoNotice, language)}</Badge>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            {text(
              "صلاحيات المشرف يحددها صاحب التطبيق. لا يمكن للمشرف إدارة المالك أو تجاوز صلاحياته.",
              "Moderator permissions are set by the app owner. Moderators cannot manage the owner or exceed their permissions.",
            )}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ListBlock
              title={uiLabel("ما يمكن للمشرف فعله", language)}
              items={adminCan}
              language={language}
            />
            <ListBlock
              title={uiLabel("ما يتطلب صلاحية المالك", language)}
              items={ownerOnly}
              language={language}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {adminQueues.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted-surface p-3">
                <div className="text-lg font-extrabold">{value}</div>
                <div className="text-xs text-muted-foreground">{uiLabel(label, language)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "قبول إعلان · نموذج تجريبي",
              "رفض إعلان · نموذج تجريبي",
              "طلب مراجعة المالك · قريباً",
              "إضافة ملاحظة داخلية · قريباً",
            ].map((label) => (
              <button
                key={label}
                disabled
                className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground opacity-70 cursor-not-allowed"
              >
                {uiLabel(label, language)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4 hairline">
          <SectionTitle icon={Users} title={uiLabel("إدارة المشرفين", language)} compact />
          <p className="mb-3 text-xs text-muted-foreground">
            {text(
              "إدارة المشرفين متاحة للمالك فقط عند تفعيل الحسابات والصلاحيات.",
              "Admin management is available only to the owner after accounts and permissions are enabled.",
            )}
          </p>
          <div className="space-y-2">
            {adminTeam.map((admin) => (
              <div key={admin.id} className="rounded-xl bg-muted-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-extrabold">{admin.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {admin.id} · {admin.role} · {admin.last}
                    </div>
                  </div>
                  <Badge>{uiLabel(admin.status, language)}</Badge>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {admin.count} {text("إجراء", "actions")} · {uiLabel(admin.perms, language)} ·{" "}
                  {uiLabel(admin.note, language)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    "عرض الصلاحيات",
                    "تعديل الصلاحيات",
                    "إيقاف المشرف",
                    "إزالة صلاحية الأدمن",
                    "إضافة ملاحظة",
                    "عرض سجل النشاط",
                  ].map((action) => (
                    <button
                      key={action}
                      disabled
                      className="rounded-md bg-card px-2 py-1 text-[10px] font-bold hairline opacity-70 cursor-not-allowed"
                    >
                      {uiLabel(action, language)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle icon={Sparkles} title={uiLabel("إدارة تمييز الإعلانات", language)} />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {featuredListingQueue.map((item) => (
            <div key={item.listingId} className="rounded-2xl bg-card p-4 hairline">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {item.listingId} · {item.seller}
                  </p>
                </div>
                <Badge>{uiLabel(item.featured, language)}</Badge>
              </div>
              <InfoGrid
                rows={[
                  ["القسم", uiLabel(item.category, language)],
                  ["المحافظة", uiLabel(item.governorate, language)],
                  ["حالة الإعلان", uiLabel(item.status, language)],
                  ["مدة الترويج", uiLabel(item.duration, language)],
                  ["تاريخ البداية/النهاية", uiLabel(item.dates, language)],
                  ["حالة الدفع", uiLabel(item.payment, language)],
                  ["المراجع", uiLabel(item.reviewer, language)],
                  ["موافقة المالك مطلوبة", uiLabel(item.owner, language)],
                  ["ملاحظة", uiLabel(item.note, language)],
                ]}
                language={language}
              />
              <ActionRow
                actions={[
                  "تمييز الإعلان",
                  "إزالة التمييز",
                  "تمديد التمييز",
                  "رفض طلب التمييز",
                  "طلب مراجعة المالك",
                  "إضافة ملاحظة",
                ]}
                language={language}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl bg-card p-4 hairline">
          <SectionTitle icon={Activity} title={uiLabel("سجل نشاط المالك", language)} compact />
          <p className="mb-3 text-xs text-muted-foreground">
            {text(
              "سجل النشاط تجريبي — سيتم تسجيل كل إجراء إداري لاحقاً في قاعدة البيانات.",
              "The activity log is demo-only. Each admin action will later be recorded in the database.",
            )}
          </p>
          <div className="space-y-2">
            {auditLog.map(([time, actor, role, action, target, status, note]) => (
              <div key={`${time}-${action}`} className="rounded-xl bg-muted-surface p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b>{uiLabel(action, language)}</b>
                  <Badge>{uiLabel(status, language)}</Badge>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {text("الوقت:", "Time:")} {time} · {text("من قام بالإجراء:", "Actor:")}{" "}
                  {uiLabel(actor, language)} · {text("الدور:", "Role:")} {uiLabel(role, language)} ·{" "}
                  {text("العنصر المتأثر:", "Target:")} {target}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {text("ملاحظة:", "Note:")} {uiLabel(note, language)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card p-4 hairline">
          <SectionTitle icon={Settings} title={uiLabel("إعدادات المالك", language)} compact />
          <p className="mb-3 text-xs text-muted-foreground">
            {uiLabel("إعدادات المالك — غير مفعّلة حالياً", language)}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {platformSettings.map((setting) => (
              <button
                key={setting}
                disabled
                className="flex items-center justify-between rounded-xl bg-muted-surface p-3 text-xs font-bold opacity-70 cursor-not-allowed"
              >
                <span>{uiLabel(setting, language)}</span>
                <span className="text-[10px] text-muted-foreground">
                  {uiLabel("غير مفعّل حالياً", language)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="rounded-2xl bg-warning/10 p-3 text-xs text-foreground/90 hairline">
        {text(
          "كل الأزرار والإجراءات داخل لوحة المالك/الإدارة معطّلة ومعلّمة كنموذج تجريبي. المستخدمون العاديون لا يظهر لهم وصول إداري حقيقي الآن.",
          "All buttons and actions in the owner/admin dashboard are disabled and marked as demo. Regular users do not receive real admin access now.",
        )}
        <Link to="/profile" className="ms-1 font-bold text-primary">
          {uiLabel("عرض ربط الحسابات في الملف الشخصي", language)}
        </Link>
      </div>
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

function Badge({ children, tone }: { children: React.ReactNode; tone?: "gold" }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-[10px] font-bold ${tone === "gold" ? "bg-gold text-gold-foreground" : "bg-muted-surface text-foreground"}`}
    >
      {children}
    </span>
  );
}

function Permission({ value, language }: { value: string; language: Language }) {
  const tone =
    value === "مسموح"
      ? "text-emerald-trust"
      : value === "حسب الصلاحية"
        ? "text-warning"
        : "text-muted-foreground";
  return <span className={`text-xs font-extrabold ${tone}`}>{uiLabel(value, language)}</span>;
}

function ListBlock({
  title,
  items,
  language,
}: {
  title: string;
  items: string[];
  language: Language;
}) {
  return (
    <div className="rounded-xl bg-muted-surface p-3">
      <h3 className="mb-2 text-xs font-extrabold">{title}</h3>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item}>• {uiLabel(item, language)}</li>
        ))}
      </ul>
    </div>
  );
}

function InfoGrid({ rows, language }: { rows: string[][]; language: Language }) {
  return (
    <dl className="grid grid-cols-1 gap-1 text-xs">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between gap-3 border-b border-border/60 py-1 last:border-b-0"
        >
          <dt className="text-muted-foreground">{uiLabel(label, language)}</dt>
          <dd className="text-start font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActionRow({ actions, language }: { actions: string[]; language: Language }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {actions.map((action) => (
        <button
          key={action}
          disabled
          className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground cursor-not-allowed"
        >
          {uiLabel(action, language)} · {uiLabel("نموذج تجريبي", language)}
        </button>
      ))}
    </div>
  );
}
