import type { TimingKind, TimingOffsetUnit } from "./types";

/** Inline wait cap for sub-day Delay (Workers should not hold a request longer). */
export const MAX_SHORT_DELAY_MS = 15 * 60 * 1000;

export const TIMING_OFFSET_UNITS = ["milliseconds", "seconds", "minutes", "days"] as const;

export const SHORT_TIMING_UNITS = ["milliseconds", "seconds", "minutes"] as const;

export function isTimingOffsetUnit(value: unknown): value is TimingOffsetUnit {
  return typeof value === "string" && (TIMING_OFFSET_UNITS as readonly string[]).includes(value);
}

export function isShortTimingUnit(unit: TimingOffsetUnit): boolean {
  return unit !== "days";
}

export function timingUnitOf(automation: { timingOffsetUnit?: TimingOffsetUnit | null }): TimingOffsetUnit {
  return automation.timingOffsetUnit ?? "days";
}

/** Convert a Delay amount + unit to milliseconds. Days are not converted (use calendar scheduling). */
export function delayOffsetMs(amount: number, unit: TimingOffsetUnit): number | null {
  if (!Number.isInteger(amount) || amount < 0) return null;
  if (unit === "days") return null;
  if (unit === "milliseconds") return amount;
  if (unit === "seconds") return amount * 1000;
  return amount * 60 * 1000;
}

export function shortDelayAllowed(kind: TimingKind, unit: TimingOffsetUnit): boolean {
  if (!isShortTimingUnit(unit)) return true;
  return kind === "delay_duration" || kind === "immediate";
}

export function validateShortDelay(amount: number, unit: TimingOffsetUnit): string | null {
  if (unit === "days") return null;
  const ms = delayOffsetMs(amount, unit);
  if (ms === null) return "invalid_offset";
  if (ms > MAX_SHORT_DELAY_MS) return "invalid_offset";
  return null;
}

export function unitLabel(unit: TimingOffsetUnit, amount: number): string {
  if (unit === "milliseconds") return amount === 1 ? "millisecond" : "milliseconds";
  if (unit === "seconds") return amount === 1 ? "second" : "seconds";
  if (unit === "minutes") return amount === 1 ? "minute" : "minutes";
  return amount === 1 ? "day" : "days";
}
