import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, UserCog, Users } from "lucide-react";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const { text } = useUiPreferences();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-card p-5 hairline">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted-surface text-primary">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold">
              {text("إدارة المستخدمين", "User management")}
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {text(
                "تحتاج إدارة الحسابات إلى واجهات خادم محمية ومراجعة صلاحيات واضحة قبل عرض بيانات المستخدمين أو تنفيذ أي إجراء إداري.",
                "Account management requires protected server APIs and explicit permission checks before user data or actions are shown.",
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard
          title={text("بيانات الحسابات", "Account data")}
          body={text(
            "لا تعرض هذه الصفحة أسماء أو معرفات أو أعداد مستخدمين ما لم تكن قادمة من مصدر محمي.",
            "This page does not show names, identifiers, or user totals unless they come from a protected source.",
          )}
        />
        <InfoCard
          title={text("إجراءات الإدارة", "Admin actions")}
          body={text(
            "تعليق الحسابات أو التوثيق أو إعادة التفعيل يبقى خارج هذه الواجهة حتى تتوفر واجهات آمنة لذلك.",
            "Suspension, verification, and reactivation stay outside this interface until safe APIs are available.",
          )}
        />
      </section>

      <section className="rounded-2xl bg-warning/10 p-4 text-xs leading-6 hairline">
        <ShieldAlert className="me-1 inline h-4 w-4 text-warning" />
        {text(
          "أي صلاحية لإدارة المستخدمين يجب أن تأتي من قواعد الأدوار وسياسات الوصول في Supabase، وليس من حالة واجهة فقط.",
          "Any user-management permission must come from Supabase role rules and access policies, not interface state alone.",
        )}
      </section>

      <Link
        to="/admin"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
      >
        <UserCog className="h-4 w-4" />
        {text("العودة للوحة الإدارة", "Back to admin dashboard")}
      </Link>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 hairline">
      <h3 className="text-sm font-extrabold">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}
