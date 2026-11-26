import type { RoastingScheduleItem } from "../hooks/useSchedules";

const orderKey = (item: RoastingScheduleItem) =>
  item.orderId ?? item.orderReference ?? item.id;

export const filterKitchenBranch = (items: RoastingScheduleItem[], branch?: string) =>
  branch ? items.filter((item) => (item.kitchenBranch || "CARMONA") === branch) : items;

export function countKitchenRoster(items: RoastingScheduleItem[]) {
  let heads = 0;
  for (const item of items) {
    if (item.isTimeTbd || !item.salangStartTime) continue;
    heads += item.isBelly ? item.quantity ?? 1 : 1;
  }
  return { heads, orders: new Set(items.map(orderKey)).size };
}

type RiderLine = { categoryName: string; quantity: number; weight?: string };
type RiderOrder = RoastingScheduleItem & { lines: RiderLine[]; wholeLechonQty: number };

export function groupRiderRoster(items: RoastingScheduleItem[]): RiderOrder[] {
  const groups = new Map<string | number, {
    order: RoastingScheduleItem;
    lines: Map<string | number, RiderLine>;
    wholeLechonQty: number;
  }>();

  for (const item of items) {
    const key = orderKey(item);
    const group = groups.get(key) ?? { order: item, lines: new Map(), wholeLechonQty: 0 };
    const name = item.size || item.categoryName || item.bookedSizeName || "Lechon";
    const lineKey = item.orderItemId ?? ((item.unitTotal ?? 1) > 1 ? name : item.id);
    if (!group.lines.has(lineKey)) {
      const quantity = Math.max(1, item.quantity ?? 1, item.unitTotal ?? 1);
      group.lines.set(lineKey, {
        categoryName: name,
        quantity,
        weight: item.weight,
      });
      if (Number(item.minimumWeightKg ?? item.minWeight ?? 0) > 0 && !item.isBelly && !/belly/i.test(name)) {
        group.wholeLechonQty += quantity;
      }
    }
    groups.set(key, group);
  }

  return [...groups.values()].map(({ order, lines, wholeLechonQty }) => ({ ...order, lines: [...lines.values()], wholeLechonQty }));
}
