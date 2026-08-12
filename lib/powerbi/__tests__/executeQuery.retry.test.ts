import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/powerbi/config.server", () => ({
  getPowerBiConfig: () => ({
    ok: true,
    config: {
      tenantId: "t",
      clientId: "c",
      clientSecret: "s",
      workspaceId: "ws",
      datasetId: "ds",
    },
  }),
}));

vi.mock("@/lib/powerbi/auth.server", () => ({
  getPowerBiAccessToken: async () => ({
    ok: true,
    accessToken: "token",
  }),
}));

import {
  executePowerBiDaxQuery,
  isTransientPowerBiHttpStatus,
} from "@/lib/powerbi/executeQuery.server";

function jsonResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...(headers ?? {}) },
  });
}

describe("executePowerBiDaxQuery transient retry", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("classifies 429 and 5xx as transient", () => {
    expect(isTransientPowerBiHttpStatus(429)).toBe(true);
    expect(isTransientPowerBiHttpStatus(503)).toBe(true);
    expect(isTransientPowerBiHttpStatus(400)).toBe(false);
    expect(isTransientPowerBiHttpStatus(401)).toBe(false);
  });

  it("retries once after 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { error: "throttled" }, { "Retry-After": "0" })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { results: [{ tables: [{ rows: [{ TD: 1 }] }] }] })
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const pending = executePowerBiDaxQuery("EVALUATE ROW(\"x\", 1)");
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops after bounded retries on repeated 500", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(500, { error: "server" }));
    globalThis.fetch = fetchMock as typeof fetch;

    const pending = executePowerBiDaxQuery("EVALUATE ROW(\"x\", 1)");
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("query_failed");
    // initial + 2 retries
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a successful empty result set", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { results: [{ tables: [{ rows: [] }] }] }));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await executePowerBiDaxQuery("EVALUATE ROW(\"x\", 1)");
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-transient 400", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(400, { error: "bad" }));
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await executePowerBiDaxQuery("EVALUATE ROW(\"x\", 1)");
    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
