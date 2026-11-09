import { log } from "./log";

/** Short ids/flags only — never email, phone, or full bodies. */
export type AutomationAlertFields = {
  event: string;
  automationKey?: string;
  automationId?: number;
  clientId?: string;
  channel?: string;
  jobId?: number;
  detail?: string;
  reason?: string;
};

export type AlertsConfig = {
  url: string;
  token: string;
  source: string;
  fetchImpl: typeof fetch;
};

export function alertsConfigFromEnv(
  env: Env,
  fetchImpl: typeof fetch,
): AlertsConfig | null {
  const url = (Reflect.get(env, "BM_ALERTS_URL") as string | undefined)?.trim() ?? "";
  const token = (Reflect.get(env, "BM_ALERTS_TOKEN") as string | undefined)?.trim() ?? "";
  if (!url || !token) return null;
  const source =
    (Reflect.get(env, "BM_ALERTS_SOURCE") as string | undefined)?.trim() ||
    (Reflect.get(env, "WORKER_NAME") as string | undefined)?.trim() ||
    "bm-automations";
  return { url: url.replace(/\/$/, ""), token, source, fetchImpl };
}

/**
 * POST a concise failure to bm-alerts `/alerts`.
 * No-ops when URL/token are unset. Never throws — alert transport must not break sends.
 */
export async function postAutomationAlert(
  config: AlertsConfig | null | undefined,
  fields: AutomationAlertFields,
): Promise<void> {
  if (!config) return;
  const event = fields.event.trim();
  if (!event) return;
  const body: Record<string, string | number> = {
    source: config.source,
    event,
  };
  if (fields.automationKey) body.automationKey = clip(fields.automationKey, 80);
  if (fields.automationId != null) body.automationId = fields.automationId;
  if (fields.clientId) body.clientId = clip(fields.clientId, 40);
  if (fields.channel) body.channel = clip(fields.channel, 20);
  if (fields.jobId != null) body.jobId = fields.jobId;
  if (fields.detail) body.detail = clip(fields.detail, 160);
  if (fields.reason) body.reason = clip(fields.reason, 80);

  try {
    const response = await config.fetchImpl(`${config.url}/alerts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      log({
        event: "alert_post_failed",
        status: response.status,
        alertEvent: event,
      });
    }
  } catch (error) {
    log({
      event: "alert_post_failed",
      alertEvent: event,
      message: error instanceof Error ? clip(error.message, 80) : "fetch_failed",
    });
  }
}

/** Map thrown upstream messages to a short alert event + detail (no PII). */
export function classifyUpstreamError(message: string): { event: string; detail: string } {
  const detail = clip(message.split(/\r?\n/, 1)[0] ?? "upstream_failed", 80);
  if (detail.startsWith("mindbody_token")) return { event: "mindbody_token", detail };
  if (detail.startsWith("listmonk_")) return { event: "listmonk_error", detail };
  if (detail.startsWith("twilio_")) return { event: "twilio_error", detail };
  return { event: "upstream_failed", detail };
}

function clip(value: string, max: number): string {
  const line = value.trim().split(/\r?\n/, 1)[0] ?? "";
  if (line.length <= max) return line;
  return `${line.slice(0, max)}...`;
}
