import { extractBuildError } from "./build-logs";
import { asString, firstLine, isRecord, orUnknown } from "./text";

const NO_ERROR_LINE = "The build event did not include an error line.";
const NO_LOG_LINE = "The build log did not include a clear error line.";
const NO_WORKFLOW_ERROR = "The event did not include an error message.";

/** True for a failed (not cancelled, not successful) Workers Builds event. */
export function wantsBuildLogs(body: unknown): boolean {
  return buildKind(body) === "failed";
}

/**
 * Plain-text alert for a queue event, or null when the event is not a failure.
 * Success, started, and queued events return null.
 */
export function queueAlert(body: unknown, logs: string[]): string | null {
  const kind = buildKind(body);
  if (kind === "failed" || kind === "canceled") return formatBuild(body, kind, logs);
  if (isWorkflowError(body)) return formatWorkflow(body);
  return null;
}

function buildKind(body: unknown): "failed" | "canceled" | "other" {
  if (!isRecord(body)) return "other";
  const type = asString(body.type);
  if (!type.includes("workersBuilds") && !type.includes("build.")) return "other";
  const payload = isRecord(body.payload) ? body.payload : {};
  const outcome = asString(payload.buildOutcome).toLowerCase();
  const canceled =
    outcome === "canceled" ||
    outcome === "cancelled" ||
    type.includes("canceled") ||
    type.includes("cancelled");
  if (canceled) return "canceled";
  if (type.includes("build.failed") || outcome === "failure") return "failed";
  return "other";
}

function isWorkflowError(body: unknown): boolean {
  if (!isRecord(body)) return false;
  const type = asString(body.type);
  return type === "cf.workflows.workflow.instance.errored" || type.endsWith(".instance.errored");
}

function formatBuild(body: unknown, kind: "failed" | "canceled", logs: string[]): string {
  const record = isRecord(body) ? body : {};
  const source = isRecord(record.source) ? record.source : {};
  const payload = isRecord(record.payload) ? record.payload : {};
  const metadata = isRecord(record.metadata) ? record.metadata : {};
  const meta = isRecord(payload.buildTriggerMetadata) ? payload.buildTriggerMetadata : {};
  const worker = orUnknown(
    asString(source.workerName) || asString(meta.repoName),
    "(unknown worker)",
  );
  const branch = orUnknown(asString(meta.branch), "(unknown branch)");
  const commit = commitText(meta);
  const author = orUnknown(asString(meta.author));
  const error =
    kind === "canceled" ? "The build was cancelled." : errorLine(payload, logs);
  const buildUrl = dashboardUrl(metadata, payload, worker);
  const verb = kind === "canceled" ? "was cancelled" : "failed";
  return [
    `Workers Builds ${verb}.`,
    "",
    `Worker: ${worker}`,
    `Branch: ${branch}`,
    `Commit: ${commit}`,
    `Author: ${author}`,
    `Error: ${error}`,
    `Build: ${buildUrl}`,
  ].join("\n");
}

function errorLine(payload: Record<string, unknown>, logs: string[]): string {
  const fromLogs = extractBuildError(logs);
  if (fromLogs) return fromLogs;
  const direct = payload.error;
  if (typeof direct === "string" && direct.trim()) return firstLine(direct, 500);
  if (isRecord(direct) && asString(direct.message)) return firstLine(asString(direct.message), 500);
  if (asString(payload.errorMessage)) return firstLine(asString(payload.errorMessage), 500);
  return logs.length > 0 ? NO_LOG_LINE : NO_ERROR_LINE;
}

function commitText(meta: Record<string, unknown>): string {
  const hash = asString(meta.commitHash).slice(0, 7);
  const message = firstLine(asString(meta.commitMessage));
  if (hash && message) return `${hash} ${message}`;
  return hash || message || "(unknown)";
}

function dashboardUrl(
  metadata: Record<string, unknown>,
  payload: Record<string, unknown>,
  worker: string,
): string {
  const accountId = asString(metadata.accountId);
  const buildUuid = asString(payload.buildUuid);
  if (!accountId || !buildUuid || worker.startsWith("(")) return "(no build link)";
  return `https://dash.cloudflare.com/${accountId}/workers/services/view/${encodeURIComponent(worker)}/production/builds/${encodeURIComponent(buildUuid)}`;
}

function formatWorkflow(body: unknown): string {
  const record = isRecord(body) ? body : {};
  const source = isRecord(record.source) ? record.source : {};
  const payload = isRecord(record.payload) ? record.payload : {};
  const workflow = orUnknown(asString(source.workflowName), "(unknown workflow)");
  const instanceId = orUnknown(asString(payload.instanceId), "(unknown instance)");
  const error = workflowError(payload);
  return [
    "A Workflow instance errored.",
    "",
    `Workflow: ${workflow}`,
    `Instance: ${instanceId}`,
    `Error: ${error}`,
  ].join("\n");
}

function workflowError(payload: Record<string, unknown>): string {
  const direct = payload.error;
  if (typeof direct === "string" && direct.trim()) return firstLine(direct, 500);
  if (isRecord(direct) && asString(direct.message)) return firstLine(asString(direct.message), 500);
  if (asString(payload.message)) return firstLine(asString(payload.message), 500);
  return NO_WORKFLOW_ERROR;
}
