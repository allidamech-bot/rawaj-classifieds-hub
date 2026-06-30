import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useUiPreferences } from "@/lib/ui-preferences";

const groups: {
  titleAr: string;
  titleEn: string;
  links: { to: string; labelAr: string; labelEn: string }[];
}[] = [
  {
    titleAr: "المنصة",
    titleEn: "Platform",
    links: [
      { to: "/", labelAr: "الرئيسية", labelEn: "Home" },
      { to: "/categories", labelAr: "الأقسام", labelEn: "Categories" },
      { to: "/listings", labelAr: "كل الإعلانات", labelEn: "All listings" },
      { to: "/add-listing", labelAr: "أضف إعلان", labelEn: "Post a listing" },
    ],
  },
  {
    titleAr: "المساعدة",
    titleEn: "Help",
    links: [
      { to: "/support", labelAr: "الدعم", labelEn: "Support" },
      { to: "/safety", labelAr: "نصائح الأمان", labelEn: "Safety" },
      { to: "/promotion", labelAr: "ترويج إعلان", labelEn: "Promotion" },
      { to: "/prohibited", labelAr: "الإعلانات الممنوعة", labelEn: "Prohibited" },
    ],
  },
  {
    titleAr: "المعلومات",
    titleEn: "Information",
    links: [
      { to: "/terms", labelAr: "شروط الاستخدام", labelEn: "Terms" },
      { to: "/privacy", labelAr: "سياسة الخصوصية", labelEn: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  const { text } = useUiPreferences();

  return (
    <footer className="mt-10 border-t border-border bg-card-warm">
      <div className="container-wide grid grid-cols-2 gap-6 py-8 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.titleAr}>
            <h4 className="mb-2 text-xs font-extrabold text-foreground">
              {text(group.titleAr, group.titleEn)}
            </h4>
            <ul className="space-y-1.5">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to as "/"}
                    className="text-xs text-muted-foreground transition hover:text-primary"
                  >
                    {text(link.labelAr, link.labelEn)}
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
            © {new Date().getFullYear()}{" "}
            {text("رَوَاج · سوق سوريا المجاني للإعلانات", "RAWAJ · Syria classifieds marketplace")}
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-gold" />{" "}
            {text("سوريا فقط · تصفح آمن", "Syria only · Safe browsing")}
          </span>
        </div>
      </div>
    </footer>
  );
}
