import { useEffect, useMemo, useState } from "react";

import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";
import {
  fetchVehicleMakes,
  fetchVehicleModelChildren,
  fetchVehicleModels,
  type PublishedLeafField,
  type PublishedLeafSchema,
  type VehicleGenerationMetadata,
  type VehicleMakeMetadata,
  type VehicleModelMetadata,
  type VehicleTrimMetadata,
} from "@/lib/api/taxonomy-metadata";
import {
  fieldLabel,
  resolveDynamicFieldStates,
  sanitizeDynamicListingValues,
  type DynamicListingValues,
} from "@/lib/dynamic-listing-fields";

interface DynamicListingFieldsProps {
  schema: PublishedLeafSchema;
  values: DynamicListingValues;
  onChange: (values: DynamicListingValues) => void;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
  errors: Record<string, string>;
  disabled?: boolean;
}

export function DynamicListingFields({
  schema,
  values,
  onChange,
  language,
  text,
  errors,
  disabled = false,
}: DynamicListingFieldsProps) {
  const [vehicleMakes, setVehicleMakes] = useState<VehicleMakeMetadata[]>([]);
  const [vehicleModels, setVehicleModels] = useState<VehicleModelMetadata[]>([]);
  const [vehicleGenerations, setVehicleGenerations] = useState<VehicleGenerationMetadata[]>([]);
  const [vehicleTrims, setVehicleTrims] = useState<VehicleTrimMetadata[]>([]);
  const [vehicleMetadataLoading, setVehicleMetadataLoading] = useState(false);
  const [vehicleMetadataError, setVehicleMetadataError] = useState<string | null>(null);

  const states = useMemo(
    () => resolveDynamicFieldStates(schema, values),
    [schema, values],
  );
  const visibleStates = useMemo(() => states.filter((state) => state.visible), [states]);
  const needsVehicleMakes = visibleStates.some(
    (state) => state.field.dataProviderKey === "vehicle_makes",
  );
  const vehicleMakeId = stringValue(values.vehicle_make);
  const vehicleModelId = stringValue(values.vehicle_model);
  const vehicleYear = integerValue(values.vehicle_year);

  useEffect(() => {
    const sanitized = sanitizeDynamicListingValues(schema, values);
    if (JSON.stringify(sanitized) !== JSON.stringify(values)) onChange(sanitized);
  }, [onChange, schema, values]);

  useEffect(() => {
    if (!needsVehicleMakes) {
      setVehicleMakes([]);
      return;
    }

    let active = true;
    setVehicleMetadataLoading(true);
    setVehicleMetadataError(null);
    void fetchVehicleMakes(null, 200).then((result) => {
      if (!active) return;
      setVehicleMetadataLoading(false);
      if (!result.ok) {
        setVehicleMetadataError(result.error.message);
        setVehicleMakes([]);
        return;
      }
      setVehicleMakes(result.data);
    });

    return () => {
      active = false;
    };
  }, [needsVehicleMakes]);

  useEffect(() => {
    if (!vehicleMakeId) {
      setVehicleModels([]);
      setVehicleGenerations([]);
      setVehicleTrims([]);
      return;
    }

    let active = true;
    setVehicleMetadataLoading(true);
    setVehicleMetadataError(null);
    void fetchVehicleModels(vehicleMakeId, { year: vehicleYear, limit: 300 }).then((result) => {
      if (!active) return;
      setVehicleMetadataLoading(false);
      if (!result.ok) {
        setVehicleMetadataError(result.error.message);
        setVehicleModels([]);
        return;
      }
      setVehicleModels(result.data);
    });

    return () => {
      active = false;
    };
  }, [vehicleMakeId, vehicleYear]);

  useEffect(() => {
    if (!vehicleModelId) {
      setVehicleGenerations([]);
      setVehicleTrims([]);
      return;
    }

    let active = true;
    setVehicleMetadataLoading(true);
    setVehicleMetadataError(null);
    void fetchVehicleModelChildren(vehicleModelId, vehicleYear).then((result) => {
      if (!active) return;
      setVehicleMetadataLoading(false);
      if (!result.ok) {
        setVehicleMetadataError(result.error.message);
        setVehicleGenerations([]);
        setVehicleTrims([]);
        return;
      }
      setVehicleGenerations(result.data.generations);
      setVehicleTrims(result.data.trims);
    });

    return () => {
      active = false;
    };
  }, [vehicleModelId, vehicleYear]);

  const groups = useMemo(() => {
    const result = new Map<string, typeof visibleStates>();
    for (const state of visibleStates) {
      const groupKey = state.field.groupKey || "details";
      const existing = result.get(groupKey) ?? [];
      existing.push(state);
      result.set(groupKey, existing);
    }
    return [...result.entries()];
  }, [visibleStates]);

  const patch = (fieldKey: string, value: unknown) => {
    const next = { ...values, [fieldKey]: value };
    if (fieldKey === "vehicle_make") {
      delete next.vehicle_model;
      delete next.vehicle_generation;
      delete next.vehicle_trim;
    } else if (fieldKey === "vehicle_model") {
      delete next.vehicle_generation;
      delete next.vehicle_trim;
    } else if (fieldKey === "vehicle_generation") {
      delete next.vehicle_trim;
    }
    onChange(next);
  };

  return (
    <div className="mt-4 space-y-4 rounded-[1.15rem] border border-border/60 bg-card-warm/65 p-3.5">
      <div>
        <h4 className="text-xs font-semibold text-primary">
          {text("تفاصيل خاصة بالتصنيف", "Category-specific details")}
        </h4>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          {text(
            "تتغير هذه الحقول تلقائياً بحسب التصنيف النهائي الذي اخترته.",
            "These fields update automatically for the final category you selected.",
          )}
        </p>
      </div>

      {vehicleMetadataError ? (
        <p className="rounded-xl border border-destructive/15 bg-destructive/8 p-3 text-xs text-destructive">
          {vehicleMetadataError}
        </p>
      ) : null}

      {groups.map(([groupKey, groupStates]) => (
        <section key={groupKey} className="space-y-3">
          {groups.length > 1 ? (
            <h5 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {groupLabel(groupKey, text)}
            </h5>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {groupStates.map((state) => (
              <DynamicField
                key={state.field.key}
                field={state.field}
                required={state.required}
                value={values[state.field.key]}
                onChange={(value) => patch(state.field.key, value)}
                language={language}
                text={text}
                error={errors[state.field.key]}
                disabled={disabled || vehicleMetadataLoading}
                vehicleMakes={vehicleMakes}
                vehicleModels={vehicleModels}
                vehicleGenerations={vehicleGenerations}
                vehicleTrims={vehicleTrims}
                vehicleMakeId={vehicleMakeId}
                vehicleModelId={vehicleModelId}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DynamicField({
  field,
  required,
  value,
  onChange,
  language,
  text,
  error,
  disabled,
  vehicleMakes,
  vehicleModels,
  vehicleGenerations,
  vehicleTrims,
  vehicleMakeId,
  vehicleModelId,
}: {
  field: PublishedLeafField;
  required: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
  error?: string;
  disabled: boolean;
  vehicleMakes: VehicleMakeMetadata[];
  vehicleModels: VehicleModelMetadata[];
  vehicleGenerations: VehicleGenerationMetadata[];
  vehicleTrims: VehicleTrimMetadata[];
  vehicleMakeId: string;
  vehicleModelId: string;
}) {
  const label = fieldLabel(field, language);
  const description = language === "en" ? field.descriptionEn : field.descriptionAr;
  const placeholder = language === "en" ? field.placeholderEn : field.placeholderAr;
  const fieldId = `dynamic-listing-field-${field.key}`;
  const common = {
    id: fieldId,
    disabled,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? `${fieldId}-error` : undefined,
    "data-first-invalid": Boolean(error),
  };

  return (
    <label className={field.fieldType === "textarea" ? "sm:col-span-2" : undefined}>
      <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-foreground">
        {label}
        {required ? <span className="text-destructive">*</span> : null}
        {field.unitKey ? (
          <span className="text-[10px] font-normal text-muted-foreground">({field.unitKey})</span>
        ) : null}
      </span>

      {renderInput({
        field,
        value,
        onChange,
        placeholder: placeholder || undefined,
        common,
        language,
        text,
        vehicleMakes,
        vehicleModels,
        vehicleGenerations,
        vehicleTrims,
        vehicleMakeId,
        vehicleModelId,
      })}

      {description ? <span className="mt-1 block text-[10px] text-muted-foreground">{description}</span> : null}
      {error ? (
        <span id={`${fieldId}-error`} className="mt-1 block text-[10px] font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function renderInput({
  field,
  value,
  onChange,
  placeholder,
  common,
  language,
  text,
  vehicleMakes,
  vehicleModels,
  vehicleGenerations,
  vehicleTrims,
  vehicleMakeId,
  vehicleModelId,
}: {
  field: PublishedLeafField;
  value: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
  common: {
    id: string;
    disabled: boolean;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
    "data-first-invalid": boolean;
  };
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
  vehicleMakes: VehicleMakeMetadata[];
  vehicleModels: VehicleModelMetadata[];
  vehicleGenerations: VehicleGenerationMetadata[];
  vehicleTrims: VehicleTrimMetadata[];
  vehicleMakeId: string;
  vehicleModelId: string;
}) {
  if (field.fieldType === "textarea") {
    return (
      <textarea
        {...common}
        rows={4}
        value={stringValue(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input resize-none"
      />
    );
  }

  if (["integer", "numeric", "year"].includes(field.fieldType)) {
    const minimum = numberValidation(field.validation, "minimum");
    const maximum = numberValidation(field.validation, "maximum");
    return (
      <input
        {...common}
        type="number"
        inputMode={field.fieldType === "numeric" ? "decimal" : "numeric"}
        step={field.fieldType === "numeric" ? "any" : "1"}
        min={minimum ?? undefined}
        max={maximum ?? undefined}
        value={stringValue(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input"
      />
    );
  }

  if (field.fieldType === "boolean") {
    return (
      <span className="flex min-h-11 items-center justify-between rounded-[0.9rem] border border-border/75 bg-card px-3.5">
        <span className="text-xs text-muted-foreground">
          {Boolean(value) ? text("نعم", "Yes") : text("لا", "No")}
        </span>
        <input
          {...common}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
      </span>
    );
  }

  if (field.fieldType === "date") {
    return (
      <input
        {...common}
        type="date"
        value={stringValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      />
    );
  }

  if (field.fieldType === "location") {
    return (
      <div aria-invalid={Boolean(common["aria-invalid"])}>
        <CanonicalLocationSelector
          value={stringValue(value)}
          onChange={(id) => onChange(id ?? "")}
        />
      </div>
    );
  }

  if (field.fieldType === "multi_select") {
    const selected = new Set(stringArray(value));
    return (
      <span className="grid grid-cols-1 gap-2 rounded-[0.9rem] border border-border/75 bg-card p-2.5 sm:grid-cols-2">
        {field.options.map((option) => {
          const checked = selected.has(option.key);
          return (
            <span key={option.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs">
              <input
                type="checkbox"
                disabled={common.disabled}
                checked={checked}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(option.key);
                  else next.delete(option.key);
                  onChange([...next]);
                }}
                className="h-4 w-4 accent-primary"
              />
              {language === "en" ? option.labelEn || option.labelAr : option.labelAr}
            </span>
          );
        })}
      </span>
    );
  }

  if (field.fieldType === "single_select") {
    return (
      <select
        {...common}
        value={stringValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      >
        <option value="">{placeholder || text("اختر قيمة", "Choose a value")}</option>
        {field.options.map((option) => (
          <option key={option.key} value={option.key}>
            {language === "en" ? option.labelEn || option.labelAr : option.labelAr}
          </option>
        ))}
      </select>
    );
  }

  if (field.fieldType === "reference") {
    const options = referenceOptions({
      providerKey: field.dataProviderKey,
      language,
      vehicleMakes,
      vehicleModels,
      vehicleGenerations,
      vehicleTrims,
    });
    const dependencyMissing =
      (field.dataProviderKey === "vehicle_models_by_make" && !vehicleMakeId) ||
      (["vehicle_generations_by_model", "vehicle_trims_by_model"].includes(
        field.dataProviderKey ?? "",
      ) && !vehicleModelId);

    return (
      <select
        {...common}
        disabled={common.disabled || dependencyMissing}
        value={stringValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="input"
      >
        <option value="">
          {dependencyMissing
            ? field.dataProviderKey === "vehicle_models_by_make"
              ? text("اختر الشركة أولاً", "Choose a make first")
              : text("اختر الموديل أولاً", "Choose a model first")
            : placeholder || text("اختر قيمة", "Choose a value")}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      {...common}
      type="text"
      value={stringValue(value)}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="input"
    />
  );
}

function referenceOptions({
  providerKey,
  language,
  vehicleMakes,
  vehicleModels,
  vehicleGenerations,
  vehicleTrims,
}: {
  providerKey: string | null;
  language: "ar" | "en";
  vehicleMakes: VehicleMakeMetadata[];
  vehicleModels: VehicleModelMetadata[];
  vehicleGenerations: VehicleGenerationMetadata[];
  vehicleTrims: VehicleTrimMetadata[];
}): { id: string; label: string }[] {
  if (providerKey === "vehicle_makes") {
    return vehicleMakes.map((item) => ({
      id: item.id,
      label: language === "en" ? item.nameEn : item.nameAr,
    }));
  }
  if (providerKey === "vehicle_models_by_make") {
    return vehicleModels.map((item) => ({
      id: item.id,
      label: language === "en" ? item.nameEn : item.nameAr,
    }));
  }
  if (providerKey === "vehicle_generations_by_model") {
    return vehicleGenerations.map((item) => ({
      id: item.id,
      label: language === "en" ? item.nameEn : item.nameAr,
    }));
  }
  if (providerKey === "vehicle_trims_by_model") {
    return vehicleTrims.map((item) => ({
      id: item.id,
      label: language === "en" ? item.nameEn : item.nameAr,
    }));
  }
  return [];
}

function groupLabel(groupKey: string, text: (ar: string, en: string) => string): string {
  const labels: Record<string, string> = {
    core: text("المعلومات الأساسية", "Core information"),
    details: text("التفاصيل", "Details"),
    specifications: text("المواصفات", "Specifications"),
    pricing: text("السعر", "Pricing"),
    location: text("الموقع", "Location"),
    contact: text("التواصل", "Contact"),
  };
  return labels[groupKey] ?? groupKey.replaceAll("_", " ");
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function integerValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function numberValidation(validation: Record<string, unknown>, key: string): number | null {
  const value = validation[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
