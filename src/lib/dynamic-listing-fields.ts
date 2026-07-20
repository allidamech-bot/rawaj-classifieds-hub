import type {
  PublishedLeafConditionalRule,
  PublishedLeafField,
  PublishedLeafSchema,
} from "@/lib/api/taxonomy-metadata";

export type DynamicListingValues = Record<string, unknown>;

export interface DynamicFieldState {
  field: PublishedLeafField;
  visible: boolean;
  required: boolean;
  clearWhenHidden: boolean;
}

export interface DynamicFieldValidationResult {
  fields: Record<string, string>;
  summary: string[];
  normalizedAttributes: Record<string, unknown>;
}

export function resolveDynamicFieldStates(
  schema: PublishedLeafSchema,
  values: DynamicListingValues,
): DynamicFieldState[] {
  return schema.fields
    .filter((field) => field.displaySurfaces.includes("listing_studio"))
    .map((field) => {
      const rules = schema.conditionalRules
        .filter((rule) => rule.targetFieldKey === field.key)
        .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));

      let visible = true;
      let required = field.required;
      let clearWhenHidden = false;

      for (const rule of rules) {
        if (!conditionalRuleMatches(rule, values)) continue;

        switch (rule.effect) {
          case "show":
            visible = true;
            break;
          case "hide":
            visible = false;
            break;
          case "require":
            required = true;
            break;
          case "optional":
            required = false;
            break;
          case "clear":
            visible = false;
            clearWhenHidden = true;
            break;
          default:
            break;
        }
      }

      return { field, visible, required, clearWhenHidden };
    });
}

export function sanitizeDynamicListingValues(
  schema: PublishedLeafSchema,
  values: DynamicListingValues,
): DynamicListingValues {
  const states = resolveDynamicFieldStates(schema, values);
  const allowedKeys = new Set(schema.fields.map((field) => field.key));
  const next: DynamicListingValues = {};

  for (const [key, value] of Object.entries(values)) {
    if (!allowedKeys.has(key)) continue;
    const state = states.find((item) => item.field.key === key);
    if (state?.clearWhenHidden || state?.visible === false) continue;
    if (isEmptyDynamicValue(value)) continue;
    next[key] = value;
  }

  return next;
}

export function normalizeDynamicAttributesForWrite(
  schema: PublishedLeafSchema,
  values: DynamicListingValues,
): Record<string, unknown> {
  const sanitized = sanitizeDynamicListingValues(schema, values);
  const result: Record<string, unknown> = {};

  for (const field of schema.fields) {
    if (!(field.key in sanitized)) continue;
    const rawValue = sanitized[field.key];

    switch (field.fieldType) {
      case "integer":
      case "year": {
        const numericValue = parseFiniteNumber(rawValue);
        if (numericValue !== null) result[field.key] = Math.trunc(numericValue);
        break;
      }
      case "numeric": {
        const numericValue = parseFiniteNumber(rawValue);
        if (numericValue !== null) result[field.key] = numericValue;
        break;
      }
      case "boolean":
        if (typeof rawValue === "boolean") result[field.key] = rawValue;
        break;
      case "multi_select": {
        const entries = Array.isArray(rawValue)
          ? rawValue.filter(
              (item): item is string => typeof item === "string" && item.trim() !== "",
            )
          : [];
        if (entries.length > 0) result[field.key] = [...new Set(entries)];
        break;
      }
      default: {
        const textValue = typeof rawValue === "string" ? rawValue.trim() : "";
        if (textValue) result[field.key] = textValue;
        break;
      }
    }
  }

  return result;
}

