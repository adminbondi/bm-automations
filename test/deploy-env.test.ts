import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("dev deploy", () => {
  it("publishes bm-automations-dev with its own D1", () => {
    const config = readFileSync("wrangler.jsonc", "utf8");
    const dev = config.slice(config.indexOf('"env"'));
    expect(dev).toContain('"dev"');
    expect(dev).toContain('"name": "bm-automations-dev"');
    expect(dev).toContain('"database_name": "bm-automations-dev"');
    expect(dev).toContain('"binding": "DB"');
    expect(dev).toContain('"DEV_MODE": "true"');
    expect(dev).toContain('"MINDBODY_API_KEY"');
    expect(dev).toContain('"TWILIO_AUTH_TOKEN"');
    const script = readFileSync("scripts/deploy.sh", "utf8");
    expect(script).toContain('"${1:-}" = "dev"');
    expect(script).toContain("wrangler deploy --env dev");
    expect(script.indexOf("npm test")).toBeLessThan(script.indexOf("wrangler deploy --env dev"));
  });
});
