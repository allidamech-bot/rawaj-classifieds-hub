export function formatPrice(price: number, currency: "SYP" | "USD" = "SYP") {
  if (!price) return "";
  const formatted = new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 0 }).format(price);
  return `${formatted} ${currency === "SYP" ? "ل.س" : "$"}`;
}

export function priceLabel(price: number, type: string, currency: "SYP" | "USD" = "SYP") {
  switch (type) {
    case "free":
      return "مجاناً";
    case "contact":
      return "السعر عند التواصل";
    case "exchange":
      return "للمبادلة";
    case "negotiable":
      return `${formatPrice(price, currency)} · قابل للتفاوض`;
    default:
      return formatPrice(price, currency);
  }
}
