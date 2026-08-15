import { DAY_KEYS, type DayOfWeek } from "./types";

export function addDays(dateString: string, amount: number): string {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function dayForIndex(index: number): DayOfWeek {
  return DAY_KEYS[index] ?? "monday";
}

export function minutesFromTime(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return Number.NaN;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

export function hoursBetween(start: string, end: string): number {
  const difference = minutesFromTime(end) - minutesFromTime(start);
  return difference > 0 ? difference / 60 : 0;
}
