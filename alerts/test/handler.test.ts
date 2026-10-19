import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import { signBody } from "./sign";

const secret = "webhook-secret";
const env = {
  WORKER_NAME: "bm-alerts-preview",
  SLACK_CHANNEL_ID: "C0CABUPL2BW",
  SLACK_BOT_TOKEN: "xoxb-test",
  GITHUB_WEBHOOK_SECRET: secret,
} as Env;

async function webhook(body: unknown, event: string, signature: string | null): Promise<Response> {
  const raw = JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json", "x-github-event": event });
  if (signature) headers.set("x-hub-signature-256", signature);
  return worker.fetch(
    new Request("https://bm-alerts-preview.example.workers.dev/webhooks/github", {
      method: "POST",
      headers,
      body: raw,
    }),
    env,
  );
}

function batch(bodies: unknown[]) {
  const actions: string[] = [];
  const messages = bodies.map((body) => ({
    body,
    ack() {
      actions.push("ack");
    },
    retry() {
      actions.push("retry");
    },
  }));
  return {
    actions,
    batch: { messages, queue: "bm-alerts-preview" } as unknown as MessageBatch<unknown>,
  };
}

describe("http handler", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("answers a health check without calling Slack", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await worker.fetch(new Request("https://bm-alerts-preview.example.workers.dev/"), env);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("bm-alerts-preview is up. It posts failures only.\n");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing or bad signature", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const body = { action: "completed" };
    expect((await webhook(body, "workflow_run", null)).status).toBe(401);
    expect((await webhook(body, "workflow_run", "sha256=" + "ab".repeat(32))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a failed workflow run and ignores success", async () => {
    const posted: { channel?: string; text?: string }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      posted.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const failure = {
      action: "completed",
      workflow_run: {
        name: "Deploy preview Worker",
        head_branch: "main",
        html_url: "https://github.com/adminbondi/bm-short-links/actions/runs/42",
        conclusion: "failure",
        triggering_actor: { login: "octocat" },
        head_commit: { message: "missing token" },
      },
      repository: { full_name: "adminbondi/bm-short-links" },
    };
    const raw = JSON.stringify(failure);
    const ok = await webhook(failure, "workflow_run", await signBody(raw, secret));
    expect(ok.status).toBe(200);
    expect(posted).toHaveLength(1);
    expect(posted[0]?.channel).toBe("C0CABUPL2BW");
    expect(posted[0]?.text).toContain("GitHub Actions failed.");
    expect(posted[0]?.text).toContain("adminbondi/bm-short-links");

    const success = { ...failure, workflow_run: { ...failure.workflow_run, conclusion: "success" } };
    const successRaw = JSON.stringify(success);
    const ignored = await webhook(success, "workflow_run", await signBody(successRaw, secret));
    expect(ignored.status).toBe(200);
    expect(posted).toHaveLength(1);
  });

  it("returns 502 when Slack rejects the post", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: false, error: "not_in_channel" }), { status: 200 }));
    const failure = {
      action: "completed",
      workflow_run: {
        name: "CI",
        head_branch: "main",
        html_url: "https://github.com/adminbondi/bm-automations/actions/runs/7",
        conclusion: "timed_out",
        triggering_actor: { login: "octocat" },
        head_commit: { message: "slow" },
      },
      repository: { full_name: "adminbondi/bm-automations" },
    };
    const raw = JSON.stringify(failure);
    const response = await webhook(failure, "workflow_run", await signBody(raw, secret));
    expect(response.status).toBe(502);
  });
});

describe("queue handler", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("acks successes and posts failures", async () => {
    const posted: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      posted.push(JSON.parse(String(init?.body)).text);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const { batch: messages, actions } = batch([
      { type: "cf.workersBuilds.worker.build.succeeded", payload: { buildOutcome: "success" }, source: { workerName: "x" } },
      {
        type: "cf.workflows.workflow.instance.errored",
        source: { workflowName: "form-pdf-mindbody" },
        payload: { instanceId: "inst-9", error: { message: "step blew up" } },
      },
    ]);
    await worker.queue(messages, env);
    expect(actions).toEqual(["ack", "ack"]);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toContain("form-pdf-mindbody");
    expect(posted[0]).toContain("step blew up");
  });

  it("retries when Slack is down", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    const { batch: messages, actions } = batch([
      {
        type: "cf.workersBuilds.worker.build.failed",
        source: { workerName: "bm-forms-api" },
        payload: { buildOutcome: "failure", buildUuid: "build-1", buildTriggerMetadata: { branch: "main" } },
        metadata: { accountId: "account" },
      },
    ]);
    await worker.queue(messages, env);
    expect(actions).toEqual(["retry"]);
  });
});
