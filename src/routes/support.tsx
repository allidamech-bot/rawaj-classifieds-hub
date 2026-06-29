import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "الدعم | رَوَاج" }] }),
  component: SupportPage,
});

const types = [
  "مشكلة في إعلان",
  "بلاغ عن مستخدم",
  "مشكلة تقنية",
  "اقتراح",
];

function SupportPage() {
  const [type, setType] = useState(types[0]);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <>
      <PageHeader title="الدعم" />
      <main className="container-wide pt-4 pb-8">
        <p className="mb-4 text-sm text-muted-foreground">فريق رَوَاج جاهز لمساعدتك. أرسل رسالتك وسنرد قريباً.</p>

        {sent ? (
          <div className="rounded-2xl bg-emerald-trust/10 p-6 text-center text-emerald-trust">
            <p className="font-bold">تم إرسال رسالتك (واجهة فقط).</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); setSent(true); }}
            className="space-y-4 rounded-2xl bg-card p-4 hairline"
          >
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">نوع المشكلة</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm">
                {types.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">رسالتك</label>
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={6}
                placeholder="اشرح المشكلة بالتفصيل…"
                className="w-full resize-none rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
              />
            </div>
            <button type="submit" className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">
              إرسال
            </button>
          </form>
        )}
      </main>
    </>
  );
}
