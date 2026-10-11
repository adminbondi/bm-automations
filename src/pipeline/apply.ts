import { unsubscribeUrl, withUnsubscribe } from "../automations/gate";
import type { JobPayload } from "../automations/types";
import type { Repo } from "../db/repo";
import type { ListmonkClient } from "../listmonk/client";
import { log } from "../log";
import { renderSms } from "../sms";
import type { TwilioClient } from "../twilio/client";
import type { GatedPlan } from "./plan";

export type ApplyOptions = {
  repo: Repo;
  listmonk: ListmonkClient;
  twilio: TwilioClient;
  clientId: string;
  firstName: string | null;
  lastName: string | null;
  studioName: string;
  listmonkBaseUrl: string;
  todaySydney: string;
  jobId?: number;
  payload?: JobPayload;
};

export async function applyPlans(plans: GatedPlan[], options: ApplyOptions): Promise<void> {
  for (const plan of plans) await applyPlan(plan, options);
}

async function applyPlan(plan: GatedPlan, options: ApplyOptions): Promise<void> {
  if (plan.copy) {
    if (plan.reason === "dev_allowlist") {
      log({ event: "send_skipped", reason: "dev_allowlist", automationId: plan.automation.id, email: plan.email, copy: true });
    }
    if (plan.listmonkCall && plan.dedupeKey) await deliverEmail(plan, options, plan.dedupeKey);
    return;
  }
  if (plan.outcome === "schedule" && plan.decision.dueOn) {
    await options.repo.enqueueJob({
      automationId: plan.automation.id,
      clientId: options.clientId,
      templateId: plan.templateId,
      dueOn: plan.decision.dueOn,
      payload: options.payload ?? {},
    });
    return;
  }
  if (plan.outcome === "keep_pending") {
    const payload = options.payload ?? {};
    if (options.jobId) await options.repo.updateJob(options.jobId, { status: "pending", reason: plan.reason, payload });
    else {
      await options.repo.enqueueJob({
        automationId: plan.automation.id,
        clientId: options.clientId,
        templateId: plan.templateId,
        dueOn: plan.decision.dueOn ?? options.todaySydney,
        payload,
        reason: plan.reason,
      });
    }
    return;
  }
  if (plan.ruleAction === "skip") {
    if (options.jobId) await options.repo.updateJob(options.jobId, { status: "skipped", reason: plan.reason });
    return;
  }
  if (plan.ruleAction !== "send") return;

  if (plan.reason === "dev_allowlist") {
    log({
      event: "send_skipped",
      reason: "dev_allowlist",
      automationId: plan.automation.id,
      automationKey: plan.automation.key,
      channel: plan.channel,
      email: plan.email,
      phone: plan.phone,
    });
  }
  if (plan.reason === "quiet_hours") {
    log({
      event: "send_skipped",
      reason: "quiet_hours",
      automationId: plan.automation.id,
      automationKey: plan.automation.key,
      phone: plan.phone,
    });
  }

  if ((plan.listmonkCall || plan.twilioCall) && plan.dedupeKey) {
    const result = plan.twilioCall ? await deliverSms(plan, options, plan.dedupeKey) : await deliverEmail(plan, options, plan.dedupeKey);
    if (options.jobId) {
      await options.repo.updateJob(options.jobId, {
        status: result === "sent" || result === "blocked" ? (result === "sent" ? "sent" : "skipped") : "pending",
        reason: result === "sent" ? "sent" : plan.reason,
      });
    }
    return;
  }

  if (!plan.terminal && keepsJob(plan)) {
    const payload: JobPayload = {
      ...(options.payload ?? {}),
      visitCrossing: plan.automation.skipRules.exactVisits != null || options.payload?.visitCrossing === true,
      windowAlreadyMatched: true,
    };
    if (options.jobId) await options.repo.updateJob(options.jobId, { status: "pending", reason: plan.reason, payload });
    else {
      await options.repo.enqueueJob({
        automationId: plan.automation.id,
        clientId: options.clientId,
        templateId: plan.templateId,
        dueOn: options.todaySydney,
        payload,
        reason: plan.reason,
      });
    }
    return;
  }
  if (plan.terminal && options.jobId) await options.repo.updateJob(options.jobId, { status: "skipped", reason: plan.reason });
}

function keepsJob(plan: GatedPlan): boolean {
  return plan.automation.timingKind !== "immediate" || plan.automation.skipRules.exactVisits != null;
}

type Delivery = "sent" | "blocked";

async function deliverEmail(plan: GatedPlan, options: ApplyOptions, key: string): Promise<Delivery> {
  const email = plan.email;
  if (!email || plan.templateId === null) return "blocked";
  if (await options.repo.hasSent(key)) return "blocked";
  const name = [options.firstName, options.lastName].filter(Boolean).join(" ") || email;
  const subscriber = await options.listmonk.ensureSubscriber({ email, name });
  if (options.listmonk.isSuppressed(subscriber)) {
    await options.repo.recordSend({
      dedupeKey: key,
      automationId: plan.automation.id,
      clientId: options.clientId,
      channel: "email",
      templateId: plan.templateId,
      email,
      phone: null,
      status: "skipped_suppressed",
      detail: "listmonk blocklist or suppressed list",
    });
    return "blocked";
  }
  const data = withUnsubscribe(plan.decision.data, unsubscribeUrl(options.listmonkBaseUrl, subscriber.uuid));
  await options.listmonk.sendTx({ email, templateId: plan.templateId, data });
  await options.repo.recordSend({
    dedupeKey: key,
    automationId: plan.automation.id,
    clientId: options.clientId,
    channel: "email",
    templateId: plan.templateId,
    email,
    phone: null,
    status: "sent",
    detail: null,
  });
  log({ event: "sent", channel: "email", automationId: plan.automation.id, automationKey: plan.automation.key, templateId: plan.templateId });
  return "sent";
}

async function deliverSms(plan: GatedPlan, options: ApplyOptions, key: string): Promise<Delivery> {
  const phone = plan.phone;
  const template = plan.messageText;
  if (!phone || !template) return "blocked";
  if (await options.repo.hasSent(key)) return "blocked";
  const body = plan.renderedMessage ?? renderSms(template, options.firstName, options.studioName);
  await options.twilio.sendSms({ to: phone, body });
  await options.repo.recordSend({
    dedupeKey: key,
    automationId: plan.automation.id,
    clientId: options.clientId,
    channel: "sms",
    templateId: null,
    email: null,
    phone,
    status: "sent",
    detail: null,
  });
  log({ event: "sent", channel: "sms", automationId: plan.automation.id, automationKey: plan.automation.key });
  return "sent";
}
