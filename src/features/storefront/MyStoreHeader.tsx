import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { NotificationTrigger } from "@/components/NotificationTrigger";
import { useUiPreferences } from "@/lib/ui-preferences";

/** A route-owned header: no inherited context-header colors or duplicate create action. */
export function MyStoreHeader() {
  const { text, toggleLanguage } = useUiPreferences();
  return (
    <header className="my-store-topbar">
      <Link to="/" className="my-store-brand" aria-label={text("رواج — الرئيسية", "RAWAJ — Home")}>
        <img src="/brand/rawaj-mark-transparent-192.png" alt="" />
        <span>RAWAJ</span>
      </Link>
      <div className="my-store-topbar-actions">
        <NotificationTrigger tone="light" />
        <details className="my-store-nav">
          <summary aria-label={text("قائمة التنقل", "Navigation menu")}>
            <Menu />
          </summary>
          <nav>
            <Link to="/">{text("الرئيسية", "Home")}</Link>
            <Link to="/categories">{text("الأقسام", "Categories")}</Link>
            <Link to="/profile">{text("حسابي", "My account")}</Link>
            <Link to="/more">{text("المزيد", "More")}</Link>
            <button onClick={toggleLanguage}>{text("English", "العربية")}</button>
          </nav>
        </details>
      </div>
    </header>
  );
}
