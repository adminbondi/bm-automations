export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** First line, capped, so a long commit body cannot flood the channel. */
export function firstLine(value: string, max = 300): string {
  const line = value.split(/\r?\n/, 1)[0]?.trim() ?? "";
  if (line.length <= max) return line;
  return `${line.slice(0, max)}...`;
}

export function orUnknown(value: string, fallback = "(unknown)"): string {
  return value || fallback;
}
