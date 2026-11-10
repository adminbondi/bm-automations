import { describe, expect, it, vi } from "vitest";
import { alertsConfigFromEnv, classifyUpstreamError, postAutomationAlert } from "../src/alerts";

describe("alerts client", () => {
  it("classifies mindbody / listmonk / twilio errors", () => {
    expect(classifyUpstreamError("mindbody_token_401")).toEqual({
      event: "mindbody_token",
      detail: "mindbody_token_401",
    });
    expect(classifyUpstreamError("listmonk_tx_500")).toEqual({
      event: "listmonk_error",
      detail: "listmonk_tx_500",
    });
    expect(classifyUpstreamError("twilio_21614")).toEqual({
      event: "twilio_error",
      detail: "twilio_21614",
    });
  });

  it("no-ops when URL or token is missing", async () => {
    const fetchImpl = vi.fn();
    expect(alertsConfigFromEnv({} as Env, fetchImpl)).toBeNull();
    await postAutomationAlert(null, { event: "subscriber_missing" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts a short JSON body to /alerts", async () => {
    const fetchImpl = vi.fn(async () => new Response("ok\n", { status: 200 }));
    const config = {
      url: "https://bm-alerts.example",
      token: "secret",
      source: "bm-automations-dev",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    };
    await postAutomationAlert(config, {
      event: "subscriber_missing",
      automationKey: "bf-intro-moment-1",
      clientId: "100025122",
      channel: "email",
      detail: "after_retries",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://bm-alerts.example/alerts");
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(JSON.parse(String(init.body))).toEqual({
      source: "bm-automations-dev",
      event: "subscriber_missing",
      automationKey: "bf-intro-moment-1",
      clientId: "100025122",
      channel: "email",
      detail: "after_retries",
    });
  });
});
