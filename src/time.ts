export type SydneyParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function sydneyParts(date: Date): SydneyParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const raw = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  let hour = Number(raw("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(raw("year")),
    month: Number(raw("month")),
    day: Number(raw("day")),
    hour,
    minute: Number(raw("minute")),
  };
}

export function sydneyDate(date: Date): string {
  const parts = sydneyParts(date);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function isSydneySendHour(date: Date, hour: number): boolean {
  return sydneyParts(date).hour === hour;
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysUntil(today: string, later: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function sydneyDateFromInstant(value: string | null | undefined, fallback: Date): string {
  if (!value) return sydneyDate(fallback);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return sydneyDate(fallback);
  return sydneyDate(parsed);
}

export const DEFAULT_QUIET_START = "20:00";
export const DEFAULT_QUIET_END = "09:00";

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseClock(value: string): number | null {
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isQuietHours(date: Date, start: string, end: string): boolean {
  const startMin = parseClock(start);
  const endMin = parseClock(end);
  if (startMin === null || endMin === null || startMin === endMin) return false;
  const parts = sydneyParts(date);
  const minutes = parts.hour * 60 + parts.minute;
  if (startMin > endMin) return minutes >= startMin || minutes < endMin;
  return minutes >= startMin && minutes < endMin;
}
