/**
 * Register the GitHub webhook that sends workflow_run events to bm-alerts.
 *
 * Dry-run unless --apply is set. Never prints the webhook secret.
 *
 * Org hook (one hook for every adminbondi repository):
 *   GITHUB_WEBHOOK_SECRET=... WEBHOOK_URL=https://bm-alerts-preview.<subdomain>.workers.dev/webhooks/github \
 *     node scripts/register-github-webhook.mjs --mode org --org adminbondi --apply
 *
 * Per-repo fallback (only repositories that have Actions workflows):
 *   node scripts/register-github-webhook.mjs --mode repos --org adminbondi --apply
 *
 * Uses the gh CLI (GH_TOKEN or GITHUB_TOKEN).
 * Org mode needs admin:org_hook. Per-repo mode needs admin on each repository.
 */
import { spawnSync } from "node:child_process";

export const WEBHOOK_EVENTS = ["workflow_run"];

export function resolveWebhookUrl(input) {
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("WEBHOOK_URL must be https");
  if (url.pathname === "/" || url.pathname === "") url.pathname = "/webhooks/github";
  if (!url.pathname.endsWith("/webhooks/github")) {
    throw new Error("WEBHOOK_URL path must be /webhooks/github");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function hookBody(webhookUrl, secret) {
  return {
    name: "web",
    active: true,
    events: WEBHOOK_EVENTS,
    config: {
      url: webhookUrl,
      content_type: "json",
      secret,
      insecure_ssl: "0",
    },
  };
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function gh(args, input) {
  const result = spawnSync("gh", args, {
    input,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "gh failed").trim();
    throw new Error(detail);
  }
  return result.stdout;
}

function ghJson(args, input) {
  const stdout = gh(args, input);
  return stdout ? JSON.parse(stdout) : null;
}

function listHooks(apiPath) {
  return ghJson(["api", "--paginate", apiPath]) || [];
}

function matchingHook(hooks, webhookUrl) {
  return hooks.find((hook) => hook?.config?.url === webhookUrl);
}

function printPlan(scope, webhookUrl, existing) {
  const action = existing ? `update hook ${existing.id}` : "create a hook";
  console.log(`${scope}: ${action} for workflow_run -> ${webhookUrl}`);
}

function applyHook(apiPath, webhookUrl, secret, existing) {
  const body = JSON.stringify(hookBody(webhookUrl, secret));
  if (existing) {
    gh(["api", "--method", "PATCH", `${apiPath}/${existing.id}`, "--input", "-"], body);
    console.log(`Updated hook ${existing.id} on ${apiPath}.`);
    return;
  }
  const created = ghJson(["api", "--method", "POST", apiPath, "--input", "-"], body);
  console.log(`Created hook ${created?.id ?? "(unknown id)"} on ${apiPath}.`);
}

function reposWithActions(org) {
  const repos = ghJson([
    "repo",
    "list",
    org,
    "--limit",
    "200",
    "--no-archived",
    "--json",
    "name",
  ]);
  const withActions = [];
  for (const repo of repos) {
    try {
      const workflows = ghJson(["api", `repos/${org}/${repo.name}/actions/workflows`]);
      if ((workflows?.total_count ?? 0) > 0) withActions.push(repo.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("404") || message.includes("Not Found")) continue;
      throw error;
    }
  }
  return withActions;
}

function main() {
  const mode = arg("--mode", "org");
  const org = arg("--org", "adminbondi");
  const apply = process.argv.includes("--apply");
  const secret = process.env.GITHUB_WEBHOOK_SECRET || "";
  const rawUrl = process.env.WEBHOOK_URL || "";
  if (!rawUrl) {
    console.error("WEBHOOK_URL is required (the bm-alerts https origin or /webhooks/github URL).");
    process.exitCode = 1;
    return;
  }
  if (apply && !secret) {
    console.error("GITHUB_WEBHOOK_SECRET is required with --apply. It was not printed.");
    process.exitCode = 1;
    return;
  }
  const webhookUrl = resolveWebhookUrl(rawUrl);
  console.log(`mode=${mode} org=${org} apply=${apply} secret=${secret ? "set" : "missing"}`);
  console.log(`url=${webhookUrl}`);

  if (mode === "org") {
    const apiPath = `orgs/${org}/hooks`;
    let hooks = [];
    try {
      hooks = listHooks(apiPath);
    } catch (error) {
      console.error(
        `Could not list org hooks. The token needs admin:org_hook on ${org}. ${error instanceof Error ? error.message : ""}`,
      );
      process.exitCode = 1;
      return;
    }
    const existing = matchingHook(hooks, webhookUrl);
    printPlan(`${org} org`, webhookUrl, existing);
    if (apply) applyHook(apiPath, webhookUrl, secret, existing);
    return;
  }

  if (mode === "repos") {
    const names = reposWithActions(org);
    if (names.length === 0) console.log(`No ${org} repositories with Actions workflows were visible.`);
    for (const name of names) {
      const apiPath = `repos/${org}/${name}/hooks`;
      const hooks = listHooks(apiPath);
      const existing = matchingHook(hooks, webhookUrl);
      printPlan(`${org}/${name}`, webhookUrl, existing);
      if (apply) applyHook(apiPath, webhookUrl, secret, existing);
    }
    return;
  }

  console.error("--mode must be org or repos");
  process.exitCode = 1;
}

const invoked = process.argv[1] && process.argv[1].endsWith("register-github-webhook.mjs");
if (invoked) main();
