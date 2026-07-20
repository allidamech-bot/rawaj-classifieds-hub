export type SypDenomination = "old" | "new";

/** Official redenomination standard: 100 old Syrian pounds equal 1 new Syrian pound. */
export const SYP_REDENOMINATION_FACTOR = 100;

export interface DualSypAmount {
  oldSyp: number;
  newSyp: number;
}

export function convertSypAmount(
  amount: number,
  from: SypDenomination,
  to: SypDenomination,
): number {
  assertValidSypAmount(amount);
  if (from === to) return amount;
  return from === "old"
    ? amount / SYP_REDENOMINATION_FACTOR
    : amount * SYP_REDENOMINATION_FACTOR;
}

export function toNewSyp(amount: number, denomination: SypDenomination): number {
  return convertSypAmount(amount, denomination, "new");
}

export function toOldSyp(amount: number, denomination: SypDenomination): number {
  return convertSypAmount(amount, denomination, "old");
}

export function createDualSypAmount(
  amount: number,
  denomination: SypDenomination,
): DualSypAmount {
  return {
    oldSyp: toOldSyp(amount, denomination),
    newSyp: toNewSyp(amount, denomination),
  };
}

function assertValidSypAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("SYP amount must be a finite non-negative number.");
  }
}
