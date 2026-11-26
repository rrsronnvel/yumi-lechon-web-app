export interface ManifestListItem {
  orderId?: number | null;
  id?: number | null;
  orderReference?: string | null;
  targetDeliveryTime?: string | null;
  targetDate?: string | null;
  eventDate?: string | null;
  isDateTbd?: boolean;
  isDraft?: boolean;
  paidAt?: string | null;
  paymentLogId?: number | null;
}

export const isTentativeEvent = (item: ManifestListItem): boolean =>
  Boolean(item.isDraft || item.isDateTbd);

const eventDate = (item: ManifestListItem) =>
  item.eventDate || item.targetDeliveryTime || item.targetDate;

const timestamp = (date: string | null | undefined, fallback: number) => {
  const time = date ? new Date(date).getTime() : NaN;
  return Number.isNaN(time) ? fallback : time;
};

export function sortManifestItemsByDateAscending<T extends ManifestListItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const aIsUnscheduled = isTentativeEvent(a) || !eventDate(a);
    const bIsUnscheduled = isTentativeEvent(b) || !eventDate(b);
    if (aIsUnscheduled !== bIsUnscheduled) return aIsUnscheduled ? 1 : -1;

    const aTimestamp = timestamp(eventDate(a), Number.POSITIVE_INFINITY);
    const bTimestamp = timestamp(eventDate(b), Number.POSITIVE_INFINITY);
    if (aTimestamp !== bTimestamp) return aTimestamp - bTimestamp;

    return timestamp(a.paidAt, 0) - timestamp(b.paidAt, 0)
      || (a.paymentLogId ?? 0) - (b.paymentLogId ?? 0)
      || (a.orderId ?? a.id ?? 0) - (b.orderId ?? b.id ?? 0);
  });
}
