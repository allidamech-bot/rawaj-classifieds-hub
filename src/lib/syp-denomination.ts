import {
  SYP_REDENOMINATION_FACTOR,
  createDualSypAmount,
  type DualSypAmount,
  type SypDenomination,
} from "@/lib/syp-redenomination";

export type SypPriceDenomination = SypDenomination | "unclassified";

export interface ClassifiedSypPrice extends DualSypAmount {
  sourceAmount: number;
  sourceDenomination: SypDenomination;
}

export function isSypPriceDenomination(value: unknown): value is SypPriceDenomination {
  return value === "old" || value === "new" || value === "unclassified";
}

export function isClassifiedSypDenomination(
  value: SypPriceDenomination | null | undefined,
): value is SypDenomination {
  return value === "old" || value === "new";
}

export function requiresSypDenomination(
  price: number | null | undefined,
  priceType: string,
  currency = "SYP",
): boolean {
  return (
    currency === "SYP" &&
    price !== null &&
    price !== undefined &&
    Number.isFinite(price) &&
    (priceType === "fixed" || priceType === "negotiable")
  );
}

export function normalizeSypPriceToNew(
  amount: number | null | undefined,
  denomination: SypPriceDenomination | null | undefined,
): number | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount < 0)
    return null;
  if (!isClassifiedSypDenomination(denomination)) return null;
  return denomination === "old" ? amount / SYP_REDENOMINATION_FACTOR : amount;
}

export function createClassifiedSypPrice(
  amount: number,
  denomination: SypPriceDenomination,
): ClassifiedSypPrice | null {
  if (!isClassifiedSypDenomination(denomination)) return null;
  return {
    sourceAmount: amount,
    sourceDenomination: denomination,
    ...createDualSypAmount(amount, denomination),
  };
}

export function denominationLabel(
  denomination: SypPriceDenomination,
  language: "ar" | "en",
): string {
  if (denomination === "old") return language === "ar" ? "ليرة سورية قديمة" : "Old Syrian pounds";
  if (denomination === "new") return language === "ar" ? "ليرة سورية جديدة" : "New Syrian pounds";
  return language === "ar" ? "الوحدة غير مصنّفة" : "Denomination unclassified";
}
