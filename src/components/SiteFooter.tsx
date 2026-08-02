import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { BrandLockup } from "@/components/shell/BrandLockup";
import { useUiPreferences } from "@/lib/ui-preferences";

interface SiteFooterProps {
  pathname?: string;
}

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
      { to: "/offers", labelAr: "العروض", labelEn: "Offers" },
    ],
  },
  {
    titleAr: "المساعدة",
    titleEn: "Help",
    links: [
      { to: "/support", labelAr: "الدعم", labelEn: "Support" },
      { to: "/safety", labelAr: "نصائح الأمان", labelEn: "Safety" },
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

const mobileLinks = [
  { to: "/support", labelAr: "الدعم", labelEn: "Support" },
  { to: "/safety", labelAr: "الأمان", labelEn: "Safety" },
  { to: "/privacy", labelAr: "الخصوصية", labelEn: "Privacy" },
] as const;

export function SiteFooter(_props: SiteFooterProps) {
  const { text } = useUiPreferences();
  const year = new Date().getFullYear();

  return (
    <footer className="rawaj-site-footer mt-10">
      <div className="rawaj-site-footer__mobile container-wide lg:hidden">
        <div className="rawaj-site-footer__mobile-brand">
          <Link to="/" aria-label={text("رواج — الرئيسية", "RAWAJ — Home")}>
            <BrandLockup inverse compact />
          </Link>
          <p>{text("سوق سعوديا المجاني للإعلانات", "Saudi Arabia classifieds marketplace")}</p>
        </div>

        <nav aria-label={text("روابط الفوتر", "Footer links")}>
          {mobileLinks.map((link) => (
            <Link key={link.to} to={link.to as "/"}>
              {text(link.labelAr, link.labelEn)}
            </Link>
          ))}
        </nav>

        <p className="rawaj-site-footer__mobile-copy">
          © {year} {text("رواج", "RAWAJ")}
        </p>
      </div>

      <div className="rawaj-site-footer__desktop hidden lg:block">
        <div className="container-wide grid grid-cols-[minmax(16rem,1.45fr)_repeat(3,minmax(0,1fr))] gap-10 py-12">
          <div className="max-w-sm">
            <Link to="/" aria-label={text("رواج — الرئيسية", "RAWAJ — Home")}>
              <BrandLockup inverse />
            </Link>
            <p className="mt-5 text-sm leading-7 text-primary-foreground/70">
              {text(
                "سوق سعودي منظم للإعلانات المبوبة، صُمم ليجعل الاكتشاف والتواصل أكثر وضوحاً وأماناً.",
                "A focused Saudi classifieds marketplace built for clearer discovery and safer direct contact.",
              )}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary-foreground/15 bg-primary-foreground/5 px-3 py-2 text-xs font-bold text-primary-foreground/80">
              <ShieldCheck className="h-4 w-4 text-gold" aria-hidden="true" />
              {text("تصفح واعٍ وتواصل مباشر", "Thoughtful browsing, direct contact")}
            </span>
          </div>
          {groups.map((group) => (
            <div key={group.titleAr}>
              <h2 className="mb-4 text-sm font-extrabold text-primary-foreground">
                {text(group.titleAr, group.titleEn)}
              </h2>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to as "/"}
                      className="text-sm text-primary-foreground/65 transition-colors hover:text-primary-foreground"
                    >
                      {text(link.labelAr, link.labelEn)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-primary-foreground/10">
          <div className="container-wide flex flex-wrap items-center justify-between gap-3 py-5">
            <p className="text-xs text-primary-foreground/55">
              © {year}{" "}
              {text(
                "رَوَاج · سوق سعوديا المجاني للإعلانات",
                "RAWAJ · Saudi Arabia classifieds marketplace",
              )}
            </p>
            <span className="text-xs font-semibold text-primary-foreground/65">
              {text("السعودية فقط · تصفح آمن", "Saudi Arabia only · Safe browsing")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
