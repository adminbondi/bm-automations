import { isSydneySendHour, sydneyDate } from "../time";
import { log } from "../log";
import { resourcesToFetch } from "../mindbody/budget";
import { applyPlans } from "./apply";
import { planCron } from "./plan";
import { factsFromClient, loadRuntime, rememberClient, type AppDeps } from "./runtime";
import { loadClientSnapshot, warmClientProfiles } from "./snapshot";

export async function runScheduled(env: Env, deps: AppDeps): Promise<{ ran: boolean; processed: number }> {
  const loaded = await loadRuntime(env, deps);
  if (!isSydneySendHour(loaded.now, loaded.config.sydneySendHour)) {
    log({ event: "cron_skipped", reason: "outside_sydney_send_hour" });
    return { ran: false, processed: 0 };
  }
  const today = sydneyDate(loaded.now);
  const jobs = await loaded.repo.dueJobs(today);
  const automations = await loaded.repo.listAutomations();
  const byId = new Map(automations.map((automation) => [automation.id, automation]));
  const ready: { job: (typeof jobs)[number]; automation: NonNullable<ReturnType<typeof byId.get>> }[] = [];
  let processed = 0;
  for (const job of jobs) {
    const automation = byId.get(job.automationId);
    if (!automation) {
      await loaded.repo.updateJob(job.id, { status: "skipped", reason: "automation_missing" });
      continue;
    }
    if (!automation.enabled) {
      await loaded.repo.updateJob(job.id, { status: "pending", reason: "automation_disabled" });
      processed += 1;
      continue;
    }
    ready.push({ job, automation });
  }
  const profileIds: string[] = [];
  for (const item of ready) {
    const known = await loaded.repo.getClient(item.job.clientId);
    if (resourcesToFetch([item.automation], null, known ?? undefined).includes("profile")) profileIds.push(item.job.clientId);
  }
  await warmClientProfiles(loaded, deps, profileIds);
  for (const item of ready) {
    try {
      const known = await loaded.repo.getClient(item.job.clientId);
      const snapshot = await loadClientSnapshot({
        host: loaded,
        deps,
        clientId: item.job.clientId,
        event: null,
        automations: [item.automation],
        known: known ?? undefined,
      });
      const client = await rememberClient(loaded.repo, item.job.clientId, snapshot, null, loaded.now);
      const facts = await factsFromClient({
        loaded,
        client,
        snapshot,
        event: null,
        payload: item.job.payload,
        dueOn: item.job.dueOn,
        visitCrossingRecorded: item.job.payload.visitCrossing === true,
        windowAlreadyMatched: item.job.payload.windowAlreadyMatched === true,
        dryRun: loaded.config.dryRun,
      });
      const plans = planCron(item.automation, facts);
      await applyPlans(plans, {
        repo: loaded.repo,
        listmonk: loaded.listmonk,
        twilio: loaded.twilio,
        clientId: client.clientId,
        firstName: client.firstName,
        lastName: client.lastName,
        studioName: loaded.config.studioName,
        listmonkBaseUrl: loaded.connections.listmonkBaseUrl,
        todaySydney: today,
        contactWriteMode: loaded.config.contactWriteMode,
        devMode: loaded.config.devMode,
        emailAllowlist: loaded.config.emailAllowlist,
        jobId: item.job.id,
        payload: item.job.payload,
        appendReplyStop: loaded.connections.appendReplyStop,
      });
      processed += 1;
    } catch (error) {
      log({
        event: "cron_client_failed",
        jobId: item.job.id,
        clientId: item.job.clientId,
        message: error instanceof Error ? error.message : "upstream_failed",
      });
    }
  }
  log({ event: "cron_finished", processed, queued: jobs.length });
  return { ran: true, processed };
}
