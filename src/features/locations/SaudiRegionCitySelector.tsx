import type { ClassifiedGovernorate } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

export function SaudiRegionCitySelector({
  governorates,
  governorateId,
  districtAr,
  onChange,
  disabled = false,
}: {
  governorates: ClassifiedGovernorate[];
  governorateId: string;
  districtAr: string;
  onChange: (governorateId: string, districtAr: string) => void;
  disabled?: boolean;
}) {
  const { text } = useUiPreferences();
  const selectedGovernorate =
    governorates.find((governorate) => governorate.id === governorateId) ?? null;
  const cities = selectedGovernorate?.districtsAr ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-saudi-region-city-selector="true">
      <select
        value={governorateId}
        onChange={(event) => onChange(event.target.value, "")}
        disabled={disabled}
        aria-label={text("المنطقة", "Region")}
        data-saudi-region-select="true"
        className="input"
      >
        <option value="">{text("اختر المنطقة", "Choose region")}</option>
        {governorates.map((governorate) => (
          <option key={governorate.id} value={governorate.id}>
            {governorate.nameAr}
          </option>
        ))}
      </select>

      <select
        value={districtAr}
        onChange={(event) => onChange(governorateId, event.target.value)}
        disabled={disabled || !selectedGovernorate || cities.length === 0}
        aria-label={text("المدينة", "City")}
        data-saudi-city-select="true"
        className="input"
      >
        <option value="">
          {selectedGovernorate
            ? text("اختر المدينة", "Choose city")
            : text("اختر المنطقة أولاً", "Choose a region first")}
        </option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
    </div>
  );
}
