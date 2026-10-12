import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "../src/auth";
import { d1Database, Repo } from "../src/db/repo";
import { funnelMigrationSql, LANE_ORDER, LANE_STEPS, lanePlacements, UNCONFIRMED_TIMING_KEYS } from "../src/automations/lanes";
import { SEED_AUTOMATIONS } from "../src/automations/seed";
import { blankAutomation } from "../src/http/editor";
import { createApp } from "../src/index";
import { asD1, openSqlite, testEnv, testRepo } from "./helpers";

const app = () => createApp({ now: () => new Date("2026-10-11T00:00:00Z"), fetchImpl: async () => { throw new Error("unexpected"); } });

async function automationsHtml(sqlite = openSqlite()): Promise<string> {
  const env = testEnv(asD1(sqlite));
  const token = await createSessionToken("session-secret", "owner@balancemoves.com.au");
  const response = await app().fetch(new Request("https://automations.example/automations", {
    headers: { Cookie: `bm_automations_session=${token}` },
  }), env, {} as ExecutionContext);
  expect(response.status).toBe(200);
  return response.text();
}

function stepKeys(html: string): string[] {
  return [...html.matchAll(/data-key="([^"]+)"/g)].map((match) => match[1] ?? "");
}

describe("funnel lanes", () => {
  it("assigns every automation to one lane without changing the on/off flag", () => {
    const sql = readFileSync("migrations/0007_funnels.sql", "utf8");
    expect(sql).toBe(funnelMigrationSql());
    expect(sql).not.toMatch(/\benabled\b/i);
    expect(new Set(LANE_STEPS.map((step) => step.key)).size).toBe(LANE_STEPS.length);
    expect(new Set(LANE_STEPS.map((step) => step.key))).toEqual(new Set(SEED_AUTOMATIONS.map((row) => row.key)));
    expect(SEED_AUTOMATIONS.every((row) => row.enabled === false)).toBe(true);

    const db = new DatabaseSync(":memory:");
    const files = readdirSync("migrations").filter((file) => file.endsWith(".sql")).sort();
    for (const file of files.filter((name) => name < "0007")) db.exec(readFileSync(`migrations/${file}`, "utf8"));
    const enabledBefore = db.prepare(`SELECT key, enabled FROM automations ORDER BY id`).all() as { key: string; enabled: number }[];
    expect(enabledBefore).toHaveLength(72);
    expect(enabledBefore.every((row) => row.enabled === 0)).toBe(true);
    db.exec(readFileSync("migrations/0007_funnels.sql", "utf8"));
    const enabledAfter = db.prepare(`SELECT key, enabled FROM automations ORDER BY id`).all() as { key: string; enabled: number }[];
    expect(enabledAfter).toEqual(enabledBefore);

    const rows = db.prepare(`SELECT key, funnel, position, timing_label, enabled FROM automations`).all() as {
      key: string;
      funnel: string;
      position: number;
      timing_label: string;
      enabled: number;
    }[];
    expect(rows.every((row) => row.enabled === 0)).toBe(true);
    const byKey = new Map(rows.map((row) => [row.key, row]));
    for (const step of lanePlacements()) {
      expect(byKey.get(step.key)).toMatchObject({
        funnel: step.funnel,
        position: step.position,
        timing_label: step.timingLabel,
      });
    }
    const slots = rows.map((row) => `${row.funnel}:${row.position}`);
    expect(new Set(slots).size).toBe(rows.length);
    expect(byKey.get("red-flag-under-3-credits")).toMatchObject({
      funnel: "CLASS PACKS FUNNEL",
      position: 8,
      timing_label: "Under 3 credits",
    });
    for (const key of UNCONFIRMED_TIMING_KEYS) {
      expect(byKey.get(key)?.timing_label).toBe(LANE_STEPS.find((step) => step.key === key)?.timingLabel);
    }
  });

  it("shows every automation in exactly one lane and leaves every switch off", async () => {
    const html = await automationsHtml();
    expect(stepKeys(html)).toEqual(LANE_STEPS.map((step) => step.key));
    expect(html).not.toContain('class="sw on"');
    expect(html).not.toContain('data-funnel="Other"');
    const lanes = [...html.matchAll(/data-funnel="([^"]+)"/g)].map((match) => match[1]);
    expect(lanes).toEqual(LANE_ORDER.filter((lane) => lane.name !== "Other").map((lane) => lane.name));
    expect(html).toContain("2 of 8 on in LoyalSnap");
    expect(html).toContain("8 of 10 on in LoyalSnap");
    expect(html).toContain("0 of 8 on in LoyalSnap");
    expect(html).toContain("0 of 8 on here");
    expect(html).toContain("1 of 5 on in LoyalSnap");
    expect(html).toContain("All 72 automations are <b>off</b> here. 13 are on in LoyalSnap today");
    expect(html).toContain("2+ visits / 14d");
    expect(html).toContain("Under 3 credits");
    expect(html).toContain("Expiry −3d");
    expect(html).toContain("Is now a better time?");
    expect(html).not.toContain("LoyalSnap template Leads followup");
    expect(html).toContain("Congrats on completing your 99th class!");
    expect(html).toMatch(/class="step" data-key="lead-immediate"/);
    expect(html).toMatch(/class="step unused" data-key="lead-day-2-text"/);
    expect(html).toMatch(/class="step unused" data-key="red-flag-under-3-credits"/);
    expect(html).toContain('action="/automations/1/toggle"');
    expect(html).toContain('aria-label="Switch on"');
    expect(html).toContain('data-funnel="LEAD FUNNEL" open');
    expect(html).toContain('data-funnel="CLASSPASS" open');
    expect(html).not.toContain('data-funnel="LAPSED CLIENT FUNNEL" open');
    expect(html).not.toContain('data-funnel="BIRTHDAY" open');
    expect(html).toContain(".track{flex-direction:column");
    expect(html).toContain(".conn::before");
    const packs = html.indexOf('data-funnel="CLASS PACKS FUNNEL"');
    const redFlag = html.indexOf('data-key="red-flag-under-3-credits"');
    const classPass = html.indexOf('data-funnel="CLASSPASS"');
    expect(packs).toBeGreaterThan(-1);
    expect(packs).toBeLessThan(redFlag);
    expect(redFlag).toBeLessThan(classPass);
  });

  it("places an automation with no funnel in Other, once", async () => {
    const sqlite = openSqlite();
    const repo = new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
    const id = await repo.nextAutomationId();
    await repo.createAutomation(blankAutomation(id, "custom-step", "Custom step"));
    const html = await automationsHtml(sqlite);
    expect(stepKeys(html)).toEqual([...LANE_STEPS.map((step) => step.key), "custom-step"]);
    const other = html.slice(html.indexOf('data-funnel="Other"'));
    expect(other).toContain('data-key="custom-step"');
    expect(other).not.toContain('data-key="lead-immediate"');
    expect(html).not.toContain('class="sw on"');
  });

  it("keeps the lane when the switch is flipped, and reseeding does not turn it back", async () => {
    const repo = testRepo();
    expect((await repo.listAutomations()).every((row) => row.enabled === false)).toBe(true);
    await repo.toggleAutomation(1);
    const flipped = await repo.getAutomation(1);
    expect(flipped?.enabled).toBe(true);
    expect(flipped?.funnel).toBe("LEAD FUNNEL");
    expect(flipped?.position).toBe(1);
    expect(flipped?.timingLabel).toBe("Day 0");
    await repo.ensureSeed();
    const kept = await repo.getAutomation(1);
    expect(kept?.enabled).toBe(true);
    expect(kept?.funnel).toBe("LEAD FUNNEL");
    const html = await automationsHtml();
    const fresh = openSqlite();
    const freshRepo = new Repo(d1Database(asD1(fresh)), () => "2026-10-11T00:00:00.000Z");
    await freshRepo.toggleAutomation(1);
    const page = await automationsHtml(fresh);
    expect(page.match(/class="sw on"/g)).toHaveLength(1);
    expect(page).toContain("1 of 8 on here");
    expect(page).toMatch(/class="step" data-key="lead-immediate"/);
    expect(stepKeys(page).filter((key) => key === "lead-immediate")).toHaveLength(1);
    expect(html).not.toContain('class="sw on"');
  });
});
