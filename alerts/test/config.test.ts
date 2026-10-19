import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hookBody, resolveWebhookUrl } from "../scripts/register-github-webhook.mjs";
import {
  BUILD_EVENTS,
  PREVIEW_ENV,
  PREVIEW_QUEUE,
  PREVIEW_WORKER,
  RETENTION_SECS,
  WORKFLOW_EVENTS,
} from "../scripts/deploy-preview.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJsonc(name: string): Record<string, unknown> {
  const text = readFileSync(path.join(root, name), "utf8");
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped) as Record<string, unknown>;
}

describe("preview and prod only", () => {
  it("names the preview and prod workers and their failure queues", () => {
    const config = readJsonc("wrangler.jsonc");
    const env = config.env as Record<string, { name: string; queues: { consumers: { queue: string }[] } }>;
    expect(Object.keys(env).sort()).toEqual(["preview", "prod"]);
    expect(env.preview?.name).toBe("bm-alerts-preview");
    expect(env.prod?.name).toBe("bm-alerts");
    expect(env.preview?.queues.consumers[0]?.queue).toBe("bm-alerts-preview");
    expect(env.prod?.queues.consumers[0]?.queue).toBe("bm-alerts");
    expect(config.name).toBe("bm-alerts-preview");
    expect(config.account_id).toBe("a1e049769abbd70837e055ac5a0f9c7b");
  });

  it("subscribes the preview queue to failures only, with free-tier retention", () => {
    expect(PREVIEW_ENV).toBe("preview");
    expect(PREVIEW_WORKER).toBe("bm-alerts-preview");
    expect(PREVIEW_QUEUE).toBe("bm-alerts-preview");
    expect(BUILD_EVENTS).toBe("build.failed,build.canceled");
    expect(BUILD_EVENTS).not.toContain("succeeded");
    expect(BUILD_EVENTS).not.toContain("started");
    expect(WORKFLOW_EVENTS).toBe("instance.errored");
    expect(RETENTION_SECS).toBe(86400);
    const source = readFileSync(path.join(root, "scripts", "deploy-preview.mjs"), "utf8");
    expect(source).toContain("Refusing to deploy prod");
    expect(source).not.toContain("build.succeeded");
    expect(source).not.toContain("instance.completed");
  });
});

describe("webhook registration payload", () => {
  it("builds an org hook for workflow_run and accepts an origin", () => {
    expect(resolveWebhookUrl("https://bm-alerts-preview.example.workers.dev")).toBe(
      "https://bm-alerts-preview.example.workers.dev/webhooks/github",
    );
    expect(resolveWebhookUrl("https://bm-alerts-preview.example.workers.dev/webhooks/github")).toBe(
      "https://bm-alerts-preview.example.workers.dev/webhooks/github",
    );
    const body = hookBody("https://bm-alerts-preview.example.workers.dev/webhooks/github", "sekret");
    expect(body.events).toEqual(["workflow_run"]);
    expect(body.config.content_type).toBe("json");
    expect(body.config.insecure_ssl).toBe("0");
    expect(() => resolveWebhookUrl("http://example.com/webhooks/github")).toThrow(/https/);
  });
});
