import type { PayrollCutoff, PayrollRange } from "@/hooks/usePayroll";
import { getPhilippineDateString } from "@/utils/dateNormalizer";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
export const money = (value: number) => peso.format(value);
export const payrollToday = getPhilippineDateString;

export function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function currentCutoff(): PayrollCutoff {
  const today = payrollToday();
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const startDate = shiftDate(today, -((weekday + 6) % 7));
  return { startDate, endDate: shiftDate(startDate, 6), cycleType: "Weekly" };
}

export function monthlyCutoff(date: string, half: "first" | "second"): PayrollCutoff {
  const month = date.slice(0, 7);
  const nextMonth = new Date(`${month}-01T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const endOfMonth = shiftDate(nextMonth.toISOString().slice(0, 10), -1);
  return { startDate: `${month}-${half === "first" ? "01" : "16"}`,
    endDate: half === "first" ? `${month}-15` : endOfMonth, cycleType: "SemiMonthly" };
}

export function localClock(value: string) {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}

export function validCutoff({ startDate, endDate }: PayrollRange) {
  return Boolean(startDate && endDate && startDate <= endDate &&
    Date.parse(endDate) - Date.parse(startDate) < 31 * 86_400_000);
}

export function displayDate(date: string, long = false) {
  return new Intl.DateTimeFormat("en-PH", {
    weekday: long ? "long" : "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function displayPeriod({ startDate, endDate }: PayrollRange) {
  const startYear = startDate.slice(0, 4);
  const endYear = endDate.slice(0, 4);
  const start = startYear === endYear ? displayDate(startDate) : `${displayDate(startDate)}, ${startYear}`;
  return `${start} – ${displayDate(endDate)}, ${endYear}`;
}

export function displayAuditDate(value: string) {
  // Audit timestamps are UTC. Attendance clocks are rendered directly from their wall time.
  const utc = /Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`;
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(utc));
}

export function validMoney(value: string) {
  return /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value) && Number.isFinite(Number(value));
}

export const validRoastCount = (value: string) => /^\d+$/.test(value) && Number(value) <= 2_147_483_647;
