import { BellRing, Flag, ShieldCheck } from "lucide-react";

interface ListingSafetyAndAlertProps {
  alertBusy: boolean;
  alertCreated: boolean;
  onCreateAlert: () => void;
  onReport: () => void;
  text: (ar: string, en: string) => string;
}

export function ListingSafetyAndAlert({
  alertBusy,
  alertCreated,
  onCreateAlert,
  onReport,
  text,
}: ListingSafetyAndAlertProps) {
  return (
    <section className="rawaj-detail-safety" aria-labelledby="rawaj-detail-safety-title">
      <div className="rawaj-detail-safety__heading">
        <span><ShieldCheck aria-hidden="true" /></span>
        <div>
          <h2 id="rawaj-detail-safety-title">{text("تواصل بأمان", "Contact safely")}</h2>
          <p>{text("رواج لا يتوسط في الدفع أو التسليم.", "RAWAJ does not mediate payment or delivery.")}</p>
        </div>
      </div>

      <ul>
        <li>{text("قابل البائع في مكان عام وآمن.", "Meet the seller in a safe public place.")}</li>
        <li>{text("افحص السلعة وتحقق من بياناتها قبل الدفع.", "Inspect the item and verify its details before paying.")}</li>
        <li>{text("لا ترسل عربونًا قبل التأكد من البائع والسلعة.", "Do not send a deposit before verifying the seller and item.")}</li>
      </ul>

      <div className="rawaj-detail-safety__actions">
        <button
          type="button"
          onClick={onCreateAlert}
          disabled={alertBusy || alertCreated}
          data-tone="alert"
        >
          <BellRing aria-hidden="true" />
          {alertCreated
            ? text("تم تفعيل التنبيه", "Alert enabled")
            : alertBusy
              ? text("جارٍ التفعيل", "Enabling")
              : text("نبّهني لنتائج السعر", "Alert me to price results")}
        </button>
        <button type="button" onClick={onReport} data-tone="report">
          <Flag aria-hidden="true" />
          {text("إبلاغ عن الإعلان", "Report listing")}
        </button>
      </div>
    </section>
  );
}
