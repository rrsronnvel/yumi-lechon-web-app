import type { CapacityBlock, CapacityEvaluation, CapacityStatus } from "../hooks/useKitchenCapacity";

export const capacityTone: Record<CapacityStatus, string> = {
  Open: "border-emerald-200 bg-emerald-50 text-emerald-900",
  LastSlot: "border-amber-300 bg-amber-50 text-amber-950",
  Full: "border-rose-300 bg-rose-50 text-rose-950",
  Overbooked: "border-rose-400 bg-rose-100 text-rose-950",
};

export const capacityStatusText: Record<CapacityStatus, string> = {
  Open: "Open",
  LastSlot: "🔥 LAST 1 SLOT LEFT",
  Full: "🚫 FULL",
  Overbooked: "Overbooked",
};

export function getCapacityApproval(result: CapacityEvaluation | undefined, isOwner: boolean, approvalMatches: boolean) {
  const requiresOverride = result?.requiresOwnerOverride === true;
  const approved = requiresOverride && isOwner && approvalMatches;
  return { approved, blocked: requiresOverride && !approved };
}

export function formatCapacityTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;
  return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""} ${hours >= 12 ? "PM" : "AM"}`;
}

function localMinuteStamp(date: string, time: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(time) ? time.slice(0, 16) : `${date}T${time.slice(0, 5)}`;
}

export function getBatchSlotTimes(
  date: string,
  slot: Pick<CapacityBlock, "anchorTime">,
  targetTime: string,
  departureTime: string,
) {
  const nextDeparture = localMinuteStamp(date, slot.anchorTime);
  const target = Date.parse(`${targetTime}Z`);
  const departure = Date.parse(`${departureTime}Z`);
  const leadTime = Number.isFinite(target - departure) ? Math.max(0, target - departure) : 0;
  const nextTarget = new Date(Date.parse(`${nextDeparture}Z`) + leadTime).toISOString().slice(0, 16);
  return { targetTime: nextTarget, riderDepartureTime: nextDeparture };
}

export function toCapacityFormTime(date: string, time: string) {
  return localMinuteStamp(date, time);
}

export function getCapacityDepartureTime(target: string, departure: string | undefined | null, fulfillment: number) {
  if (fulfillment === 0) return target;
  if (departure && Number.isFinite(Date.parse(departure))) return departure;
  if (fulfillment !== 1) return target;
  const targetMinutes = Date.parse(`${target}Z`);
  return Number.isFinite(targetMinutes)
    ? new Date(targetMinutes - 60 * 60 * 1000).toISOString().slice(0, 16)
    : target;
}
