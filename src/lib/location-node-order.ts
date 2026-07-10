export type LocationNodeOrderType =
  | "country"
  | "governorate"
  | "district"
  | "subdistrict"
  | "city"
  | "town"
  | "village"
  | "neighborhood"
  | "locality";

const LOCATION_TYPE_PRIORITY: Record<LocationNodeOrderType, number> = {
  country: 0,
  governorate: 1,
  district: 2,
  subdistrict: 3,
  city: 4,
  town: 5,
  village: 6,
  neighborhood: 7,
  locality: 8,
};

export function sortLocationNodesForDisplay<
  T extends { sortOrder: number; nodeType: LocationNodeOrderType; nameAr: string },
>(nodes: T[]): T[] {
  return [...nodes].sort((left, right) => {
    const orderDelta = left.sortOrder - right.sortOrder;
    if (orderDelta !== 0) return orderDelta;

    const typeDelta =
      LOCATION_TYPE_PRIORITY[left.nodeType] - LOCATION_TYPE_PRIORITY[right.nodeType];
    if (typeDelta !== 0) return typeDelta;

    return left.nameAr.localeCompare(right.nameAr, "ar");
  });
}
