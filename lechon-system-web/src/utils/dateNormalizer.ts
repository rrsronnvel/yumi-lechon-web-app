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
