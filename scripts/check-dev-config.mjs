import { devConfigErrors } from "./dev-config.mjs";

const errors = devConfigErrors();
if (errors.length > 0) {
  console.error("Dev config check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Dev config check passed: bm-automations-dev, D1 bm-automations-dev, allowlist locked.");
