export function parseBooleanParam(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const lower = value.toLowerCase().trim();
  if (lower === "true" || lower === "1") return true;
  if (lower === "false" || lower === "0") return false;
  return undefined;
}
