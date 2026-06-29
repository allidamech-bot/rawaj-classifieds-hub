import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
});

const users = [
  { n: "محمد عبد القادر", t: "verified", l: 12, joined: "2024", status: "نشط", v: "موثّق" },
  { n: "متجر الذكي", t: "store", l: 38, joined: "2023", status: "نشط", v: "موثّق" },
  { n: "مكتب الأمل العقاري", t: "business", l: 24, joined: "2023", status: "نشط", v: "قيد المراجعة" },
  { n: "أبو خالد", t: "user", l: 3, joined: "2025", status: "جديد", v: "غير موثّق" },
];

function typeLabel(t: string) {
  switch (t) {
    case "verified": return "بائع موثّق";
    case "store": return "متجر";
    case "business": return "حساب أعمال";
    default: return "مستخدم";
  }
}

function UsersPage() {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-card p-3 hairline text-xs text-muted-foreground">
        إدارة المستخدمين — للعرض فقط. سيتم التفعيل عند ربط الخادم.
      </div>
      {users.map((u, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-card p-3 hairline">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-bold">
            {u.n.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-sm font-bold">
              {u.n}
              {u.t !== "user" && <BadgeCheck className="h-3.5 w-3.5 text-emerald-trust" />}
            </div>
            <div className="text-xs text-muted-foreground">
              {typeLabel(u.t)} · {u.l} إعلان · انضم {u.joined} · {u.v}
            </div>
          </div>
          <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{u.status}</span>
          <button disabled title="غير مفعّل" className="rounded-lg bg-card px-3 py-1.5 text-xs font-bold hairline opacity-70 cursor-not-allowed">
            إدارة · قريباً
          </button>
        </div>
      ))}
    </div>
  );
}
