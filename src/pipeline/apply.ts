import { delayOffsetMs, timingUnitOf } from "../automations/delay-units";
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
    await maybeWaitConfiguredDelay(plan);
    const result = plan.twilioCall ? await deliverSms(plan, options, plan.dedupeKey) : await deliverEmail(plan, options, plan.dedupeKey);
    if (options.jobId) {
      if (result === "deferred") {
        await options.repo.updateJob(options.jobId, {
          status: "pending",
          reason: "subscriber_missing",
          payload: options.payload ?? {},
          dueOn: options.todaySydney,
        });
        return;
      }
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
  const fireNow = plan.automation.timingKind === "immediate" || plan.automation.timingKind === "delay_duration";
  return !fireNow || plan.automation.skipRules.exactVisits != null;
}

/** Honours Delay UI short units (ms / seconds / minutes) before the first send attempt. */
async function maybeWaitConfiguredDelay(plan: GatedPlan): Promise<void> {
  if (plan.automation.timingKind !== "delay_duration") return;
  const amount = plan.automation.timingOffsetDays ?? 0;
  const ms = delayOffsetMs(amount, timingUnitOf(plan.automation));
  if (!ms || ms <= 0) return;
  log({
    event: "delay_wait",
    automationId: plan.automation.id,
    automationKey: plan.automation.key,
    waitMs: ms,
    unit: timingUnitOf(plan.automation),
    amount,
  });
  await sleep(ms);
}

type Delivery = "sent" | "blocked" | "deferred";

/** Sync dual-write often finishes 1–5s after the sale webhook hits automations. */
const SHARED_SYNC_SUBSCRIBER_RETRY_MS = [0, 1500, 3000] as const;

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
    : await findSubscriberWithRetry(options.listmonk, email);
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
    // Keep a same-day job so morning cron can finish the send after sync catches up.
    // hasSent only counts status=sent, so the skipped row does not block the retry.
    if (!plan.copy && options.contactWriteMode === "shared_sync") {
      if (options.jobId) {
        return "deferred";
      }
      await options.repo.enqueueJob({
        automationId: plan.automation.id,
        clientId: options.clientId,
        templateId: plan.templateId,
        dueOn: options.todaySydney,
        payload: options.payload ?? {},
        reason: "subscriber_missing",
      });
    }
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

async function findSubscriberWithRetry(
  listmonk: ListmonkClient,
  email: string,
): Promise<Awaited<ReturnType<ListmonkClient["findSubscriber"]>>> {
  for (let i = 0; i < SHARED_SYNC_SUBSCRIBER_RETRY_MS.length; i++) {
    const waitMs = SHARED_SYNC_SUBSCRIBER_RETRY_MS[i] ?? 0;
    if (waitMs > 0) await sleep(waitMs);
    const subscriber = await listmonk.findSubscriber(email);
    if (subscriber) {
      if (i > 0) {
        log({ event: "subscriber_retry_ok", attempt: i + 1, email });
      }
      return subscriber;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
