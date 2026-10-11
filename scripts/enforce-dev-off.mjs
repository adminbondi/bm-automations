import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEV_DATABASE_NAME, devConfigErrors } from "./dev-config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = join(root, "node_modules", ".bin", "wrangler");

const errors = devConfigErrors();
if (errors.length > 0) {
  console.error("Refusing to touch D1. Dev config check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

function runWrangler(args) {
  const result = spawnSync(wrangler, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI: "true" },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`wrangler ${args.join(" ")} exited ${result.status ?? "with a signal"}.`);
    process.exit(result.status || 1);
  }
  return result.stdout ?? "";
}

runWrangler(["d1", "migrations", "apply", DEV_DATABASE_NAME, "--remote", "--env", "dev"]);

function d1(sql) {
  const stdout = runWrangler([
    "d1",
    "execute",
    DEV_DATABASE_NAME,
    "--remote",
    "--env",
    "dev",
    "--json",
    "--yes",
    "--command",
    sql,
  ]);
  const start = stdout.indexOf("[");
  const objectStart = stdout.indexOf("{");
  const jsonStart = start === -1 ? objectStart : objectStart === -1 ? start : Math.min(start, objectStart);
  if (jsonStart === -1) {
    console.error("Dev automations check failed: wrangler did not return JSON.");
    process.exit(1);
  }
  const parsed = JSON.parse(stdout.slice(jsonStart));
  const results = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.success === false) {
      console.error("Dev automations check failed: D1 reported success=false.");
      process.exit(1);
    }
    if (Array.isArray(value.results)) results.push(...value.results);
  };
  visit(parsed);
  return results;
}

d1("UPDATE automations SET enabled = 0 WHERE enabled != 0;");
const totals = d1("SELECT COUNT(*) AS total FROM automations;");
const enabled = d1("SELECT key FROM automations WHERE enabled != 0;");
const totalRow = totals.find((row) => Object.prototype.hasOwnProperty.call(row, "total"));
const enabledKeys = enabled.map((row) => row.key).filter(Boolean);
const total = Number(totalRow?.total ?? 0);

if (!Number.isInteger(total) || total < 1) {
  console.error("Dev automations check failed: bm-automations-dev has no automation rows after migrations.");
  process.exit(1);
}
if (enabledKeys.length > 0) {
  console.error(`Dev automations check failed. Still enabled: ${enabledKeys.join(", ")}`);
  process.exit(1);
}
console.log(`Dev automations check passed: ${total} rows, all enabled = 0.`);
