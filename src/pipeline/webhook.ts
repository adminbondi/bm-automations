import { classifyUpstreamError, postAutomationAlert } from "../alerts";
import { timingSafeEqualString } from "../crypto-equal";
import { verifyMindbodySignature } from "../signature";
import { parseMindbodyEvent } from "../mindbody/events";
import { log } from "../log";
import { applyPlans } from "./apply";
import { planAutomations, type GatedPlan } from "./plan";
import { loadClientSnapshot } from "./snapshot";
import { eventPayload, factsFromClient, loadRuntime, rememberClient, type AppDeps, type Loaded } from "./runtime";

export type WebhookResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function handleWebhook(request: Request, env: Env, deps: AppDeps): Promise<WebhookResult> {
  const raw = await request.text();
  let loaded: Loaded;
  try {
    loaded = await loadRuntime(env, deps);
  } catch (error) {
    log({ event: "webhook_failed", message: error instanceof Error ? error.message : "runtime" });
    return { status: 500, body: { error: "upstream_failed" } };
  }
  const header = request.headers.get("X-Mindbody-Signature");
  const valid = await verifyMindbodySignature(raw, header, loaded.config.webhookSignatureKey);
  if (!valid) return { status: 401, body: { error: "invalid_signature" } };
  const readOnly = isDryRunHeader(request.headers.get("X-Dry-Run"));
  return runBody(raw, loaded, deps, readOnly);
}

export async function handleLeadWebhook(request: Request, env: Env, deps: AppDeps): Promise<WebhookResult> {
  let loaded: Loaded;
  try {
    loaded = await loadRuntime(env, deps);
  } catch (error) {
    log({ event: "lead_webhook_failed", message: error instanceof Error ? error.message : "runtime" });
    return { status: 500, body: { error: "upstream_failed" } };
  }
  if (!loaded.config.leadWebhookSecret) return { status: 401, body: { error: "lead_webhook_disabled" } };
  const header = request.headers.get("X-Lead-Token") ?? "";
  if (!(await timingSafeEqualString(header, loaded.config.leadWebhookSecret))) {
    return { status: 401, body: { error: "invalid_token" } };
  }
  return runBody(await request.text(), loaded, deps, isDryRunHeader(request.headers.get("X-Dry-Run")));
}

export async function previewBody(raw: string, env: Env, deps: AppDeps): Promise<WebhookResult> {
  const loaded = await loadRuntime(env, deps);
  return runBody(raw, loaded, deps, true);
}

async function runBody(raw: string, loaded: Loaded, deps: AppDeps, readOnly: boolean): Promise<WebhookResult> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }
  const event = parseMindbodyEvent(parsedJson);
  if (!event) return { status: 400, body: { error: "invalid_event" } };
  if (!readOnly && (await loaded.repo.seenMessage(event.messageId))) {
    return { status: 200, body: { duplicate: true } };
  }
  if (event.siteId !== null && String(event.siteId) !== loaded.config.siteId) {
    if (!readOnly) await loaded.repo.recordMessage(event.messageId, event.eventId);
    return { status: 200, body: { ignored: true, reason: "site_id" } };
  }
  if (!event.clientId) {
    if (!readOnly) await loaded.repo.recordMessage(event.messageId, event.eventId);
    return { status: 200, body: { ignored: true, reason: "no_client" } };
  }
  try {
    const automations = await loaded.repo.listAutomations();
    // Sale (and most non-client.*) payloads omit email/phone. Cron already passes
    // clients_seen into resourcesToFetch; webhooks must do the same or an enabled
    // email Moment forces a staff-token profile GET. When that token 403s, the
    // whole webhook 500s and never recordMessage — which is how clientSale.created
    // stopped landing after bf-intro-moment-1 was turned on (2026-11-09).
    const known = await loaded.repo.getClient(event.clientId);
    const snapshot = await loadClientSnapshot({
      host: loaded,
      deps,
      clientId: event.clientId,
      event,
      automations,
      known: known ?? undefined,
    });
    const client = await rememberClient(loaded.repo, event.clientId, snapshot, event, loaded.now, !readOnly);
    const dryRun = readOnly || loaded.config.dryRun;
    const facts = await factsFromClient({
      loaded,
      client,
      snapshot,
      event,
      payload: eventPayload(event),
      dueOn: null,
      visitCrossingRecorded: false,
      windowAlreadyMatched: false,
      dryRun,
    });
    const plans = planAutomations(automations, facts);
    if (!readOnly) {
      await applyPlans(plans, {
        repo: loaded.repo,
        listmonk: loaded.listmonk,
        twilio: loaded.twilio,
        clientId: client.clientId,
        firstName: client.firstName,
        lastName: client.lastName,
        studioName: loaded.config.studioName,
        listmonkBaseUrl: loaded.connections.listmonkBaseUrl,
        todaySydney: facts.todaySydney,
        contactWriteMode: loaded.config.contactWriteMode,
        devMode: loaded.config.devMode,
        emailAllowlist: loaded.config.emailAllowlist,
        payload: eventPayload(event),
        appendReplyStop: loaded.connections.appendReplyStop,
        alerts: loaded.alerts,
      });
      await loaded.repo.recordMessage(event.messageId, event.eventId);
    }
    return { status: 200, body: { ok: true, dryRun, plans: plans.map(publicPlan) } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream_failed";
    log({ event: "webhook_failed", message, messageId: event.messageId });
    const classified = classifyUpstreamError(message);
    // send_error / listmonk / twilio already alerted inside apply; avoid duplicates.
    if (classified.event === "mindbody_token" || classified.event === "upstream_failed") {
      await postAutomationAlert(loaded.alerts, {
        event: classified.event === "mindbody_token" ? "mindbody_token" : "webhook_failed",
        clientId: event.clientId ?? undefined,
        detail: classified.detail,
      });
    }
    return { status: 500, body: { error: "upstream_failed" } };
  }
}

function isDryRunHeader(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function publicPlan(plan: GatedPlan): Record<string, unknown> {
  return {
    automationId: plan.automation.id,
    key: plan.automation.key,
    channel: plan.channel,
    phase: plan.phase,
    outcome: plan.outcome,
    reason: plan.reason,
    terminal: plan.terminal,
    templateId: plan.templateId,
    renderedMessage: plan.renderedMessage,
    email: plan.email,
    phone: plan.phone,
    copy: plan.copy,
    warnings: plan.decision.warnings,
    data: plan.data,
    dueOn: plan.decision.dueOn ?? null,
  };
}
