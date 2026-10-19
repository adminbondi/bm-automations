import { describe, expect, it } from "vitest";
import { githubDecision } from "../src/github";

function payload(conclusion: string, extra: Record<string, unknown> = {}) {
  return {
    action: "completed",
    workflow_run: {
      name: "Deploy preview Worker",
      head_branch: "main",
      display_title: "title fallback",
      html_url: "https://github.com/adminbondi/bm-short-links/actions/runs/42",
      conclusion,
      triggering_actor: { login: "octocat" },
      head_commit: { message: "missing CLOUDFLARE_API_TOKEN secret\n\nmore body" },
      ...extra,
    },
    repository: { full_name: "adminbondi/bm-short-links" },
    sender: { login: "someone-else" },
  };
}

describe("github workflow_run", () => {
  it("describes a failure in plain words", () => {
    const decision = githubDecision("workflow_run", payload("failure"));
    expect(decision.kind).toBe("alert");
    if (decision.kind !== "alert") return;
    expect(decision.text).toBe(
      [
        "GitHub Actions failed.",
        "",
        "Repo: adminbondi/bm-short-links",
        "Workflow: Deploy preview Worker",
        "Branch: main",
        "Commit: missing CLOUDFLARE_API_TOKEN secret",
        "Triggered by: octocat",
        "Run: https://github.com/adminbondi/bm-short-links/actions/runs/42",
      ].join("\n"),
    );
  });

  it("alerts on cancelled and timed_out, and ignores success", () => {
    expect(githubDecision("workflow_run", payload("cancelled")).kind).toBe("alert");
    expect(githubDecision("workflow_run", payload("timed_out")).kind).toBe("alert");
    expect(githubDecision("workflow_run", payload("success"))).toEqual({
      kind: "ignore",
      reason: "not-a-failure",
    });
    expect(githubDecision("workflow_run", { action: "requested", workflow_run: {} })).toEqual({
      kind: "ignore",
      reason: "not-completed",
    });
  });

  it("ignores other events and answers ping", () => {
    expect(githubDecision("ping", {})).toEqual({ kind: "ping" });
    expect(githubDecision("push", {})).toEqual({ kind: "ignore", reason: "other-event" });
  });

  it("falls back to the actor, then the sender", () => {
    const noTrigger = payload("failure", { triggering_actor: undefined, actor: { login: "runner" } });
    const decision = githubDecision("workflow_run", noTrigger);
    expect(decision.kind).toBe("alert");
    if (decision.kind === "alert") expect(decision.text).toContain("Triggered by: runner");
  });
});
