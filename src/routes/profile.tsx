import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User, Heart, Bookmark, BadgeCheck, LifeBuoy, FileText, ShieldCheck,
  Trash2, ChevronLeft, FileSpreadsheet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "حسابي | رَوَاج" }] }),
  component: ProfilePage,
});

const items = [
  { to: "/listings", label: "إعلاناتي", icon: FileSpreadsheet },
  { to: "/favorites", label: "المفضلة", icon: Heart },
  { to: "/saved-searches", label: "عمليات البحث المحفوظة", icon: Bookmark },
  { to: "/promotion", label: "تمييز إعلان", icon: BadgeCheck },
  { to: "/support", label: "الدعم", icon: LifeBuoy },
  { to: "/terms", label: "شروط الاستخدام", icon: FileText },
  { to: "/privacy", label: "سياسة الخصوصية", icon: ShieldCheck },
] as const;

function ProfilePage() {
  return (
    <>
      <PageHeader title="حسابي" back={false} />
      <main className="container-wide pt-4">
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary-foreground/10">
              <User className="h-6 w-6 text-gold" />
            </span>
            <div>
              <h2 className="text-lg font-extrabold">مرحباً بك في رَوَاج</h2>
              <p className="text-xs text-primary-foreground/80">سجّل دخولك لاحقاً لإدارة إعلاناتك ومراسلاتك.</p>
            </div>
          </div>
          <button className="mt-4 rounded-xl bg-gold px-5 py-2 text-sm font-bold text-gold-foreground">
            تسجيل الدخول لاحقاً
          </button>
        </section>

        <nav className="mt-4 overflow-hidden rounded-2xl bg-card hairline">
          {items.map((it, i) => (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 p-4 transition hover:bg-muted-surface ${i !== 0 ? "border-t border-border" : ""}`}
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted-surface text-primary">
                <it.icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-semibold">{it.label}</span>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </nav>

        <button className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-destructive hairline transition hover:bg-destructive/5">
          <Trash2 className="h-4 w-4" />
          <span className="text-sm font-semibold">حذف الحساب لاحقاً</span>
        </button>
      </main>
    </>
  );
}
