import { describe, expect, it } from "vitest";
import { gateSend } from "../src/automations/gate";
import { parseDevMode, parsePhoneList } from "../src/env";

const base = {
  devMode: true,
  dryRun: false,
  enabled: true,
  emailAllowlist: ["bondi@balancemoves.com.au"],
  phoneAllowlist: ["+61400000000"],
  alreadySent: false,
  suppressed: false,
  withinQuietHours: false,
};

describe("dev allowlist", () => {
  it("defaults dev mode on", () => {
    expect(parseDevMode(undefined)).toBe(true);
    expect(parseDevMode("")).toBe(true);
    expect(parseDevMode("false")).toBe(false);
  });

  it("skips an email that is not allowlisted and sends one that is", () => {
    expect(gateSend({ ...base, channel: "email", email: "Ada@Example.com", phone: null }).reason).toBe("dev_allowlist");
    const sent = gateSend({ ...base, channel: "email", email: "Bondi@balancemoves.com.au", phone: null });
    expect(sent.outcome).toBe("send");
    expect(sent.listmonkCall).toBe(true);
  });

  it("normalises Australian mobiles onto the phone allowlist", () => {
    expect(parsePhoneList("0400 000 000, bondi@balancemoves.com.au")).toEqual(["+61400000000"]);
    const skipped = gateSend({ ...base, channel: "sms", email: null, phone: "+61411111111" });
    expect(skipped.reason).toBe("dev_allowlist");
    expect(skipped.terminal).toBe(false);
    const sent = gateSend({ ...base, channel: "sms", email: null, phone: "0400 000 000" });
    expect(sent.twilioCall).toBe(true);
    expect(sent.phone).toBe("+61400000000");
  });

  it("holds an allowlisted text during quiet hours", () => {
    const held = gateSend({ ...base, channel: "sms", email: null, phone: "+61400000000", withinQuietHours: true });
    expect(held.reason).toBe("quiet_hours");
    expect(held.terminal).toBe(false);
    expect(held.twilioCall).toBe(false);
  });

  it("does not call a provider when the automation is off", () => {
    const held = gateSend({ ...base, enabled: false, channel: "email", email: "bondi@balancemoves.com.au", phone: null });
    expect(held.reason).toBe("automation_disabled");
    expect(held.listmonkCall).toBe(false);
  });
});
