import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDeps } from "../src/deps";
import { TwilioClient } from "../src/twilio/client";

// Mimic the Workers runtime: fetch rejects any `this` other than undefined/globalThis.
function strictFetch(this: unknown): Promise<Response> {
  if (this !== undefined && this !== globalThis) throw new TypeError("Illegal invocation");
  return Promise.resolve(new Response(JSON.stringify({ sid: "SM1" }), { status: 201 }));
}

describe("fetch binding", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("bare fetch as a method throws (reproduces the bug)", () => {
    vi.stubGlobal("fetch", strictFetch);
    const broken = { fetchImpl: globalThis.fetch };
    expect(() => broken.fetchImpl("https://example.test")).toThrow("Illegal invocation");
  });

  it("defaultDeps().fetchImpl works when called as a method", async () => {
    vi.stubGlobal("fetch", strictFetch);
    const deps = defaultDeps();
    const res = await deps.fetchImpl("https://example.test");
    expect(res.status).toBe(201);
  });

  it("TwilioClient can call this.fetchImpl with defaultDeps", () => {
    vi.stubGlobal("fetch", strictFetch);
    const client = new TwilioClient(
      { accountSid: "AC1", authToken: "t", fromNumber: "+61400000000", senderName: "", fromMode: "number" } as never,
      defaultDeps().fetchImpl,
    );
    const call = (client as unknown as { fetchImpl: typeof fetch }).fetchImpl("https://example.test");
    return expect(call).resolves.toBeInstanceOf(Response);
  });
});
