import { createFileRoute } from "@tanstack/react-router";
import { Ban } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/prohibited")({
  head: () => ({ meta: [{ title: "إعلانات ممنوعة | رَوَاج" }] }),
  component: ProhibitedPage,
});

const items = [
  "أسلحة وذخائر ومتفجرات",
  "مواد مخدرة",
  "أدوية مقيدة",
  "بضائع مسروقة",
  "وثائق مزورة",
  "محتوى جنسي",
  "خدمات غير قانونية",
  "أدوات اختراق أو تجسس",
  "مواد خطرة",
  "أي شيء مخالف للقانون",
];

function ProhibitedPage() {
  return (
    <>
      <PageHeader title="إعلانات ممنوعة" />
      <main className="container-wide pt-4 pb-8">
        <div className="mb-4 rounded-2xl bg-destructive/10 p-4 text-sm font-medium text-destructive hairline">
          الإعلانات التالية ممنوعة على رَوَاج وستتم إزالتها فوراً، مع إمكانية إيقاف الحساب.
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((t) => (
            <div key={t} className="flex items-center gap-3 rounded-xl bg-card p-3 hairline">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <Ban className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">{t}</span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
