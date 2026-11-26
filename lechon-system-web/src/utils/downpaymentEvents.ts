import type { DownpaymentTrackerItem } from "../hooks/useManifest";

export const getDownpaymentEventDate = (item: DownpaymentTrackerItem) =>
  item.eventDate ?? item.targetDeliveryTime;

export const getDownpaymentPaidAt = (item: DownpaymentTrackerItem) =>
  item.paidAt ?? item.createdAt;

export const isTentativeDownpayment = (item: DownpaymentTrackerItem) =>
  Boolean(item.isDraft || item.isDateTbd || !getDownpaymentEventDate(item));

function eventTimestamp(item: DownpaymentTrackerItem) {
  const timestamp = Date.parse(getDownpaymentEventDate(item) ?? "");
  return isTentativeDownpayment(item) || Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

export function compareDownpaymentsByEventDate(a: DownpaymentTrackerItem, b: DownpaymentTrackerItem) {
  const aTime = eventTimestamp(a);
  const bTime = eventTimestamp(b);
  if (aTime !== bTime) return aTime - bTime;

  const paidDifference = (Date.parse(getDownpaymentPaidAt(a) ?? "") || 0) -
    (Date.parse(getDownpaymentPaidAt(b) ?? "") || 0);
  return paidDifference || (a.paymentLogId ?? 0) - (b.paymentLogId ?? 0) || a.orderId - b.orderId;
}
