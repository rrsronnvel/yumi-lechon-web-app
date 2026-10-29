export interface WalkInOrderLike {
  source?: string | null;
  customerName?: string | null;
  facebookName?: string | null;
}

export function isWalkInOrder(order: WalkInOrderLike): boolean {
  return (
    order.source?.trim().toLowerCase() === "walk-in" ||
    /\(\s*wi\s*\)/i.test(order.customerName ?? "") ||
    /\(\s*wi\s*\)/i.test(order.facebookName ?? "")
  );
}
