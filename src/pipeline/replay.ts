import { dedupeKey, unsubscribeUrl, withUnsubscribe } from "../automations/gate";
import { timingSafeEqualString } from "../crypto-equal";
import { log } from "../log";
import { buildMerge } from "../merge/values";
import { sydneyDate } from "../time";
import type { AppDeps } from "./runtime";
import { loadRuntime } from "./runtime";

export type ReplaySkippedResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Resend an email that was skipped for subscriber_missing after sync dual-write caught up.
 * Auth: Authorization Bearer must match env.REPLAY_TOKEN (optional secret; unset = 404).
 */
export async function handleReplaySkipped(
  request: Request,
  env: Env,
  deps: AppDeps,
): Promise<ReplaySkippedResult> {
  const expected = env.REPLAY_TOKEN?.trim() ?? "";
  if (!expected) return { status: 404, body: { error: "not_found" } };
  const header = request.headers.get("Authorization") ?? "";
  const got = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!got || !(await timingSafeEqualString(got, expected))) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  let body: { clientId?: string; automationKey?: string };
  try {
    body = (await request.json()) as { clientId?: string; automationKey?: string };
  } catch {
    return { status: 400, body: { error: "invalid_json" } };
  }
  const clientId = body.clientId?.trim();
  const automationKey = (body.automationKey?.trim() || "bf-intro-moment-1");
  if (!clientId) return { status: 400, body: { error: "client_id_required" } };

  const loaded = await loadRuntime(env, deps);
  const automations = await loaded.repo.listAutomations();
  const automation = automations.find((row) => row.key === automationKey);
  if (!automation) return { status: 404, body: { error: "automation_missing" } };
  if (!automation.enabled) return { status: 409, body: { error: "automation_disabled" } };
  if (automation.channel !== "email" || automation.templateId == null) {
    return { status: 409, body: { error: "not_email_template" } };
  }

  const client = await loaded.repo.getClient(clientId);
  if (!client?.email) return { status: 404, body: { error: "client_missing" } };
  const email = client.email.trim().toLowerCase();
  const key = dedupeKey(automation.id, clientId);
  if (await loaded.repo.hasSent(key)) {
    return { status: 200, body: { ok: true, status: "already_sent", clientId, automationKey, email } };
  }

  const recent = await loaded.repo.listSendLog(20, automation.id);
  const skipped = recent.find(
    (row) => row.clientId === clientId && row.status === "skipped_no_subscriber" && row.dedupeKey === key,
  );
  if (!skipped) {
    return { status: 409, body: { error: "no_subscriber_missing_skip", clientId, automationKey } };
  }

  const subscriber = await loaded.listmonk.findSubscriber(email);
  if (!subscriber) {
    return { status: 409, body: { error: "subscriber_still_missing", clientId, email } };
  }
  if (loaded.listmonk.isSuppressed(subscriber)) {
    return { status: 409, body: { error: "suppressed", clientId, email } };
  }

  const bag = buildMerge({
    automation,
    firstName: client.firstName,
    lastName: client.lastName,
    email,
    studioName: loaded.config.studioName,
    todaySydney: sydneyDate(loaded.now),
    services: [],
    visits: [],
    clientId,
  });
  const data = withUnsubscribe(bag.data, unsubscribeUrl(loaded.connections.listmonkBaseUrl, subscriber.uuid));
  if (loaded.config.dryRun) {
    return { status: 200, body: { ok: true, status: "dry_run", clientId, automationKey, email, templateId: automation.templateId } };
  }
  await loaded.listmonk.sendTx({ email, templateId: automation.templateId, data });
  await loaded.repo.recordSend({
    dedupeKey: key,
    automationId: automation.id,
    clientId,
    channel: "email",
    templateId: automation.templateId,
    email,
    phone: null,
    status: "sent",
    detail: "replay_after_subscriber_missing",
  });
  log({
    event: "sent",
    channel: "email",
    automationId: automation.id,
    automationKey: automation.key,
    templateId: automation.templateId,
    replay: true,
    clientId,
  });
  return {
    status: 200,
    body: {
      ok: true,
      status: "sent",
      clientId,
      automationKey,
      email,
      templateId: automation.templateId,
    },
  };
}
