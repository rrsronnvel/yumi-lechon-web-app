const FLEXIBLE_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

export function normalizeDateInput(value: string): string {
  const trimmed = value.trim();
  const match = FLEXIBLE_DATE_PATTERN.exec(trimmed);
  if (!match) return trimmed;

  let year = Number(match[1]);
  if (year < 2025) {
    year = 2026;
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return trimmed;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeLocalDateTimeInput(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{1,2}-\d{1,2})(T.*)?$/.exec(trimmed);
  if (!match) return trimmed;

  return `${normalizeDateInput(match[1])}${match[2] ?? ""}`;
}

export function syncDatePart(dateTime: string, date: string): string {
  const normalizedDate = normalizeDateInput(date);
  const timePart = dateTime.trim().match(/T(.+)$/)?.[1];
  return timePart ? `${normalizedDate}T${timePart}` : normalizedDate;
}

export function getPhilippineDateString(date: Date | string = new Date()): string {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return normalizeDateInput(date);
  }
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

/**
 * Compares only the calendar-date portion of a delivery input against the
 * current Philippine calendar date. ISO YYYY-MM-DD strings are deliberately
 * compared as strings so the browser/runtime timezone cannot shift the day.
 */
export function isPastDeliveryDate(
  targetDateInput?: string | null,
  isDateTbd = false,
): boolean {
  if (isDateTbd || !targetDateInput) return false;
  const selectedDate = targetDateInput.trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (!selectedDate) return false;
  return selectedDate < getPhilippineDateString();
}

export function getCurrentPhilippineYear(): number {
  return Number(getPhilippineDateString().slice(0, 4));
}

/** Keeps the selected month, day, and optional time while replacing the year. */
export function replaceDeliveryDateYear(
  targetDateInput: string,
  year = getCurrentPhilippineYear(),
): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(targetDateInput)) return targetDateInput;
  return `${year}${targetDateInput.slice(4)}`;
}

/** Keeps the optional time while replacing the calendar date with today in PH. */
export function setDeliveryDateToPhilippineToday(targetDateInput: string): string {
  const timeSuffix = targetDateInput.match(/T.*$/)?.[0] ?? "";
  return `${getPhilippineDateString()}${timeSuffix}`;
}

/**
 * Moves a related schedule by the same number of calendar days as a target
 * date quick-fix. This preserves an independent clock and relative day offset
 * (for example, a Lalamove pickup scheduled the evening before an event).
 */
export function shiftRelatedScheduleWithTargetDate(
  relatedDateInput: string,
  previousTargetDateInput: string,
  nextTargetDateInput: string,
): string {
  const relatedMatch = relatedDateInput.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  const previousMatch = previousTargetDateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const nextMatch = nextTargetDateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!relatedMatch || !previousMatch || !nextMatch) return relatedDateInput;

  const toUtc = (match: RegExpMatchArray) =>
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const dayMs = 86_400_000;
  const deltaDays = Math.round((toUtc(nextMatch) - toUtc(previousMatch)) / dayMs);
  const shifted = new Date(toUtc(relatedMatch) + deltaDays * dayMs);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}${relatedMatch[4]}`;
}
