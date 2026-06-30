import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/chats")({
  head: () => ({ meta: [{ title: "التواصل | رواج" }] }),
  component: ChatsPage,
});

function ChatsPage() {
  const { text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("التواصل", "Contact")} />
      <main className="container-wide space-y-4 pt-4 pb-8">
        <section className="rounded-2xl bg-card p-5 text-center hairline">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface text-primary">
            <MessageCircle className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-base font-extrabold">
            {text("ابدأ من صفحة الإعلان", "Start from a listing page")}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
            {text(
              "طرق التواصل تظهر داخل الإعلان المعتمد فقط حسب الخيارات التي يضعها البائع. لا توجد محادثات محفوظة في هذه الواجهة.",
              "Contact methods appear only inside approved listings according to the seller's selected options. No conversations are stored in this interface.",
            )}
          </p>
          <Link
            to="/listings"
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            {text("تصفح الإعلانات", "Browse listings")}
          </Link>
        </section>

        <section className="flex items-start gap-3 rounded-2xl bg-warning/10 p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-xs leading-6">
            {text(
              "اتفق على المعاينة في مكان عام وآمن، ولا تحول أي مبلغ قبل التأكد من السلعة أو الخدمة.",
              "Agree to inspect in a safe public place, and do not transfer money before verifying the item or service.",
            )}
          </p>
        </section>
      </main>
    </>
  );
}
