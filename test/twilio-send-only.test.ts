import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { settingsPage } from "../src/http/pages";
import type { PublicSettings } from "../src/settings/service";
import { TwilioClient } from "../src/twilio/client";

const ROOTS = ["src", "packages/contacts-core/src", "scripts"];
const CODE = new Set([".ts", ".js", ".mjs", ".sh", ".jsonc"]);

const FORBIDDEN = [
  "IncomingPhoneNumbers",
  "messaging.twilio.com",
  "/v1/Services",
  "SmsUrl",
  "VoiceUrl",
  "StatusCallback",
];

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) {
      found.push(...filesUnder(path));
      continue;
    }
    const dot = name.lastIndexOf(".");
    if (dot >= 0 && CODE.has(name.slice(dot))) found.push(path);
  }
  return found;
}

function settings(): PublicSettings {
  return {
    listmonk: { baseUrl: "https://campaigns.example", apiUser: "", connected: false, lastCheckedAt: null, templateCount: null },
    twilio: { connected: true, fromNumber: "+61400000000", senderName: "BalanceMoves", fromMode: "number" },
    defaultFromEmail: "bondi@balancemoves.com.au",
    defaultFromName: "Balance Moves",
    defaultReplyTo: "bondi@balancemoves.com.au",
    appendReplyStop: false,
    quietAction: "hold",
    smsQuietHours: { start: "20:00", end: "09:00", timeZone: "Australia/Sydney" },
    mindbody: { month: "2026-10", calls: 0, alertAt: 4000, cap: 5000, alert: false, atCap: false, callers: [] },
  };
}

describe("Twilio stays send-only", () => {
  it("fails if code references number or messaging-service update endpoints", () => {
    const hits: string[] = [];
    for (const file of ROOTS.flatMap(filesUnder)) {
      const text = readFileSync(file, "utf8");
      for (const token of FORBIDDEN) {
        if (text.includes(token)) hits.push(`${file} references ${token}`);
      }
      if (text.includes("api.twilio.com") && !text.includes("/Messages.json")) {
        hits.push(`${file} calls api.twilio.com without /Messages.json`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("sends with POST /Messages.json and no webhook fields", async () => {
    const calls: { url: string; method: string; body: string }[] = [];
    const client = new TwilioClient(
      { accountSid: "AC123", authToken: "auth", fromNumber: "+61411112222", senderName: "", fromMode: "number" },
      async (input, init) => {
        calls.push({ url: String(input), method: String(init?.method), body: String(init?.body ?? "") });
        return new Response("{}", { status: 201 });
      },
    );
    await client.sendSms({ to: "+61400000000", body: "Hello" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe("POST");
    expect(calls[0]?.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    const params = new URLSearchParams(calls[0]?.body);
    expect([...params.keys()].sort()).toEqual(["Body", "From", "To"]);
  });

  it("tells owners on Settings that the incoming webhook belongs to Chatwoot", () => {
    const html = settingsPage(settings(), null, null);
    expect(html).toContain("POST /Messages.json only");
    expect(html).toContain("incoming-message webhook belongs to Chatwoot");
  });
});
