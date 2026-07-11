const SYRIA_COUNTRY_CODE = "963";

export type NormalizedContactPhone = {
  e164: string;
  digits: string;
};

export function normalizeContactPhone(value: string): NormalizedContactPhone | null {
  const ascii = toAsciiDigits(value).trim();
  if (!ascii) return null;

  let digits = ascii.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;

  const hasExplicitCountryCode = digits.startsWith("+");
  digits = digits.replace(/\D/g, "");

  if (!digits) return null;

  if (!hasExplicitCountryCode) {
    if (/^09\d{8}$/.test(digits)) {
      digits = `${SYRIA_COUNTRY_CODE}${digits.slice(1)}`;
    } else if (/^9\d{8}$/.test(digits)) {
      digits = `${SYRIA_COUNTRY_CODE}${digits}`;
    } else if (/^0\d{8,10}$/.test(digits)) {
      digits = `${SYRIA_COUNTRY_CODE}${digits.slice(1)}`;
    }
  }

  if (!/^\d{8,15}$/.test(digits)) return null;
  if (/^0/.test(digits)) return null;

  return { e164: `+${digits}`, digits };
}

export function phoneHref(value: string): string | null {
  const normalized = normalizeContactPhone(value);
  return normalized ? `tel:${normalized.e164}` : null;
}

export function whatsappHref(value: string): string | null {
  const normalized = normalizeContactPhone(value);
  return normalized ? `https://wa.me/${normalized.digits}` : null;
}

function toAsciiDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}
