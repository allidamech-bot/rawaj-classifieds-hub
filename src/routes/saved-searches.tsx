import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/saved-searches")({
  head: () => ({ meta: [{ title: "عمليات البحث المحفوظة | رَوَاج" }] }),
  component: () => (
    <>
      <PageHeader title="عمليات البحث المحفوظة" />
      <main className="container-wide pt-10">
        <div className="rounded-2xl bg-card p-10 text-center hairline">
          <span className="grid h-14 w-14 mx-auto place-items-center rounded-full bg-muted-surface">
            <Bookmark className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="mt-3 text-sm font-bold">لا توجد عمليات بحث محفوظة</p>
          <p className="mt-1 text-xs text-muted-foreground">احفظ بحثك ليصلك تنبيه عند توفر إعلان مشابه لاحقاً.</p>
          <Link to="/" className="mt-5 inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">
            ابدأ البحث
          </Link>
        </div>
      </main>
    </>
  ),
});
