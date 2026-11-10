import {
  classifyUpstreamError,
  postAutomationAlert,
  type AlertsConfig,
} from "../alerts";
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
  /** When set, actionable send failures post to bm-alerts. */
  alerts?: AlertsConfig | null;
  /** Test hook: replace wall-clock sleeps used by subscriber retry. */
  sleep?: (ms: number) => Promise<void>;
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
  await sleep(ms, undefined);
}

type Delivery = "sent" | "blocked" | "deferred";

/**
 * Shared-sync Listmonk lookup budget: ~3s total, first wait already helps (no zero-first).
 * Lookups at t≈1s / 2s / 3s after deliverEmail starts. Same-day cron job remains as backup.
 */
const SHARED_SYNC_SUBSCRIBER_RETRY_MS = [1000, 1000, 1000] as const;

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
  let subscriber: Awaited<ReturnType<ListmonkClient["findSubscriber"]>>;
  try {
    subscriber = write
      ? await options.listmonk.ensureSubscriber({
        email,
        name,
        ...(plan.copy ? {} : { attribs: plan.attribs }),
      })
      : await findSubscriberWithRetry(options.listmonk, email, options.sleep);
  } catch (error) {
    const message = error instanceof Error ? error.message : "listmonk_failed";
    const classified = classifyUpstreamError(message);
    await postAutomationAlert(options.alerts, {
      event: classified.event === "upstream_failed" ? "listmonk_error" : classified.event,
      automationKey: plan.automation.key,
      automationId: plan.automation.id,
      clientId: options.clientId,
      channel: "email",
      detail: classified.detail,
      jobId: options.jobId,
    });
    throw error;
  }
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
    await postAutomationAlert(options.alerts, {
      event: "subscriber_missing",
      automationKey: plan.automation.key,
      automationId: plan.automation.id,
      clientId: options.clientId,
      channel: "email",
      detail: "after_retries",
      jobId: options.jobId,
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
    // Marketing suppress (sync blocklist / suppressed list) must not block transactional Moments.
    // Hard blocks stay in D1 `suppressed` and are gated earlier via facts.suppressed.
    log({
      event: "tx_enable_for_transactional",
      automationId: plan.automation.id,
      automationKey: plan.automation.key,
      clientId: options.clientId,
      email,
      priorStatus: subscriber.status,
    });
    try {
      subscriber = await options.listmonk.enableForTransactional(subscriber);
    } catch (error) {
      const message = error instanceof Error ? error.message : "listmonk_enable_failed";
      await options.repo.recordSend({
        dedupeKey: key,
        automationId: plan.automation.id,
        clientId: options.clientId,
        channel: "email",
        templateId: plan.templateId,
        email,
        phone: null,
        status: "skipped_suppressed",
        detail: `listmonk enable_for_transactional failed: ${message}`,
      });
      return "blocked";
    }
  }
  const data = withUnsubscribe(plan.data, unsubscribeUrl(options.listmonkBaseUrl, subscriber.uuid));
  try {
    await options.listmonk.sendTx({ email, templateId: plan.templateId, data });
  } catch (error) {
    await recordSendFailure(plan, options, key, "email", error);
    throw error;
  }
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
  try {
    await options.twilio.sendSms({ to: phone, body });
  } catch (error) {
    await recordSendFailure(plan, options, key, "sms", error);
    throw error;
  }
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

async function recordSendFailure(
  plan: GatedPlan,
  options: ApplyOptions,
  key: string,
  channel: "email" | "sms",
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : "send_failed";
  const classified = classifyUpstreamError(message);
  await options.repo.recordSend({
    dedupeKey: key,
    automationId: plan.automation.id,
    clientId: options.clientId,
    channel,
    templateId: channel === "email" ? plan.templateId : null,
    email: channel === "email" ? plan.email : null,
    phone: channel === "sms" ? plan.phone : null,
    status: "failed",
    detail: classified.detail,
  });
  await postAutomationAlert(options.alerts, {
    event: classified.event === "upstream_failed" ? "send_error" : classified.event,
    automationKey: plan.automation.key,
    automationId: plan.automation.id,
    clientId: options.clientId,
    channel,
    detail: classified.detail,
    jobId: options.jobId,
  });
}

async function findSubscriberWithRetry(
  listmonk: ListmonkClient,
  email: string,
  sleepFn?: (ms: number) => Promise<void>,
): Promise<Awaited<ReturnType<ListmonkClient["findSubscriber"]>>> {
  for (let i = 0; i < SHARED_SYNC_SUBSCRIBER_RETRY_MS.length; i++) {
    const waitMs = SHARED_SYNC_SUBSCRIBER_RETRY_MS[i] ?? 0;
    if (waitMs > 0) await sleep(waitMs, sleepFn);
    const subscriber = await listmonk.findSubscriber(email);
    if (subscriber) {
      log({ event: "subscriber_retry_ok", attempt: i + 1, email, waitedMs: waitMs });
      return subscriber;
    }
  }
  return null;
}

function sleep(ms: number, sleepFn?: (ms: number) => Promise<void>): Promise<void> {
  if (sleepFn) return sleepFn(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
}
