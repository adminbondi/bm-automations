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

// Apply schema/seed migrations only. Do not change any automation `enabled` flag.
runWrangler(["d1", "migrations", "apply", DEV_DATABASE_NAME, "--remote", "--env", "dev"]);
console.log(`Applied remote D1 migrations for ${DEV_DATABASE_NAME}. Automation enabled flags are left unchanged.`);
