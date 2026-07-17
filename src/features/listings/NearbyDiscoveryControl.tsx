import { LocateFixed, LoaderCircle, X } from "lucide-react";
import type { NearbyRadiusKm } from "@/lib/nearby-location";
import type { NearbyDiscoveryError } from "./use-nearby-discovery";

const RADII: NearbyRadiusKm[] = [5, 10, 25, 50, 100];

export function NearbyDiscoveryControl({
  active,
  loading,
  error,
  radiusKm,
  resultCount,
  onActivate,
  onRadiusChange,
  onClear,
  text,
}: {
  active: boolean;
  loading: boolean;
  error: NearbyDiscoveryError;
  radiusKm: NearbyRadiusKm;
  resultCount: number;
  onActivate: () => void;
  onRadiusChange: (radius: NearbyRadiusKm) => void;
  onClear: () => void;
  text: (ar: string, en: string) => string;
}) {
  const errorMessage =
    error === "permission_denied"
      ? text("تم رفض إذن الموقع. يمكنك متابعة البحث حسب المحافظة يدويًا.", "Location permission was denied. You can keep using manual location filters.")
      : error === "timeout"
        ? text("استغرق تحديد الموقع وقتًا طويلًا. حاول مرة أخرى أو استخدم فلاتر الموقع.", "Location timed out. Try again or use manual location filters.")
        : error === "unsupported"
          ? text("تحديد الموقع غير متاح على هذا الجهاز. استخدم فلاتر الموقع اليدوية.", "Location is unavailable on this device. Use manual location filters.")
          : error
            ? text("تعذر تحميل الإعلانات القريبة الآن. حاول مرة أخرى.", "Nearby listings could not be loaded right now. Try again.")
            : null;

  return (
    <section className="mt-3 rounded-[1.2rem] border border-primary/15 bg-card/90 p-3 shadow-sm" aria-label={text("البحث القريب", "Nearby search")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <LocateFixed className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold">{text("إعلانات قريبة منك", "Listings near you")}</h2>
            <p className="text-[11px] text-muted-foreground">
              {active
                ? text(`${resultCount} إعلان ضمن ${radiusKm} كم تقريبًا`, `${resultCount} listings within about ${radiusKm} km`)
                : text("الموقع يُستخدم مؤقتًا ولا يتم حفظ إحداثياتك.", "Your location is used temporarily and is not saved.")}
            </p>
          </div>
        </div>

        {active ? (
          <button type="button" onClick={onClear} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-xs font-bold text-muted-foreground hover:bg-muted-surface">
            <X className="h-4 w-4" />
            {text("إلغاء القريب", "Clear nearby")}
          </button>
        ) : (
          <button type="button" onClick={onActivate} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-primary-foreground disabled:opacity-60">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {loading ? text("جارٍ تحديد موقعك", "Locating you") : text("قريب مني", "Near me")}
          </button>
        )}
      </div>

      {active ? (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={text("نصف قطر البحث", "Search radius")}>
          {RADII.map((radius) => (
            <button
              key={radius}
              type="button"
              aria-pressed={radiusKm === radius}
              onClick={() => onRadiusChange(radius)}
              disabled={loading}
              className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-bold transition ${radiusKm === radius ? "bg-gold text-gold-foreground" : "bg-muted-surface text-foreground"}`}
            >
              {radius} {text("كم", "km")}
            </button>
          ))}
          {loading ? <LoaderCircle className="my-auto h-4 w-4 shrink-0 animate-spin text-primary" /> : null}
        </div>
      ) : null}

      {errorMessage ? <p role="status" className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{errorMessage}</p> : null}
    </section>
  );
}
