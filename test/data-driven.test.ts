import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planAutomations, type PlanFacts } from "../src/pipeline/plan";
import { testRepo } from "./helpers";

describe("rules come from the row", () => {
  it("does not branch on automation id and uses the stored template and text", async () => {
    const source = readFileSync("src/automations/engine.ts", "utf8");
    expect(source.includes("automation.id ===")).toBe(false);
    const repo = testRepo();
    await repo.updateAutomation(1, { templateId: 99 });
    await repo.updateAutomation(10, { messageText: "Hello [First name] from [Studio]" });
    const automations = await repo.listAutomations();
    const facts: PlanFacts = {
      eventId: "client.created",
      todaySydney: "2026-10-11",
      anchorSydney: "2026-10-11",
      dueOn: null,
      signedInStatus: null,
      triggeringContractName: null,
      candidatePackageNames: [],
      waiverSigned: false,
      suppressed: false,
      services: [],
      visits: [],
      serviceCount: 0,
      contracts: [],
      visitCrossingRecorded: false,
      windowAlreadyMatched: false,
      clientId: "100",
      email: "ada@example.com",
      phone: null,
      firstName: "Ada",
      lastName: null,
      studioName: "Balance Moves",
      devMode: true,
      dryRun: true,
      emailAllowlist: [],
      phoneAllowlist: [],
      alreadySentKeys: new Set(),
      listmonkBaseUrl: "https://campaigns.balancemoves.com.au",
      withinQuietHours: false,
    };
    const lead = planAutomations(automations, facts).find((plan) => plan.automation.id === 1);
    expect(lead?.templateId).toBe(99);
    const saleFacts: PlanFacts = {
      ...facts,
      eventId: "clientSale.created",
      candidatePackageNames: ["2 Week Intro Pass"],
    };
    const text = planAutomations(automations, saleFacts).find((plan) => plan.automation.id === 10);
    expect(text?.decision.messageText).toBe("Hello [First name] from [Studio]");
    expect(text?.renderedMessage).toBe("Hello Ada from Balance Moves");
  });
});
