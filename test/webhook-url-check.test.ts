import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { asD1, openSqlite, testEnv } from "./helpers";

describe("Mindbody webhook URL check", () => {
  const url = "https://automations.example/webhooks/mindbody";

  for (const method of ["HEAD", "GET"]) {
    it(`answers ${method} with an empty 200`, async () => {
      const app = createApp({ now: () => new Date("2026-10-11T00:00:00Z"), fetchImpl: async () => { throw new Error("outbound"); } });
      const env = testEnv(asD1(openSqlite()));
      const response = await app.fetch(new Request(url, { method }), env, {} as ExecutionContext);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });
  }

  it("still rejects an unsigned POST", async () => {
    const app = createApp({ now: () => new Date("2026-10-11T00:00:00Z"), fetchImpl: async () => { throw new Error("outbound"); } });
    const env = testEnv(asD1(openSqlite()));
    const response = await app.fetch(new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: "client.updated", eventData: {} }),
    }), env, {} as ExecutionContext);
    expect(response.status).toBe(401);
  });
});
