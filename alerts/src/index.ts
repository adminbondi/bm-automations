import { fetchBuildLogs } from "./build-logs";
import { queueAlert, wantsBuildLogs } from "./events";
import { githubDecision } from "./github";
import { verifyGithubSignature } from "./signature";
import { postSlackMessage } from "./slack";

const MAX_BODY_BYTES = 1_000_000;

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" || request.method === "HEAD") {
    if (url.pathname === "/" || url.pathname === "/health") {
      const body = `${env.WORKER_NAME} is up. It posts failures only.\n`;
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  }
  if (request.method === "POST" && url.pathname === "/webhooks/github") {
    return handleGithub(request, env);
  }
  return text("not found\n", 404);
}

async function handleGithub(request: Request, env: Env): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return text("payload too large\n", 413);

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY_BYTES) return text("payload too large\n", 413);

  const valid = await verifyGithubSignature(
    body,
    request.headers.get("x-hub-signature-256"),
    env.GITHUB_WEBHOOK_SECRET.trim(),
  );
  if (!valid) return text("invalid signature\n", 401);

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return text("invalid json\n", 400);
  }

  const eventName = request.headers.get("x-github-event") ?? "";
  const decision = githubDecision(eventName, payload);
  if (decision.kind !== "alert") {
    console.log(
      JSON.stringify({
        source: "github",
        event: eventName,
        result: decision.kind,
        reason: decision.kind === "ignore" ? decision.reason : undefined,
      }),
    );
    return text("ok\n", 200);
  }

  try {
    await postSlackMessage(env, decision.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Slack post failed";
    console.error(JSON.stringify({ source: "github", result: "slack_error", error: message }));
    return text("alert was not posted\n", 502);
  }

  console.log(
    JSON.stringify({
      source: "github",
      result: "alerted",
      repo: decision.repo,
      conclusion: decision.conclusion,
    }),
  );
  return text("ok\n", 200);
}

export async function handleBatch(batch: MessageBatch<unknown>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      const logs = wantsBuildLogs(message.body) ? await fetchBuildLogs(message.body, env) : [];
      const alert = queueAlert(message.body, logs);
      if (!alert) {
        message.ack();
        continue;
      }
      await postSlackMessage(env, alert);
      message.ack();
      console.log(JSON.stringify({ source: "queue", result: "alerted" }));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "queue handler failed";
      console.error(JSON.stringify({ source: "queue", result: "retry", error: detail }));
      message.retry();
    }
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
  async queue(batch, env) {
    await handleBatch(batch, env);
  },
} satisfies ExportedHandler<Env, unknown>;
