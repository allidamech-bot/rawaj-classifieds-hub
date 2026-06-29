import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "سياسة الخصوصية | رَوَاج" }] }),
  component: PrivacyPage,
});

const sections = [
  { h: "البيانات التي نجمعها", p: "نجمع المعلومات الضرورية لتشغيل الخدمة مثل الاسم وبيانات التواصل ومحتوى الإعلانات." },
  { h: "كيف نستخدم البيانات", p: "تستخدم البيانات لعرض الإعلانات، وتسهيل التواصل بين المستخدمين، وتحسين الخدمة وضمان الأمان." },
  { h: "ملفات الارتباط", p: "قد تستخدم منصة رَوَاج ملفات ارتباط بسيطة لحفظ تفضيلاتك وتحسين تجربتك." },
  { h: "حماية الحساب", p: "نتخذ إجراءات أمنية معقولة لحماية بياناتك، وننصحك بعدم مشاركة معلوماتك الحساسة مع الغرباء." },
  { h: "التواصل معنا", p: "يمكنك التواصل مع فريق رَوَاج عبر صفحة الدعم لأي استفسار يخص خصوصيتك." },
];

function PrivacyPage() {
  return (
    <>
      <PageHeader title="سياسة الخصوصية" />
      <main className="container-wide pt-4 pb-8">
        <div className="space-y-3">
          {sections.map((s, i) => (
            <section key={i} className="rounded-2xl bg-card p-4 hairline">
              <h2 className="mb-2 text-base font-extrabold text-foreground">{i + 1}. {s.h}</h2>
              <p className="text-sm leading-7 text-foreground/90">{s.p}</p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
