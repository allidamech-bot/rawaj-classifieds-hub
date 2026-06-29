import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert, MapPin, AlertTriangle, MessageSquare, EyeOff, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/safety")({
  head: () => ({ meta: [{ title: "نصائح الأمان | رَوَاج" }] }),
  component: SafetyPage,
});

const tips = [
  { icon: ShieldAlert, text: "لا تحول المال قبل التأكد من السلعة." },
  { icon: MapPin, text: "قابل البائع في مكان آمن إن أمكن." },
  { icon: AlertTriangle, text: "احذر الأسعار غير الواقعية." },
  { icon: MessageSquare, text: "أبلغ عن الإعلانات المشبوهة فوراً." },
  { icon: EyeOff, text: "لا تشارك معلوماتك الحساسة مع الغرباء." },
  { icon: UserCheck, text: "تأكد من هوية البائع عند التعامل بمبالغ كبيرة." },
];

function SafetyPage() {
  return (
    <>
      <PageHeader title="نصائح الأمان" />
      <main className="container-wide pt-4 pb-8">
        <p className="mb-4 text-sm text-muted-foreground">
          سلامتك أولوية. اتّبع هذه الإرشادات للتعامل بأمان داخل رَوَاج.
        </p>
        <div className="space-y-2">
          {tips.map((t, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl bg-card p-4 hairline">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
                <t.icon className="h-5 w-5" />
              </span>
              <p className="pt-1.5 text-sm font-medium text-foreground">{t.text}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
