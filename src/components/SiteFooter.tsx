import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

const groups: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: "المنصة",
    links: [
      { to: "/", label: "الرئيسية" },
      { to: "/categories", label: "الأقسام" },
      { to: "/listings", label: "كل الإعلانات" },
      { to: "/add-listing", label: "أضف إعلان" },
    ],
  },
  {
    title: "المساعدة",
    links: [
      { to: "/support", label: "الدعم" },
      { to: "/safety", label: "نصائح الأمان" },
      { to: "/promotion", label: "ترويج إعلان" },
      { to: "/prohibited", label: "الإعلانات الممنوعة" },
    ],
  },
  {
    title: "المعلومات",
    links: [
      { to: "/terms", label: "شروط الاستخدام" },
      { to: "/privacy", label: "سياسة الخصوصية" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-border bg-card-warm">
      <div className="container-wide grid grid-cols-2 gap-6 py-8 sm:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title}>
            <h4 className="mb-2 text-xs font-extrabold text-foreground">{g.title}</h4>
            <ul className="space-y-1.5">
              {g.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to as "/"}
                    className="text-xs text-muted-foreground transition hover:text-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-wide flex flex-wrap items-center justify-between gap-2 py-4">
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} رَوَاج · سوق سوريا المجاني للإعلانات
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-gold" /> سوريا فقط · نسخة تجريبية
          </span>
        </div>
      </div>
    </footer>
  );
}
