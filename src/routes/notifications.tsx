import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Bookmark, Heart, MessageCircle, ScrollText, Sparkles } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

const followUpLinks = [
  { to: "/chats", labelAr: "الرسائل", labelEn: "Messages", icon: MessageCircle },
  { to: "/profile/listings", labelAr: "إعلاناتي", labelEn: "My listings", icon: ScrollText },
  { to: "/favorites", labelAr: "المفضلة", labelEn: "Favorites", icon: Heart },
  { to: "/saved-searches", labelAr: "عمليات البحث المحفوظة", labelEn: "Saved searches", icon: Bookmark },
  { to: "/promotion", labelAr: "طلبات الترويج", labelEn: "Promotion requests", icon: Sparkles },
] as const;

function NotificationsPage() {
  const { text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("التنبيهات", "Notifications")} to="/more" />
      <main className="container-wide space-y-5 pt-4 pb-24">
        <section className="rounded-2xl bg-card p-6 text-center shadow-soft hairline">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-gold">
            <Bell className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-lg font-extrabold">
            {text("لا توجد تنبيهات جديدة حالياً", "No new notifications right now")}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
            {text(
              "يمكنك متابعة الرسائل والإعلانات والطلبات من الروابط السريعة أدناه. لا نعرض أعداداً أو إشعارات غير مدعومة ببيانات حقيقية.",
              "Use the quick links below to follow messages, listings, and requests. We do not show counts or alerts that are not backed by real data.",
            )}
          </p>
        </section>

        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">{text("متابعة سريعة", "Quick follow-up")}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {followUpLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl bg-muted-surface p-3 text-sm font-bold transition hover:bg-muted hairline"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-card text-primary hairline">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text(item.labelAr, item.labelEn)}
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
