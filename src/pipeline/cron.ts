import { isSydneySendHour, sydneyDate } from "../time";
import { log } from "../log";
import { applyPlans } from "./apply";
import { planCron } from "./plan";
import { factsFromClient, loadRuntime, rememberClient, takeSnapshot, type AppDeps } from "./runtime";

export async function runScheduled(env: Env, deps: AppDeps): Promise<{ ran: boolean; processed: number }> {
  const loaded = await loadRuntime(env, deps);
  if (!isSydneySendHour(loaded.now, loaded.config.sydneySendHour)) {
    log({ event: "cron_skipped", reason: "outside_sydney_send_hour" });
    return { ran: false, processed: 0 };
  }
  const today = sydneyDate(loaded.now);
  const jobs = await loaded.repo.dueJobs(today);
  let processed = 0;
  for (const job of jobs) {
    const automation = await loaded.repo.getAutomation(job.automationId);
    if (!automation) {
      await loaded.repo.updateJob(job.id, { status: "skipped", reason: "automation_missing" });
      continue;
    }
    try {
      const snapshot = await takeSnapshot(loaded, deps, job.clientId);
      const client = await rememberClient(loaded.repo, job.clientId, snapshot, null, loaded.now);
      const facts = await factsFromClient({
        loaded,
        client,
        snapshot,
        event: null,
        payload: job.payload,
        dueOn: job.dueOn,
        visitCrossingRecorded: job.payload.visitCrossing === true,
        windowAlreadyMatched: job.payload.windowAlreadyMatched === true,
        dryRun: loaded.config.dryRun,
      });
      const plans = planCron(automation, facts);
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
        jobId: job.id,
        payload: job.payload,
        appendReplyStop: loaded.connections.appendReplyStop,
      });
      processed += 1;
    } catch (error) {
      log({
        event: "cron_client_failed",
        jobId: job.id,
        clientId: job.clientId,
        message: error instanceof Error ? error.message : "upstream_failed",
      });
    }
  }
  log({ event: "cron_finished", processed, queued: jobs.length });
  return { ran: true, processed };
}
