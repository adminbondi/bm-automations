import { describe, expect, it } from "vitest";
import { extractBuildError } from "../src/build-logs";
import { queueAlert, wantsBuildLogs } from "../src/events";

const account = "a1e049769abbd70837e055ac5a0f9c7b";

function build(type: string, outcome: string | null, extra: Record<string, unknown> = {}) {
  return {
    type,
    source: { type: "workersBuilds.worker", workerName: "bm-short-links" },
    payload: {
      buildUuid: "build-123",
      buildOutcome: outcome,
      buildTriggerMetadata: {
        branch: "main",
        commitHash: "abc123def456",
        commitMessage: "Fix bug in authentication\nsecond line",
        author: "developer@example.com",
      },
      ...extra,
    },
    metadata: { accountId: account },
  };
}

describe("queue events", () => {
  it("describes a failed build and skips success", () => {
    const failed = build("cf.workersBuilds.worker.build.failed", "failure");
    expect(wantsBuildLogs(failed)).toBe(true);
    const text = queueAlert(failed, ["✘ [ERROR] Missing token", "    at build.js:1"]);
    expect(text).toContain("Workers Builds failed.");
    expect(text).toContain("Worker: bm-short-links");
    expect(text).toContain("Branch: main");
    expect(text).toContain("Commit: abc123d Fix bug in authentication");
    expect(text).toContain("Author: developer@example.com");
    expect(text).toContain("Error: ✘ [ERROR] Missing token");
    expect(text).toContain(`/workers/services/view/bm-short-links/production/builds/build-123`);
    expect(queueAlert(build("cf.workersBuilds.worker.build.succeeded", "success"), [])).toBeNull();
    expect(queueAlert(build("cf.workersBuilds.worker.build.started", null), [])).toBeNull();
  });

  it("treats canceled spellings as cancellation and does not call them failures", () => {
    const text = queueAlert(build("cf.workersBuilds.worker.build.canceled", "canceled"), []);
    expect(text).toContain("Workers Builds was cancelled.");
    expect(text).toContain("Error: The build was cancelled.");
    expect(wantsBuildLogs(build("cf.workersBuilds.worker.build.failed", "cancelled"))).toBe(false);
    expect(queueAlert(build("cf.workersBuilds.worker.build.failed", "cancelled"), [])).toContain(
      "was cancelled",
    );
  });

  it("says when the event has no error line", () => {
    const text = queueAlert(build("cf.workersBuilds.worker.build.failed", "failure"), []);
    expect(text).toContain("Error: The build event did not include an error line.");
  });

  it("uses an error field on the payload when the log is empty", () => {
    const text = queueAlert(
      build("cf.workersBuilds.worker.build.failed", "failure", {
        error: { message: "wrangler deploy failed" },
      }),
      [],
    );
    expect(text).toContain("Error: wrangler deploy failed");
  });

  it("alerts only when a Workflow instance errored", () => {
    const text = queueAlert(
      {
        type: "cf.workflows.workflow.instance.errored",
        source: { type: "workflows.workflow", workflowName: "contact-jira" },
        payload: { instanceId: "inst-1", versionId: "v1" },
      },
      [],
    );
    expect(text).toContain("A Workflow instance errored.");
    expect(text).toContain("Workflow: contact-jira");
    expect(text).toContain("Instance: inst-1");
    expect(text).toContain("Error: The event did not include an error message.");
    expect(
      queueAlert(
        {
          type: "cf.workflows.workflow.instance.completed",
          source: { workflowName: "contact-jira" },
          payload: { instanceId: "inst-1" },
        },
        [],
      ),
    ).toBeNull();
  });
});

describe("extractBuildError", () => {
  it("keeps the first error line and skips upload noise", () => {
    expect(extractBuildError(["Total Upload: 12 KiB", "Uploaded bm-alerts", "Error: boom"])).toBe(
      "Error: boom",
    );
    expect(extractBuildError(["Published", "🌀 Building"])).toBeNull();
  });
});
