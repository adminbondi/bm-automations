import { asString, firstLine, isRecord } from "./text";

const MAX_FIELD = 120;
const MAX_DETAIL = 200;
const MAX_KEYS = 12;

export type IngestDecision =
  | { kind: "alert"; text: string; source: string; event: string }
  | { kind: "reject"; status: number; reason: string };

/**
 * Accept a short JSON alert from another Worker (e.g. bm-automations).
 * Only ids/flags/reasons — callers must not send full PII dumps.
 */
export function ingestDecision(payload: unknown): IngestDecision {
  if (!isRecord(payload)) return { kind: "reject", status: 400, reason: "invalid_json" };
  const source = clip(asString(payload.source), MAX_FIELD);
  const event = clip(asString(payload.event), MAX_FIELD);
  if (!source || !event) return { kind: "reject", status: 400, reason: "source_and_event_required" };

  const lines = ["Automation alert.", "", `Source: ${source}`, `Event: ${event}`];
  let added = 0;
  for (const key of [
    "automationKey",
    "automationId",
    "clientId",
    "channel",
    "jobId",
    "detail",
    "reason",
  ] as const) {
    if (!(key in payload)) continue;
    const raw = payload[key];
    const value =
      typeof raw === "number" && Number.isFinite(raw)
        ? String(Math.trunc(raw))
        : clip(asString(raw), key === "detail" || key === "reason" ? MAX_DETAIL : MAX_FIELD);
    if (!value) continue;
    lines.push(`${label(key)}: ${value}`);
    added += 1;
    if (added >= MAX_KEYS) break;
  }

  return { kind: "alert", text: lines.join("\n"), source, event };
}

function label(key: string): string {
  switch (key) {
    case "automationKey":
      return "Automation";
    case "automationId":
      return "Automation id";
    case "clientId":
      return "Client";
    case "channel":
      return "Channel";
    case "jobId":
      return "Job";
    case "detail":
      return "Detail";
    case "reason":
      return "Reason";
    default:
      return key;
  }
}

function clip(value: string, max: number): string {
  return firstLine(value, max);
}

/** Timing-safe Bearer check. Empty expected rejects every request. */
export async function verifyBearerToken(header: string | null, expected: string): Promise<boolean> {
  const token = expected.trim();
  if (!token || !header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const got = match?.[1]?.trim() ?? "";
  if (!got) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(got)),
    crypto.subtle.digest("SHA-256", encoder.encode(token)),
  ]);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean;
  };
  if (typeof subtle.timingSafeEqual === "function") return subtle.timingSafeEqual(left, right);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
