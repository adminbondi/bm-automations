import { describe, expect, it } from "vitest";
import { testRepo } from "./helpers";

describe("send log dedupe", () => {
  it("allows another attempt after a non-sent row and rejects a second sent row", async () => {
    const repo = testRepo();
    const input = {
      dedupeKey: "automation:1:client:100",
      automationId: 1,
      clientId: "100",
      channel: "email" as const,
      templateId: 5,
      email: "ada@example.com",
      phone: null,
      detail: null,
    };
    expect(await repo.recordSend({ ...input, status: "skipped_dev_allowlist" })).toBe("inserted");
    expect(await repo.recordSend({ ...input, status: "skipped_dev_allowlist" })).toBe("inserted");
    expect(await repo.recordSend({ ...input, status: "sent" })).toBe("inserted");
    expect(await repo.hasSent(input.dedupeKey)).toBe(true);
    expect(await repo.recordSend({ ...input, status: "sent" })).toBe("duplicate");
  });
});
