import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Filter, Search, ShieldAlert, UserCog, Users } from "lucide-react";
import { useState } from "react";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

const users = [
  {
    id: "USR-1042",
    name: "متجر الشام",
    typeAr: "متجر",
    typeEn: "Store",
    statusAr: "نشط",
    statusEn: "Active",
    cityAr: "دمشق",
    cityEn: "Damascus",
    listings: 18,
    reports: 0,
  },
  {
    id: "USR-0881",
    name: "أحمد",
    typeAr: "بائع",
    typeEn: "Seller",
    statusAr: "قيد المراجعة",
    statusEn: "Under review",
    cityAr: "حلب",
    cityEn: "Aleppo",
    listings: 4,
    reports: 1,
  },
  {
    id: "USR-0770",
    name: "مكتب الساحل",
    typeAr: "حساب أعمال",
    typeEn: "Business",
    statusAr: "موثّق",
    statusEn: "Verified",
    cityAr: "اللاذقية",
    cityEn: "Latakia",
    listings: 11,
    reports: 0,
  },
];

function UsersPage() {
  const { language, text } = useUiPreferences();
  const [notice, setNotice] = useState("");

  function localAction(ar: string, en: string) {
    setNotice(text(ar, en));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-card p-4 hairline">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <Users className="h-4 w-4 text-primary" />
          {text("إدارة المستخدمين", "User management")}
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          {text(
            "مساحة مراجعة واجهية لحالات المستخدمين والتوثيق. لا تمنح هذه الصفحة صلاحيات فعلية ولا تنفذ حذفاً أو تعطيل حساب من الخادم.",
            "A frontend review workspace for user and verification states. This page does not grant real permissions or execute server-side deletion or suspension.",
          )}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [text("إجمالي العينة", "Sample total"), users.length],
          [text("نشط", "Active"), 2],
          [text("قيد المراجعة", "Under review"), 1],
          [text("موثّق", "Verified"), 1],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-card p-3 hairline">
            <div className="text-xl font-extrabold">{value}</div>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl bg-card p-4 hairline">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold">
          <Filter className="h-4 w-4 text-primary" />
          {text("الفلاتر", "Filters")}
        </h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[text("الدور", "Role"), text("الحالة", "Status"), text("المحافظة", "Governorate")].map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => localAction("تم تطبيق الفلتر محلياً.", "Filter applied locally.")}
                className="flex items-center justify-between rounded-xl bg-muted-surface p-3 text-xs font-bold"
              >
                <span className="inline-flex items-center gap-2">
                  <Search className="h-3.5 w-3.5" />
                  {item}
                </span>
                <span className="text-[10px] text-muted-foreground">{text("تطبيق", "Apply")}</span>
              </button>
            ),
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {users.map((user) => (
          <article key={user.id} className="rounded-2xl bg-card p-4 hairline">
            <div className="mb-3 flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground">
                {user.name.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold">{user.name}</h3>
                  <Badge>{language === "ar" ? user.typeAr : user.typeEn}</Badge>
                  <Badge>{language === "ar" ? user.statusAr : user.statusEn}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{user.id}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <Metric
                label={text("المحافظة", "Governorate")}
                value={language === "ar" ? user.cityAr : user.cityEn}
              />
              <Metric label={text("الإعلانات", "Listings")} value={String(user.listings)} />
              <Metric label={text("البلاغات", "Reports")} value={String(user.reports)} />
              <Metric
                label={text("الحالة", "Status")}
                value={language === "ar" ? user.statusAr : user.statusEn}
              />
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                [text("توثيق", "Verify"), "verified"],
                [text("تعليق", "Suspend"), "suspended"],
                [text("إعادة تنشيط", "Reactivate"), "active"],
                [text("ملاحظة", "Note"), "note"],
              ].map(([label, value]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    localAction(
                      "تم تسجيل الإجراء في الواجهة فقط.",
                      "Action recorded in the interface only.",
                    )
                  }
                  className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold"
                >
                  {label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl bg-card p-4 hairline">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold">
          <BadgeCheck className="h-4 w-4 text-emerald-trust" />
          {text("طلبات التوثيق", "Verification requests")}
        </h3>
        <p className="text-xs leading-6 text-muted-foreground">
          {text(
            "تُراجع طلبات التوثيق يدوياً، ولا يتم تغيير حالة الحساب الحقيقية من هذه الواجهة.",
            "Verification requests are reviewed manually, and real account status is not changed from this interface.",
          )}
        </p>
      </section>

      <section className="rounded-2xl bg-warning/10 p-3 text-xs leading-6 hairline">
        <ShieldAlert className="me-1 inline h-3.5 w-3.5 text-warning" />
        {text(
          "أي تعطيل أو حذف حقيقي يجب أن يبقى محمياً بسياسات الخادم والصلاحيات.",
          "Any real suspension or deletion must remain protected by server policies and permissions.",
        )}
      </section>

      {notice && (
        <p className="rounded-2xl bg-emerald-trust/10 p-3 text-center text-xs font-bold text-emerald-trust hairline">
          {notice}
        </p>
      )}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted-surface px-2 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-bold">{value}</dd>
    </div>
  );
}
