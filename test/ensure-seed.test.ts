import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { SEED_AUTOMATIONS } from "../src/automations/seed";
import { d1Database, Repo } from "../src/db/repo";
import { createApp } from "../src/index";
import { loadRuntime } from "../src/pipeline/runtime";
import { asD1, openSqlite, testEnv, trackingDb } from "./helpers";

describe("ensureSeed hot path", () => {
  it("skips seed writes when migrations already filled the table", async () => {
    const sqlite = openSqlite();
    const log = { seedWrites: 0 };
    const repo = new Repo(trackingDb(d1Database(asD1(sqlite)), log));
    expect(await repo.listAutomations()).toHaveLength(SEED_AUTOMATIONS.length);
    await repo.ensureSeed();
    expect(log.seedWrites).toBe(0);
  });

  it("seeds a fresh empty automations table in one batch and is idempotent", async () => {
    const sqlite = openSqlite();
    sqlite.exec("DELETE FROM automations");
    const log = { seedWrites: 0 };
    const repo = new Repo(trackingDb(d1Database(asD1(sqlite)), log));
    await repo.ensureSeed();
    expect(log.seedWrites).toBe(SEED_AUTOMATIONS.length);
    const rows = await repo.listAutomations();
    expect(rows).toHaveLength(SEED_AUTOMATIONS.length);
    expect(rows.map((row) => row.key)).toEqual(SEED_AUTOMATIONS.map((row) => row.key));
    expect(rows.every((row) => row.enabled === false)).toBe(true);

    log.seedWrites = 0;
    await repo.toggleAutomation(1);
    await repo.ensureSeed();
    expect(log.seedWrites).toBe(0);
    expect((await repo.getAutomation(1))?.enabled).toBe(true);
  });

  it("loadRuntime and admin pages do not call ensureSeed", async () => {
    const sqlite = openSqlite();
    const env = testEnv(asD1(sqlite));
    let seedCalls = 0;
    const original = Repo.prototype.ensureSeed;
    Repo.prototype.ensureSeed = async function trackedEnsureSeed(this: Repo) {
      seedCalls += 1;
      return original.call(this);
    };
    try {
      await loadRuntime(env, {
        now: () => new Date("2026-10-11T00:00:00Z"),
        fetchImpl: async () => {
          throw new Error("unexpected");
        },
      });
      expect(seedCalls).toBe(0);

      const app = createApp({
        now: () => new Date("2026-10-11T00:00:00Z"),
        fetchImpl: async () => {
          throw new Error("unexpected");
        },
      });
      const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
      const list = await app.fetch(
        new Request("https://automations.example/automations", {
          headers: { Cookie: `bm_automations_session=${token}` },
        }),
        env,
        {} as ExecutionContext,
      );
      expect(list.status).toBe(200);
      expect(await list.text()).toContain("Lead welcome");
      expect(seedCalls).toBe(0);
    } finally {
      Repo.prototype.ensureSeed = original;
    }
  });
});
