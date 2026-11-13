import { normalizeCalendarDate } from './similarityHelper';

const PHILIPPINE_TIME_ZONE = 'Asia/Manila';

const getPhilippineDateParts = (value: Date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    year: readPart('year'),
    month: readPart('month'),
    day: readPart('day'),
  };
};

export const getPhilippineTodayDate = (value: Date = new Date()): string => {
  const { year, month, day } = getPhilippineDateParts(value);
  return `${year}-${month}-${day}`;
};

export const getCurrentPhilippineYear = (value: Date = new Date()): number =>
  Number(getPhilippineDateParts(value).year);

export const getDeliveryDateYear = (targetDateInput?: string | null): number | null => {
  const normalized = normalizeCalendarDate(targetDateInput);
  return normalized ? Number(normalized.slice(0, 4)) : null;
};

export const isPastDeliveryDate = (
  targetDateInput?: string | null,
  isDateTbd = false,
): boolean => {
  if (isDateTbd) return false;
  const selectedDate = normalizeCalendarDate(targetDateInput);
  return Boolean(selectedDate && selectedDate < getPhilippineTodayDate());
};

export const fixDeliveryDateYear = (
  targetDateInput: string,
  year: number = getCurrentPhilippineYear(),
): string => {
  const normalized = normalizeCalendarDate(targetDateInput);
  if (!normalized) return targetDateInput;
  return `${year}${normalized.slice(4)}`;
};