export function validateDynamicListingFields(
  schema: PublishedLeafSchema,
  values: DynamicListingValues,
  language: "ar" | "en",
): DynamicFieldValidationResult {
  const states = resolveDynamicFieldStates(schema, values);
  const fields: Record<string, string> = {};
  const summary: string[] = [];
  const normalizedAttributes = normalizeDynamicAttributesForWrite(schema, values);

  const addError = (key: string, message: string) => {
    if (fields[key]) return;
    fields[key] = message;
    summary.push(message);
  };

  for (const state of states) {
    if (!state.visible) continue;

    const field = state.field;
    const value = values[field.key];
    const label = fieldLabel(field, language);
    if (state.required && isEmptyDynamicValue(value)) {
      addError(field.key, language === "ar" ? `حقل «${label}» مطلوب.` : `“${label}” is required.`);
      continue;
    }

    if (isEmptyDynamicValue(value)) continue;

    const validation = mergedValidation(field);
    if (field.fieldType === "text" || field.fieldType === "textarea") {
      const textValue = typeof value === "string" ? value.trim() : "";
      if (!textValue) {
        addError(
          field.key,
          language === "ar" ? `قيمة «${label}» غير صالحة.` : `“${label}” is invalid.`,
        );
        continue;
      }

      const minimumLength = validationNumber(validation, "minLength");
      const maximumLength = validationNumber(validation, "maxLength");
      if (minimumLength !== null && textValue.length < minimumLength) {
        addError(
          field.key,
          language === "ar"
            ? `يجب أن يحتوي «${label}» على ${minimumLength} أحرف على الأقل.`
            : `“${label}” must contain at least ${minimumLength} characters.`,
        );
      } else if (maximumLength !== null && textValue.length > maximumLength) {
        addError(
          field.key,
          language === "ar"
            ? `يجب ألا يتجاوز «${label}» ${maximumLength} حرفًا.`
            : `“${label}” must not exceed ${maximumLength} characters.`,
        );
      }
      continue;
    }

    if (["integer", "numeric", "year"].includes(field.fieldType)) {
      const numericValue = parseFiniteNumber(value);
      if (numericValue === null) {
        addError(
          field.key,
          language === "ar"
            ? `أدخل رقمًا صالحًا في «${label}».`
            : `Enter a valid number for “${label}”.`,
        );
        continue;
      }

      if (
        (field.fieldType === "integer" || field.fieldType === "year") &&
        !Number.isInteger(numericValue)
      ) {
        addError(
          field.key,
          language === "ar"
            ? `أدخل رقمًا صحيحًا في «${label}».`
            : `Enter a whole number for “${label}”.`,
        );
        continue;
      }

      const minimum = validationNumber(validation, "minimum");
      const maximum = validationNumber(validation, "maximum");
      if (minimum !== null && numericValue < minimum) {
        addError(
          field.key,
          language === "ar"
            ? `قيمة «${label}» يجب ألا تقل عن ${minimum}.`
            : `“${label}” must be at least ${minimum}.`,
        );
      } else if (maximum !== null && numericValue > maximum) {
        addError(
          field.key,
          language === "ar"
            ? `قيمة «${label}» يجب ألا تتجاوز ${maximum}.`
            : `“${label}” must not exceed ${maximum}.`,
        );
      }
      continue;
    }

    if (field.fieldType === "boolean" && typeof value !== "boolean") {
      addError(
        field.key,
        language === "ar" ? `قيمة «${label}» غير صالحة.` : `“${label}” is invalid.`,
      );
      continue;
    }

    if (field.fieldType === "multi_select") {
      if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        addError(
          field.key,
          language === "ar"
            ? `اختيارات «${label}» غير صالحة.`
            : `“${label}” selections are invalid.`,
        );
      }
      continue;
    }

    const textValue = typeof value === "string" ? value.trim() : "";
    if (!textValue) {
      addError(
        field.key,
        language === "ar"
          ? `اختر قيمة صالحة في «${label}».`
          : `Choose a valid value for “${label}”.`,
      );
      continue;
    }

    if (field.options.length > 0 && !field.options.some((option) => option.key === textValue)) {
      addError(
        field.key,
        language === "ar"
          ? `اختيار «${label}» غير متاح.`
          : `The selected “${label}” value is unavailable.`,
      );
    }
  }

  return { fields, summary, normalizedAttributes };
}

export function dynamicFieldReviewRows(
  schema: PublishedLeafSchema,
  values: DynamicListingValues,
  language: "ar" | "en",
): [string, string][] {
  const states = resolveDynamicFieldStates(schema, values);

  return states.flatMap((state) => {
    if (!state.visible) return [];
    const value = values[state.field.key];
    if (isEmptyDynamicValue(value)) return [];

    const label = fieldLabel(state.field, language);
    const displayValue = dynamicFieldDisplayValue(state.field, value, language);
    return displayValue ? [[label, displayValue] as [string, string]] : [];
  });
}

export function fieldLabel(field: PublishedLeafField, language: "ar" | "en"): string {
  return language === "en" ? field.labelEn || field.labelAr : field.labelAr;
}

export function isEmptyDynamicValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function dynamicFieldDisplayValue(
  field: PublishedLeafField,
  value: unknown,
  language: "ar" | "en",
): string {
  if (typeof value === "boolean") {
    return value ? (language === "ar" ? "نعم" : "Yes") : language === "ar" ? "لا" : "No";
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => optionLabel(field, String(entry), language))
      .filter(Boolean)
      .join(language === "ar" ? "، " : ", ");
  }

  const textValue = String(value);
  const option = optionLabel(field, textValue, language);
  const unit = field.unitKey ? ` ${field.unitKey}` : "";
  return `${option}${unit}`.trim();
}

function optionLabel(field: PublishedLeafField, value: string, language: "ar" | "en"): string {
  const option = field.options.find((item) => item.key === value);
  if (!option) return value;
  return language === "en" ? option.labelEn || option.labelAr : option.labelAr;
}

function conditionalRuleMatches(
  rule: PublishedLeafConditionalRule,
  values: DynamicListingValues,
): boolean {
  const value = values[rule.triggerFieldKey];
  const triggerValues = Array.isArray(rule.triggerValue) ? rule.triggerValue : [rule.triggerValue];

  switch (rule.operator) {
    case "equals":
      return dynamicValuesEqual(value, rule.triggerValue);
    case "not_equals":
      return !dynamicValuesEqual(value, rule.triggerValue);
    case "in":
      return triggerValues.some((candidate) => dynamicValuesEqual(value, candidate));
    case "not_in":
      return !triggerValues.some((candidate) => dynamicValuesEqual(value, candidate));
    case "is_true":
      return value === true;
    case "is_false":
      return value === false;
    case "is_empty":
      return isEmptyDynamicValue(value);
    case "is_not_empty":
      return !isEmptyDynamicValue(value);
    default:
      return false;
  }
}

function dynamicValuesEqual(left: unknown, right: unknown): boolean {
  if (typeof left === "number" || typeof right === "number") {
    const leftNumber = parseFiniteNumber(left);
    const rightNumber = parseFiniteNumber(right);
    return leftNumber !== null && rightNumber !== null && leftNumber === rightNumber;
  }
  return left === right;
}

function mergedValidation(field: PublishedLeafField): Record<string, unknown> {
  return field.validation;
}

function validationNumber(validation: Record<string, unknown>, key: string): number | null {
  const value = validation[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
