import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Camera, Info, MapPin } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { categories, governorates } from "@/data/mockData";

export const Route = createFileRoute("/add-listing")({
  head: () => ({
    meta: [{ title: "أضف إعلاناً | رَوَاج" }],
  }),
  component: AddListingPage,
});

const steps = ["القسم", "الصور", "التفاصيل", "التواصل", "المعاينة"];

function AddListingPage() {
  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcat, setSubcat] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [priceType, setPriceType] = useState<"fixed" | "negotiable" | "contact" | "free" | "exchange">("fixed");
  const [gov, setGov] = useState("");
  const [district, setDistrict] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ message: true, phone: true, whatsapp: false });
  const [contactName, setContactName] = useState("");
  const [contactTime, setContactTime] = useState("any");

  const category = categories.find((c) => c.id === categoryId);
  const govObj = governorates.find((g) => g.nameAr === gov);

  // Quality score
  const score = [
    title.length >= 8,
    description.length >= 30,
    !!price || priceType !== "fixed",
    !!gov && !!district,
    !!categoryId,
  ].filter(Boolean).length * 20;

  return (
    <>
      <PageHeader title="أضف إعلاناً" />

      <main className="container-wide pt-4 pb-8">
        {/* Stepper */}
        <ol className="mb-5 flex items-center gap-2 overflow-x-auto pb-2">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s} className="flex items-center gap-2">
                <div className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  done ? "bg-emerald-trust text-emerald-trust-foreground" :
                  active ? "bg-primary text-primary-foreground" :
                  "bg-muted-surface text-muted-foreground"
                }`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                {i < steps.length - 1 && <span className="h-px w-6 bg-border" />}
              </li>
            );
          })}
        </ol>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            {step === 0 && (
              <Card title="اختر القسم">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategoryId(c.id)}
                      className={`rounded-xl p-3 text-start text-sm font-semibold transition ${
                        categoryId === c.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-card hairline hover:bg-muted-surface"
                      }`}
                    >
                      {c.nameAr}
                    </button>
                  ))}
                </div>
                {category && (
                  <>
                    <h3 className="mt-4 mb-2 text-xs font-bold text-muted-foreground">القسم الفرعي</h3>
                    <div className="flex flex-wrap gap-2">
                      {category.subcategories.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSubcat(s.nameAr)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            subcat === s.nameAr
                              ? "bg-gold text-gold-foreground"
                              : "bg-muted-surface text-foreground hover:bg-secondary"
                          }`}
                        >
                          {s.nameAr}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            )}

            {step === 1 && (
              <Card title="صور الإعلان">
                <div className="grid grid-cols-3 gap-2">
                  {[0,1,2,3,4,5].map((i) => (
                    <button key={i} disabled title="غير مفعّل" className="flex aspect-square flex-col items-center justify-center rounded-xl bg-muted-surface text-muted-foreground opacity-80 cursor-not-allowed">
                      <Camera className="h-6 w-6" />
                      <span className="mt-1 text-[10px]">إضافة</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  رفع الصور غير مفعّل حالياً — نموذج تجريبي. لاحقاً يمكنك إضافة من ٣ إلى ٨ صور بصيغ JPG / PNG / WebP.
                </p>
                <ul className="mt-2 space-y-1 text-[11px] text-foreground/80">
                  <li>• صور واضحة وإضاءة جيدة.</li>
                  <li>• زوايا متعددة للسلعة.</li>
                  <li>• لا تستخدم صوراً مضللة أو من الإنترنت.</li>
                </ul>
              </Card>
            )}

            {step === 2 && (
              <Card title="تفاصيل الإعلان">
                <Field label="عنوان الإعلان">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تويوتا كورولا 2018 بحالة ممتازة" className="input" />
                </Field>
                <Field label="الوصف">
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="اكتب وصفاً واضحاً ومفصّلاً." className="input resize-none" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="السعر">
                    <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="0" className="input" />
                  </Field>
                  <Field label="نوع السعر">
                    <select value={priceType} onChange={(e) => setPriceType(e.target.value as typeof priceType)} className="input">
                      <option value="fixed">ثابت</option>
                      <option value="negotiable">قابل للتفاوض</option>
                      <option value="contact">عند التواصل</option>
                      <option value="free">مجاناً</option>
                      <option value="exchange">للمبادلة</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="المحافظة">
                    <select value={gov} onChange={(e) => { setGov(e.target.value); setDistrict(""); }} className="input">
                      <option value="">اختر</option>
                      {governorates.map((g) => <option key={g.id} value={g.nameAr}>{g.nameAr}</option>)}
                    </select>
                  </Field>
                  <Field label="المنطقة">
                    <select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!govObj} className="input disabled:opacity-50">
                      <option value="">اختر</option>
                      {govObj?.districts.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="الحالة">
                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className="input">
                    <option value="">اختر</option>
                    <option value="new">جديد</option>
                    <option value="like-new">شبه جديد</option>
                    <option value="used">مستعمل</option>
                    <option value="for-parts">للقطع</option>
                  </select>
                </Field>
                {categoryId && (
                  <div className="rounded-xl bg-muted-surface p-3">
                    <h4 className="mb-2 text-[11px] font-bold text-muted-foreground">حقول خاصة بالقسم</h4>
                    <CategorySpecificFields categoryId={categoryId} extra={extra} setExtra={setExtra} />
                  </div>
                )}
                {(title.length < 4 || !gov || !district || (priceType === "fixed" && !price)) && (
                  <p className="mt-2 text-[11px] text-destructive">أكمل الحقول المطلوبة للمتابعة.</p>
                )}
              </Card>
            )}

            {step === 3 && (
              <Card title="طريقة التواصل">
                <Field label="اسم التواصل (يظهر في الإعلان)">
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="مثال: أبو محمد" className="input" />
                </Field>
                <p className="mb-2 text-xs text-muted-foreground">طرق التواصل المتاحة لاحقاً:</p>
                <div className="space-y-2">
                  {[
                    { k: "message", label: "رسائل داخل التطبيق", hint: "قريباً" },
                    { k: "phone", label: "اتصال هاتفي", hint: "يظهر بعد تفعيل الحساب" },
                    { k: "whatsapp", label: "واتساب", hint: "يظهر بعد تفعيل الحساب" },
                  ].map((o) => (
                    <label key={o.k} className="flex items-center justify-between rounded-xl bg-card p-3 hairline">
                      <div>
                        <div className="text-sm font-semibold">{o.label}</div>
                        <div className="text-[10px] text-muted-foreground">{o.hint}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={contact[o.k as keyof typeof contact]}
                        onChange={(e) => setContact((c) => ({ ...c, [o.k]: e.target.checked }))}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  ))}
                </div>
                <Field label="وقت التواصل المفضّل">
                  <select value={contactTime} onChange={(e) => setContactTime(e.target.value)} className="input mt-3">
                    <option value="any">أي وقت</option>
                    <option value="morning">صباحاً</option>
                    <option value="evening">مساءً</option>
                    <option value="agree">حسب الاتفاق</option>
                  </select>
                </Field>
                <p className="mt-2 rounded-xl bg-muted-surface p-2 text-[11px] text-muted-foreground">
                  لن تظهر بيانات التواصل إلا حسب الخيارات التي تختارها لاحقاً عند تفعيل النظام الحقيقي. لا تشارك معلومات حساسة داخل الإعلان.
                </p>
              </Card>
            )}

            {step === 4 && (
              <Card title="معاينة الإعلان">
                <div className="overflow-hidden rounded-xl hairline">
                  <PlaceholderArt type={category?.placeholder ?? "misc"} aspect="wide" />
                </div>
                <div className="mt-3 space-y-1">
                  <div className="text-xs text-muted-foreground">{category?.nameAr ?? "—"} · {subcat || "—"}</div>
                  <h3 className="text-lg font-extrabold">{title || "عنوان الإعلان"}</h3>
                  <div className="text-base font-bold">
                    {priceType === "free" ? "مجاناً" :
                     priceType === "contact" ? "السعر عند التواصل" :
                     priceType === "exchange" ? "للمبادلة" :
                     price ? `${Number(price).toLocaleString("ar-SY")} ل.س${priceType === "negotiable" ? " · قابل للتفاوض" : ""}` : "—"}
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {gov || "—"} {district && `· ${district}`}
                  </div>
                  <p className="pt-2 text-sm text-foreground/90">{description || "لا يوجد وصف بعد."}</p>
                </div>
                {Object.keys(extra).length > 0 && (
                  <div className="mt-3 rounded-xl bg-muted-surface p-3 text-xs">
                    <h4 className="mb-1 font-bold">تفاصيل إضافية</h4>
                    <dl className="grid grid-cols-2 gap-1">
                      {Object.entries(extra).filter(([,v]) => v).map(([k,v]) => (
                        <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>
                      ))}
                    </dl>
                  </div>
                )}
                <div className="mt-3 rounded-xl bg-card p-3 text-xs hairline">
                  <h4 className="mb-1 font-bold">التواصل</h4>
                  <p className="text-muted-foreground">
                    {contactName || "—"} · {[contact.message && "رسائل", contact.phone && "هاتف", contact.whatsapp && "واتساب"].filter(Boolean).join(" / ") || "—"}
                  </p>
                </div>
                <div className="mt-3 rounded-xl bg-emerald-trust/10 p-3 text-[11px] font-medium text-emerald-trust">
                  هذا النموذج للمعاينة فقط. سيتم تفعيل النشر الحقيقي لاحقاً. تذكير أمان: قابل المشتري في مكان عام وآمن.
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="rounded-xl bg-card px-5 py-2.5 text-sm font-bold hairline disabled:opacity-40"
              >
                السابق
              </button>
              {step < steps.length - 1 ? (
                <button
                  disabled={
                    (step === 0 && !categoryId) ||
                    (step === 2 && (title.length < 4 || !gov || !district))
                  }
                  onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  متابعة
                </button>
              ) : (
                <button
                  disabled
                  title="النشر سيُفعَّل لاحقاً"
                  className="cursor-not-allowed rounded-xl bg-emerald-trust/80 px-6 py-2.5 text-sm font-bold text-emerald-trust-foreground opacity-90"
                >
                  نشر الإعلان · يُفعَّل لاحقاً
                </button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-3">
            <Card title="جودة الإعلان">
              <div className="text-2xl font-extrabold text-foreground">{score}%</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted-surface">
                <div className="h-full bg-gold transition-all" style={{ width: `${score}%` }} />
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
                <ScoreItem ok={!!categoryId} label="القسم" />
                <ScoreItem ok={title.length >= 8} label="العنوان" />
                <ScoreItem ok={description.length >= 30} label="الوصف" />
                <ScoreItem ok={!!price || priceType !== "fixed"} label="السعر" />
                <ScoreItem ok={!!gov && !!district} label="الموقع" />
                <ScoreItem ok={false} label="الصور" />
              </ul>
            </Card>

            <Card title="نصائح">
              <ul className="space-y-2 text-xs text-foreground/80">
                <Tip>أضف صوراً واضحة من زوايا مختلفة.</Tip>
                <Tip>اختر القسم المناسب بدقة.</Tip>
                <Tip>اكتب سعراً واقعياً.</Tip>
                <Tip>لا تضف معلومات مضللة.</Tip>
              </ul>
            </Card>
          </aside>
        </div>
      </main>

      <style>{`.input{width:100%;border-radius:.75rem;background:var(--card);border:1px solid var(--border);padding:.625rem .75rem;font-size:.875rem;color:var(--foreground);outline:none}.input:focus{border-color:var(--ring)}`}</style>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 hairline shadow-soft">
      <h3 className="mb-3 text-sm font-extrabold text-foreground">{title}</h3>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
function ScoreItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`grid h-4 w-4 place-items-center rounded-full ${ok ? "bg-emerald-trust text-emerald-trust-foreground" : "bg-muted-surface text-muted-foreground"}`}>
        {ok && <Check className="h-3 w-3" />}
      </span>
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
      <span>{children}</span>
    </li>
  );
}
