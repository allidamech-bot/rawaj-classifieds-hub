import { createFileRoute } from "@tanstack/react-router";
import { FileCheck, Flag, Users, Sparkles, MessageSquare, ShieldX } from "lucide-react";
import { listings } from "@/data/mockData";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

const metrics = [
  { label: "إعلانات جديدة اليوم", value: 24, icon: FileCheck, color: "text-primary" },
  { label: "بلاغات مفتوحة", value: 7, icon: Flag, color: "text-destructive" },
  { label: "مستخدمون نشطون", value: 1840, icon: Users, color: "text-emerald-trust" },
  { label: "طلبات تمييز", value: 12, icon: Sparkles, color: "text-gold" },
];

const sections = [
  { t: "الإعلانات بانتظار المراجعة", c: 14, icon: FileCheck },
  { t: "البلاغات المفتوحة", c: 7, icon: Flag },
  { t: "المستخدمون", c: 1840, icon: Users },
  { t: "طلبات التمييز", c: 12, icon: Sparkles },
  { t: "تذاكر الدعم", c: 5, icon: MessageSquare },
  { t: "الكلمات المحظورة", c: 38, icon: ShieldX },
];

function AdminOverview() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl bg-card p-4 hairline shadow-soft">
            <div className="flex items-center justify-between">
              <m.icon className={`h-5 w-5 ${m.color}`} />
            </div>
            <div className="mt-3 text-2xl font-extrabold">{m.value.toLocaleString("ar-SY")}</div>
            <p className="mt-1 text-xs text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-6 mb-3 text-base font-extrabold">
        <span className="inline-block border-b-2 border-gold pb-0.5">الأقسام الإدارية</span>
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <div key={s.t} className="flex items-center gap-3 rounded-2xl bg-card p-4 hairline">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted-surface text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{s.t}</div>
              <div className="text-xs text-muted-foreground">{s.c} عنصر</div>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        لوحة إدارة بواجهات عرض فقط. سيتم ربطها بالخادم لاحقاً.
      </p>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        إجمالي الإعلانات في النظام (وهمية): {listings.length}
      </p>
    </>
  );
}
