const FLEXIBLE_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

export function normalizeDateInput(value: string): string {
  const trimmed = value.trim();
  const match = FLEXIBLE_DATE_PATTERN.exec(trimmed);
  if (!match) return trimmed;

  const year = Number(match[1]);
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

  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
