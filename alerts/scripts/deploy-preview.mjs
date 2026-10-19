/**
 * Deploy bm-alerts-preview only.
 * Refuses prod. Creates the free-tier queue, deploys --env preview,
 * and installs Worker secrets when they are present in the environment.
 * Event subscriptions are skipped unless --with-subscriptions is passed.
 *
 * Never prints secret values.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ACCOUNT_ID = "a1e049769abbd70837e055ac5a0f9c7b";
export const PREVIEW_ENV = "preview";
export const PREVIEW_WORKER = "bm-alerts-preview";
export const PREVIEW_QUEUE = "bm-alerts-preview";
export const BUILD_SOURCE = "workersBuilds.worker";
export const BUILD_EVENTS = "build.failed,build.canceled";
export const WORKFLOW_SOURCE = "workflows.workflow";
export const WORKFLOW_EVENTS = "instance.errored";
export const RETENTION_SECS = 86400;
const WORKER_SECRETS = ["SLACK_BOT_TOKEN", "GITHUB_WEBHOOK_SECRET"];

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");

function refuseProd(argv) {
  const envFlag = argv.indexOf("--env");
  if (envFlag !== -1 && argv[envFlag + 1] === "prod") return true;
  return argv.some((arg) => arg === "prod" || arg === "--env=prod");
}

export function parseArgs(argv) {
  return {
    refuseProd: refuseProd(argv),
    withSubscriptions: argv.includes("--with-subscriptions"),
  };
}

function runWrangler(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [wrangler, ...args], {
      cwd: root,
      env: {
        ...process.env,
        CI: "true",
        CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || ACCOUNT_ID,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
      process.stderr.write(chunk);
    });
    child.stdin.end(input ?? "");
    child.on("close", (code) => {
      if (code === 0) resolve({ out, err });
      else reject(new Error(`wrangler ${args.join(" ")} exited ${code}\n${err}`));
    });
  });
}

async function cf(pathname) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is not set");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!data.success) {
    const message = (data.errors || []).map((error) => `${error.code} ${error.message}`).join("; ");
    throw new Error(`Cloudflare API ${pathname} failed: ${message || response.status}`);
  }
  return data.result;
}

async function listAll(pathname) {
  const rows = [];
  for (let page = 1; page <= 20; page++) {
    const joiner = pathname.includes("?") ? "&" : "?";
    const result = await cf(`${pathname}${joiner}page=${page}&per_page=100`);
    const batch = Array.isArray(result) ? result : [];
    rows.push(...batch);
    if (batch.length < 100) break;
  }
  return rows;
}

function safeName(prefix, name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${prefix}-${slug}`.slice(0, 63);
}

function alreadyExists(error) {
  const text = String(error?.message || error).toLowerCase();
  return (
    text.includes("already exists") ||
    text.includes("already taken") ||
    text.includes("multiple subscriptions") ||
    text.includes("duplicate") ||
    text.includes("409") ||
    text.includes("11009")
  );
}

async function existingSubscriptionNames() {
  const names = new Set();
  for (let page = 1; page <= 20; page++) {
    const result = await cf(`/event_subscriptions/subscriptions?page=${page}&per_page=100`);
    const rows = Array.isArray(result) ? result : [];
    for (const row of rows) {
      if (row?.name) names.add(row.name);
    }
    if (rows.length < 100) break;
  }
  return names;
}

async function createQueue() {
  const queues = await cf("/queues");
  const names = (Array.isArray(queues) ? queues : []).map((queue) => queue.queue_name);
  if (names.includes(PREVIEW_QUEUE)) {
    console.log(`Queue ${PREVIEW_QUEUE} already exists.`);
    return;
  }
  await runWrangler([
    "queues",
    "create",
    PREVIEW_QUEUE,
    "--message-retention-period-secs",
    String(RETENTION_SECS),
  ]);
}

function firstDeployNeedsSecrets(error) {
  const text = String(error?.message || error);
  return text.includes("required secrets have not been set") && text.includes("does not exist yet");
}

async function deployWorker() {
  try {
    await runWrangler(["deploy", "--env", PREVIEW_ENV]);
    return;
  } catch (error) {
    if (!firstDeployNeedsSecrets(error)) throw error;
  }

  // Wrangler will not create a Worker that declares secrets.required until
  // every name has a value. Missing names get a random stand-in so preview
  // can be created. The stand-in is not logged. Replace it with secret put.
  const generated = [];
  const secrets = {};
  for (const name of WORKER_SECRETS) {
    const value = process.env[name];
    if (value) secrets[name] = value;
    else {
      generated.push(name);
      secrets[name] = randomBytes(32).toString("hex");
    }
  }
  if (generated.length > 0) {
    console.log(
      `Worker secrets not in the environment (${generated.join(", ")}). Creating ${PREVIEW_WORKER} with random stand-ins. Replace each one with: npx wrangler secret put <NAME> --env ${PREVIEW_ENV}`,
    );
  }
  const dir = mkdtempSync(path.join(tmpdir(), "bm-alerts-"));
  const file = path.join(dir, "secrets.json");
  try {
    writeFileSync(file, JSON.stringify(secrets), { mode: 0o600 });
    await runWrangler(["deploy", "--env", PREVIEW_ENV, "--secrets-file", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function putSecrets() {
  for (const name of WORKER_SECRETS) {
    const value = process.env[name];
    if (!value) {
      console.log(
        `Worker secret ${name} is not in the environment. Set it with: npx wrangler secret put ${name} --env ${PREVIEW_ENV}`,
      );
      continue;
    }
    await runWrangler(["secret", "put", name, "--env", PREVIEW_ENV], value);
    console.log(`Set Worker secret ${name} on ${PREVIEW_WORKER}.`);
  }
}

async function subscribe(args) {
  try {
    await runWrangler(["queues", "subscription", "create", PREVIEW_QUEUE, ...args]);
  } catch (error) {
    if (alreadyExists(error)) {
      console.log(`Subscription already exists (${args.join(" ")}).`);
      return;
    }
    throw error;
  }
}

async function syncSubscriptions() {
  const failures = [];
  const existing = await existingSubscriptionNames();
  const workers = await listAll("/workers/scripts");
  const names = workers.map((worker) => worker.id || worker.name).filter(Boolean);
  console.log(`Subscribing ${names.length} Workers to ${BUILD_EVENTS}.`);
  for (const name of names) {
    const subscriptionName = safeName("builds", name);
    if (existing.has(subscriptionName)) {
      console.log(`Subscription ${subscriptionName} already exists.`);
      continue;
    }
    try {
      await subscribe([
        "--source",
        BUILD_SOURCE,
        "--events",
        BUILD_EVENTS,
        "--worker-name",
        name,
        "--name",
        subscriptionName,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "subscription failed";
      console.error(`Build subscription failed for ${name}: ${message}`);
      failures.push(name);
    }
  }

  const workflows = await listAll("/workflows");
  const workflowNames = workflows
    .map((workflow) => workflow.name)
    .filter((name) => typeof name === "string" && name && !name.endsWith("-test"));
  console.log(`Subscribing ${workflowNames.length} Workflows to ${WORKFLOW_EVENTS}.`);
  for (const name of workflowNames) {
    const subscriptionName = safeName("workflow", name);
    if (existing.has(subscriptionName)) {
      console.log(`Subscription ${subscriptionName} already exists.`);
      continue;
    }
    try {
      await subscribe([
        "--source",
        WORKFLOW_SOURCE,
        "--events",
        WORKFLOW_EVENTS,
        "--workflow-name",
        name,
        "--name",
        subscriptionName,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : "subscription failed";
      console.error(`Workflow subscription failed for ${name}: ${message}`);
      failures.push(name);
    }
  }
  if (failures.length > 0) {
    throw new Error(`Event subscriptions failed for: ${failures.join(", ")}`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.refuseProd) {
    console.error("Refusing to deploy prod. Preview only. Pedro deploys prod after Thiago approves.");
    process.exitCode = 1;
    return;
  }
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error("CLOUDFLARE_API_TOKEN is not set. The preview deploy did not run.");
    process.exitCode = 1;
    return;
  }
  await createQueue();
  await deployWorker();
  await putSecrets();
  if (args.withSubscriptions) {
    await syncSubscriptions();
  } else {
    console.log("Skipping event subscriptions. Pass --with-subscriptions to create them.");
  }
  console.log(`Deployed ${PREVIEW_WORKER}. Prod was not deployed.`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "deploy failed");
    process.exitCode = 1;
  });
}
