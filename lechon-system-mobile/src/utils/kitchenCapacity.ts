export type CapacityStatus = 'Open' | 'LastSlot' | 'Full' | 'Overbooked';

export interface CapacityTiming {
  targetTime: string;
  riderDepartureTime: string;
}

export interface CapacitySlot extends CapacityTiming {
  date: string;
  batchCode: string | null;
  label: string;
}

export interface CapacityEvaluation {
  branchCode: string;
  batchCode: string | null;
  currentPits: number;
  incomingPits: number;
  projectedPits: number;
  maxPits: number;
  remainingAfter: number;
  status: CapacityStatus;
  canFitWithOwnerSqueeze: boolean;
  squeezedProjectedPits: number;
  suggestedNextSlot: CapacitySlot | null;
  requiresOwnerOverride: boolean;
}

export const isKitchenDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const getKitchenTiming = (
  date: string,
  time: string | null,
  departure: string | null,
  fulfillment: number,
): CapacityTiming | null => {
  if (!isKitchenDate(date) || !time) return null;
  const targetTime = `${date}T${time}:00`;
  if (fulfillment === 0 || (!departure && fulfillment === 2)) {
    return { targetTime, riderDepartureTime: targetTime };
  }
  if (!departure) {
    const targetClock = new Date(`${targetTime}Z`);
    targetClock.setUTCHours(targetClock.getUTCHours() - 1);
    return { targetTime, riderDepartureTime: targetClock.toISOString().slice(0, 19) };
  }

  let departureDate = date;
  if (departure > time) {
    const previousDay = new Date(`${date}T00:00:00Z`);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    departureDate = previousDay.toISOString().slice(0, 10);
  }

  return { targetTime, riderDepartureTime: `${departureDate}T${departure}:00` };
};

export const isCapacityBlocked = (
  evaluation: CapacityEvaluation | undefined,
  isOwner: boolean,
  approved: boolean,
): boolean => Boolean(evaluation?.requiresOwnerOverride && !(isOwner && approved));

export function getCapacityMessage(evaluation: CapacityEvaluation, isOwner: boolean): string {
  const { projectedPits, maxPits, remainingAfter, status, requiresOwnerOverride } = evaluation;
  const used = `${projectedPits}/${maxPits} pits`;
  if (requiresOwnerOverride) {
    return isOwner
      ? `🚫 Batch/Slot Full (${used} projected)`
      : `🚫 Batch/Slot Full (${maxPits}/${maxPits} pits) — Pick another time or ask Owner`;
  }
  if (status === 'Full') return `🚫 FULL (${used})`;
  if (status === 'LastSlot') return `🔥 LAST 1 SLOT LEFT (${used})`;
  return `✅ ${used} used (${remainingAfter} left)`;
}

export function formatBatchAnchor(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 || 12}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''} ${hours >= 12 ? 'PM' : 'AM'}`;
}
