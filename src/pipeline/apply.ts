import { unsubscribeUrl, withUnsubscribe } from "../automations/gate";
import type { JobPayload } from "../automations/types";
import type { Repo } from "../db/repo";
import type { ListmonkClient } from "@balancemoves/contacts-core";
import { log } from "../log";
import { buildMerge, renderMerge } from "../merge/values";
import { withReplyStop } from "../sms";
import { mayWriteSubscriber, type ContactWriteMode } from "../sync/mode";
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
  contactWriteMode: ContactWriteMode;
  devMode: boolean;
  emailAllowlist: string[];
  jobId?: number;
  payload?: JobPayload;
  appendReplyStop?: boolean;
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
    const inserted = await options.repo.enqueueJob({
      automationId: plan.automation.id,
      clientId: options.clientId,
      templateId: plan.templateId,
      dueOn: plan.decision.dueOn,
      payload: options.payload ?? {},
    });
    if (inserted === "exists" && movesDueDate(plan.automation.timingKind)) {
      await options.repo.reschedulePending(plan.automation.id, options.clientId, plan.decision.dueOn);
    }
    return;
  }
  if (plan.outcome === "keep_pending") {
    const payload = options.payload ?? {};
    if (options.jobId) {
      await options.repo.updateJob(options.jobId, {
        status: "pending",
        reason: plan.reason,
        payload,
        ...(plan.decision.dueOn ? { dueOn: plan.decision.dueOn } : {}),
      });
    }
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
      const repeat = result === "sent" && plan.automation.skipRules.repeat === "yearly" && plan.decision.dueOn;
      await options.repo.updateJob(options.jobId, {
        status: repeat ? "pending" : result === "sent" || result === "blocked" ? (result === "sent" ? "sent" : "skipped") : "pending",
        reason: repeat ? "repeat_next_year" : result === "sent" ? "sent" : plan.reason,
        ...(repeat && plan.decision.dueOn ? { dueOn: plan.decision.dueOn } : {}),
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

function movesDueDate(kind: GatedPlan["automation"]["timingKind"]): boolean {
  return kind === "days_since_last_visit" || kind === "birthday_day" || kind === "birthday_month_start";
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
  const write = mayWriteSubscriber({
    mode: options.contactWriteMode,
    devMode: options.devMode,
    email,
    emailAllowlist: options.emailAllowlist,
  });
  if (options.contactWriteMode === "self" && !write) {
    const listed = options.emailAllowlist.includes(email.trim().toLowerCase());
    log({
      event: "contact_write_skipped",
      reason: listed ? "dev_mode_off" : "not_allowlisted",
      automationId: plan.automation.id,
      automationKey: plan.automation.key,
      email,
    });
  }
  const subscriber = write
    ? await options.listmonk.ensureSubscriber({
      email,
      name,
      ...(plan.copy ? {} : { attribs: plan.attribs }),
    })
    : await options.listmonk.findSubscriber(email);
  if (!subscriber) {
    log({
      event: "send_skipped",
      reason: "subscriber_missing",
      contactWriteMode: options.contactWriteMode,
      automationId: plan.automation.id,
      automationKey: plan.automation.key,
      email,
    });
    await options.repo.recordSend({
      dedupeKey: key,
      automationId: plan.automation.id,
      clientId: options.clientId,
      channel: "email",
      templateId: plan.templateId,
      email,
      phone: null,
      status: "skipped_no_subscriber",
      detail: "subscriber_missing",
    });
    return "blocked";
  }
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
  const data = withUnsubscribe(plan.data, unsubscribeUrl(options.listmonkBaseUrl, subscriber.uuid));
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
  const rendered = plan.renderedMessage ?? renderMerge(template, buildMerge({
    automation: plan.automation,
    firstName: options.firstName,
    lastName: options.lastName,
    email: plan.email,
    studioName: options.studioName,
    todaySydney: options.todaySydney,
    services: [],
    visits: [],
  }));
  const body = withReplyStop(rendered, options.appendReplyStop === true);
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
