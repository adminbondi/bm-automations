import { asString, firstLine, isRecord, orUnknown } from "./text";

export const FAILURE_CONCLUSIONS = ["failure", "cancelled", "timed_out"] as const;
export type FailureConclusion = (typeof FAILURE_CONCLUSIONS)[number];

const CONCLUSION_WORDS: Record<FailureConclusion, string> = {
  failure: "failed",
  cancelled: "was cancelled",
  timed_out: "timed out",
};

export type GithubDecision =
  | { kind: "ping" }
  | { kind: "ignore"; reason: string }
  | { kind: "alert"; text: string; repo: string; conclusion: FailureConclusion };

export function githubDecision(eventName: string, payload: unknown): GithubDecision {
  if (eventName === "ping") return { kind: "ping" };
  if (eventName !== "workflow_run") return { kind: "ignore", reason: "other-event" };
  if (!isRecord(payload)) return { kind: "ignore", reason: "malformed" };

  const action = asString(payload.action);
  if (action !== "completed") return { kind: "ignore", reason: "not-completed" };

  const run = isRecord(payload.workflow_run) ? payload.workflow_run : null;
  if (!run) return { kind: "ignore", reason: "missing-run" };

  const conclusion = asString(run.conclusion);
  if (!isFailureConclusion(conclusion)) return { kind: "ignore", reason: "not-a-failure" };

  const repository = isRecord(payload.repository) ? payload.repository : null;
  const repo = orUnknown(asString(repository?.full_name));
  const workflow = orUnknown(asString(run.name), "(unknown workflow)");
  const branch = orUnknown(asString(run.head_branch), "(unknown branch)");
  const commit = commitMessage(run);
  const actor = triggeredBy(payload, run);
  const runUrl = orUnknown(asString(run.html_url), "(no run link)");

  const text = [
    `GitHub Actions ${CONCLUSION_WORDS[conclusion]}.`,
    "",
    `Repo: ${repo}`,
    `Workflow: ${workflow}`,
    `Branch: ${branch}`,
    `Commit: ${commit}`,
    `Triggered by: ${actor}`,
    `Run: ${runUrl}`,
  ].join("\n");

  return { kind: "alert", text, repo, conclusion };
}

function isFailureConclusion(value: string): value is FailureConclusion {
  return (FAILURE_CONCLUSIONS as readonly string[]).includes(value);
}

function commitMessage(run: Record<string, unknown>): string {
  const head = isRecord(run.head_commit) ? run.head_commit : null;
  const fromCommit = head ? firstLine(asString(head.message)) : "";
  if (fromCommit) return fromCommit;
  const title = firstLine(asString(run.display_title));
  return title || "(no commit message)";
}

function triggeredBy(payload: Record<string, unknown>, run: Record<string, unknown>): string {
  const triggering = isRecord(run.triggering_actor) ? asString(run.triggering_actor.login) : "";
  if (triggering) return triggering;
  const actor = isRecord(run.actor) ? asString(run.actor.login) : "";
  if (actor) return actor;
  const sender = isRecord(payload.sender) ? asString(payload.sender.login) : "";
  return sender || "(unknown)";
}
