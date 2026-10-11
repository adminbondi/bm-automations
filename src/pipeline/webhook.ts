import { verifyMindbodySignature } from "../signature";
import { parseMindbodyEvent } from "../mindbody/events";
import { log } from "../log";
import { applyPlans } from "./apply";
import { planAutomations, type GatedPlan } from "./plan";
import { eventPayload, factsFromClient, loadRuntime, rememberClient, takeSnapshot, type AppDeps, type Loaded } from "./runtime";

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
    const snapshot = await takeSnapshot(loaded, deps, event.clientId);
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
    const automations = await loaded.repo.listAutomations();
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
        payload: eventPayload(event),
        appendReplyStop: loaded.connections.appendReplyStop,
      });
      await loaded.repo.recordMessage(event.messageId, event.eventId);
    }
    return { status: 200, body: { ok: true, dryRun, plans: plans.map(publicPlan) } };
  } catch (error) {
    log({ event: "webhook_failed", message: error instanceof Error ? error.message : "upstream_failed", messageId: event.messageId });
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
