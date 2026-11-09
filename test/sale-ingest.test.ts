import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { mindbodySignature } from "../src/signature";
import { d1Database, Repo } from "../src/db/repo";
import { asD1, openSqlite, testEnv } from "./helpers";

async function post(app: ReturnType<typeof createApp>, env: Env, body: string) {
  const signature = await mindbodySignature(body, "sign-key");
  return app.fetch(
    new Request("https://automations.example/webhooks/mindbody", {
      method: "POST",
      headers: { "X-Mindbody-Signature": signature, "Content-Type": "application/json" },
      body,
    }),
    env,
    {} as ExecutionContext,
  );
}

function saleBody(messageId: string, clientId: string) {
  return JSON.stringify({
    messageId,
    eventId: "clientSale.created",
    eventInstanceOriginationDateTime: "2026-11-09T09:50:33Z",
    eventData: {
      siteId: 9853,
      purchasingClientId: clientId,
      saleId: 507703,
      items: [{ name: "BLACK FRIDAY INTRO - 7 DAYS UNLIMITED CLASSES", recipientClientId: clientId }],
    },
  });
}

describe("clientSale.created ingest", () => {
  it("records a sale when Moment 1 is on and clients_seen already has the email (no Mindbody call)", async () => {
    const calls: string[] = [];
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite), {
      MINDBODY_API_KEY: "key",
      MINDBODY_STAFF_USERNAME: "staff",
      MINDBODY_STAFF_PASSWORD: "pass",
      LISTMONK_API_USER: "api",
      LISTMONK_API_TOKEN: "token",
    });
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-11-09T09:50:33.000Z");
    await repo.ensureSeed();
    const moment1 = (await repo.listAutomations()).find((row) => row.key === "bf-intro-moment-1");
    expect(moment1).toBeTruthy();
    await repo.updateAutomation(moment1!.id, { enabled: true });
    await repo.upsertClient({
      clientId: "100025117",
      email: "bondi@balancemoves.com.au",
      phone: null,
      firstName: "Lucy",
      lastName: "Ridgwell",
      createdAt: "2026-11-09T09:50:15.000Z",
    });
    const app = createApp({
      now: () => new Date("2026-11-09T09:50:33Z"),
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("/api/subscribers")) {
          return new Response(
            JSON.stringify({
              data: {
                results: [{ id: 1, uuid: "sub", email: "bondi@balancemoves.com.au", status: "enabled", lists: [] }],
              },
            }),
            { status: 200 },
          );
        }
        if (url.includes("/api/tx")) return new Response("{}", { status: 200 });
        if (url.endsWith("/usertoken/issue")) return new Response("DeniedAccess", { status: 403 });
        throw new Error(`unexpected ${url}`);
      },
    });

    const response = await post(app, env, saleBody("PaaLmzkNGJ7cVgyfGuTft8", "100025117"));
    expect(response.status).toBe(200);
    expect(await repo.seenMessage("PaaLmzkNGJ7cVgyfGuTft8")).toBe(true);
    expect(calls.some((url) => url.includes("api.mindbodyonline.com"))).toBe(false);
  });

  it("still records a sale when Mindbody staff token 403s and no clients_seen email exists", async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite), {
      MINDBODY_API_KEY: "key",
      MINDBODY_STAFF_USERNAME: "staff",
      MINDBODY_STAFF_PASSWORD: "pass",
    });
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-11-09T10:19:49.000Z");
    await repo.ensureSeed();
    const moment1 = (await repo.listAutomations()).find((row) => row.key === "bf-intro-moment-1");
    await repo.updateAutomation(moment1!.id, { enabled: true });
    const app = createApp({
      now: () => new Date("2026-11-09T10:19:49Z"),
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith("/usertoken/issue")) return new Response("DeniedAccess", { status: 403 });
        throw new Error(`unexpected ${url}`);
      },
    });
    try {
      const response = await post(app, env, saleBody("JrzAUK6kGbSyY89jEaJBP9", "100025119"));
      expect(response.status).toBe(200);
      expect(await repo.seenMessage("JrzAUK6kGbSyY89jEaJBP9")).toBe(true);
      expect(lines.some((line) => line.includes("mindbody_snapshot_failed") && line.includes("mindbody_token_403"))).toBe(true);
    } finally {
      console.log = original;
    }
  });
});
