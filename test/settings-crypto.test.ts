import { describe, expect, it } from "vitest";
import { runtimeConfig } from "../src/env";
import { decryptSecret, encryptSecret } from "../src/settings/crypto";
import { readPublicSettings, writeSettings } from "../src/settings/service";
import { testRepo } from "./helpers";

describe("settings encryption", () => {
  it("round-trips a secret and keeps it out of the public settings", async () => {
    const cipher = await encryptSecret("super-secret-token", "settings-key");
    expect(cipher.startsWith("v1.")).toBe(true);
    expect(await decryptSecret(cipher, "settings-key")).toBe("super-secret-token");
    expect(await decryptSecret(cipher, "wrong")).toBeNull();

    const repo = testRepo();
    const config = runtimeConfig({
      SETTINGS_ENCRYPTION_KEY: "settings-key",
      SMS_QUIET_START: "20:00",
      SMS_QUIET_END: "09:00",
    });
    await writeSettings(repo, config, {
      listmonk: { baseUrl: "https://campaigns.balancemoves.com.au", apiUser: "api-user", apiToken: "super-secret-token" },
      twilio: { accountSid: "AC123secret", authToken: "twilio-auth", fromNumber: "+61400000000", senderName: "Balance" },
    });
    const pub = await readPublicSettings(repo, config);
    const body = JSON.stringify(pub);
    expect(pub.listmonk.connected).toBe(true);
    expect(pub.twilio.connected).toBe(true);
    expect(pub.twilio.fromNumber).toBe("+61400000000");
    expect(body).not.toContain("super-secret-token");
    expect(body).not.toContain("twilio-auth");
    expect(body).not.toContain("AC123secret");
    expect(body).not.toContain("v1.");
  });
});
