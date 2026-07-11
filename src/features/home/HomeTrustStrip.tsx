import { Link } from "@tanstack/react-router";
import { ChevronRight, ShieldCheck } from "lucide-react";

export function HomeTrustStrip({ text }: { text: (ar: string, en: string) => string }) {
  return (
    <section className="rawaj-home-trust-strip" aria-label={text("نصائح الأمان", "Safety tips")}>
      <div className="rawaj-home-trust-strip__lead">
        <span>
          <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <div>
          <strong>{text("تعامل بأمان", "Trade safely")}</strong>
          <small>
            {text("خطوات بسيطة تحميك أثناء البيع والشراء.", "Simple steps protect every deal.")}
          </small>
        </div>
      </div>
      <div className="rawaj-home-trust-strip__tips">
        <span>{text("افحص السلعة قبل الدفع", "Inspect before paying")}</span>
        <span>{text("قابل البائع في مكان آمن", "Meet in a safe place")}</span>
        <span>{text("لا تحوّل المال قبل التحقق", "Verify before transferring money")}</span>
      </div>
      <Link to="/safety" className="rawaj-section-link">
        {text("دليل الأمان", "Safety guide")}
        <ChevronRight className="h-4 w-4 rtl:rotate-180" strokeWidth={1.9} />
      </Link>
    </section>
  );
}
