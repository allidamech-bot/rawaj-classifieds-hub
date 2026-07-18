import type { Currency } from "@/types";

// Consistent Arabic price formatting (Arabic-Indic digits + ٬ thousands separator).
const nf = new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 2 });

const currencyLabels: Record<Currency, string> = {
  SYP: "ل.س جديدة",
  USD: "$",
  EUR: "€",
  SAR: "ر.س",
};

export function formatPrice(price: number, currency: Currency = "SYP") {
  if (!price && price !== 0) return "";
  return `${nf.format(price)} ${currencyLabels[currency]}`;
}

export function priceLabel(price: number, type: string, currency: Currency = "SYP") {
  switch (type) {
    case "free":
      return "مجاناً";
    case "contact":
      return "السعر عند التواصل";
    case "exchange":
      return "للمبادلة";
    case "negotiable":
      return price ? `${formatPrice(price, currency)} · قابل للتفاوض` : "السعر قابل للتفاوض";
    default:
      return price ? formatPrice(price, currency) : "السعر غير محدد";
  }
}

export function priceTypeLabel(type: string) {
  switch (type) {
    case "fixed":
      return "ثابت";
    case "negotiable":
      return "قابل للتفاوض";
    case "contact":
      return "عند التواصل";
    case "free":
      return "مجاناً";
    case "exchange":
      return "للمبادلة";
    default:
      return type;
  }
}
