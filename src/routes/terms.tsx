import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "شروط الاستخدام | رَوَاج" }] }),
  component: () => <Doc title="شروط الاستخدام" sections={sections} />,
});

const sections = [
  { h: "الاستخدام المقبول", p: "يلتزم المستخدمون باستخدام رَوَاج بطريقة قانونية ومسؤولة، والامتناع عن أي محتوى مسيء أو احتيالي." },
  { h: "مسؤولية المستخدم", p: "يتحمل المستخدم كامل المسؤولية عن محتوى إعلاناته وصحة المعلومات الواردة فيها." },
  { h: "الإعلانات الممنوعة", p: "يحظر نشر أي إعلانات تخالف القوانين المحلية، أو تروج لمنتجات ممنوعة. مراجعة قائمة الإعلانات الممنوعة في الصفحة المخصصة." },
  { h: "البلاغات والإزالة", p: "يحق لفريق رَوَاج إزالة أي إعلان مخالف بعد المراجعة، وإيقاف الحسابات المخالفة بشكل متكرر." },
  { h: "حدود مسؤولية رَوَاج", p: "رَوَاج منصة عرض إعلانات فقط، ولا يتحمل مسؤولية التعاملات بين المستخدمين أو جودة السلع والخدمات المعروضة." },
];

function Doc({ title, sections }: { title: string; sections: { h: string; p: string }[] }) {
  return (
    <>
      <PageHeader title={title} />
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
