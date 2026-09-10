import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (...args: unknown[]) => fromMock(...args),
  }),
}));

import {
  parseBasicAuthorizationHeader,
  plannerHistoryCredentialsMatch,
  readPlannerHistoryExportConfig,
} from "@/lib/gpsPlanner/plannerHistoryAuth";
import { loadPlannerHistoryExport } from "@/lib/gpsPlanner/plannerHistoryExport.server";
import { GET } from "@/app/api/powerbi/planner-history/route";

const USER = "pbi-export";
const PASS = "export-secret";

const ALLOWED_ROW_KEYS = [
  "week_id",
  "powerbi_week_id",
  "start_date",
  "end_date",
  "player_id",
  "powerbi_player_name",
  "td_best",
  "hsr_best",
  "sprint_best",
  "acc_best",
  "dec_best",
] as const;

function basicHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`, "utf8").toString("base64")}`;
}

function snapshotJoin(input: {
  weekId: string;
  playerId: string;
  name: string;
  start: string;
  weekLabel: string;
  td?: number;
}) {
  return {
    week_id: input.weekId,
    player_id: input.playerId,
    powerbi_player_name: input.name,
    td_best: input.td ?? 100,
    hsr_best: 10,
    sprint_best: 2,
    acc_best: 3,
    dec_best: 4,
    planner_weeks: {
      powerbi_week_id: input.weekLabel,
      start_date: input.start,
      end_date: "2026-03-15",
    },
  };
}

describe("planner history auth helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when env is missing", () => {
    vi.stubEnv("POWERBI_PLANNER_EXPORT_USERNAME", "");
    vi.stubEnv("POWERBI_PLANNER_EXPORT_PASSWORD", "");
    expect(readPlannerHistoryExportConfig().ok).toBe(false);
  });

  it("parses Basic credentials and compares without leaking", () => {
    const parsed = parseBasicAuthorizationHeader(basicHeader("u", "p:extra"));
    expect(parsed).toEqual({ username: "u", password: "p:extra" });
    expect(
      plannerHistoryCredentialsMatch(
        { username: "u", password: "p:extra" },
        { username: "u", password: "p:extra" }
      )
    ).toBe(true);
    expect(
      plannerHistoryCredentialsMatch(
        { username: "u", password: "nope" },
        { username: "u", password: "p:extra" }
      )
    ).toBe(false);
  });
});

describe("loadPlannerHistoryExport", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("returns snapshot rows without Weekly Target filtering and with stable sort", async () => {
    const select = vi.fn();
    fromMock.mockImplementation((table: string) => {
      expect(table).toBe("planner_match_best_snapshots");
      const api: Record<string, unknown> = {};
      api.select = select.mockImplementation(() => ({
        then: (resolve: (v: unknown) => unknown) =>
          resolve({
            data: [
              snapshotJoin({
                weekId: "w-b",
                playerId: "p2",
                name: "Zed",
                start: "2026-03-09",
                weekLabel: "W6",
              }),
              snapshotJoin({
                weekId: "w-a",
                playerId: "p1",
                name: "Ann",
                start: "2026-03-02",
                weekLabel: "W5",
              }),
              snapshotJoin({
                weekId: "w-b",
                playerId: "p1",
                name: "Ann",
                start: "2026-03-09",
                weekLabel: "W6",
              }),
            ],
            error: null,
          }),
      }));
      api.insert = vi.fn(() => {
        throw new Error("insert");
      });
      api.update = vi.fn(() => {
        throw new Error("update");
      });
      api.delete = vi.fn(() => {
        throw new Error("delete");
      });
      return api;
    });

    const result = await loadPlannerHistoryExport();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(select.mock.calls[0]?.[0]).not.toMatch(/weekly_target/i);
    expect(result.data.rows.map((row) => [row.start_date, row.powerbi_player_name])).toEqual([
      ["2026-03-02", "Ann"],
      ["2026-03-09", "Ann"],
      ["2026-03-09", "Zed"],
    ]);
    const keys = new Set(result.data.rows.flatMap((row) => Object.keys(row)));
    expect([...keys].sort()).toEqual([...ALLOWED_ROW_KEYS].sort());
    const pairs = result.data.rows.map((row) => `${row.week_id}:${row.player_id}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("drops incomplete snapshot metrics instead of zero-filling", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        then: (resolve: (v: unknown) => unknown) =>
          resolve({
            data: [
              {
                ...snapshotJoin({
                  weekId: "w-a",
                  playerId: "p1",
                  name: "Ann",
                  start: "2026-03-02",
                  weekLabel: "W5",
                }),
                td_best: null,
              },
            ],
            error: null,
          }),
      }),
    }));
    const result = await loadPlannerHistoryExport();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rows).toEqual([]);
  });

  it("does not leak database errors", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        then: (resolve: (v: unknown) => unknown) =>
          resolve({
            data: null,
            error: {
              message: "permission denied for table planner_match_best_snapshots",
              code: "42501",
            },
          }),
      }),
    }));
    await expect(loadPlannerHistoryExport()).resolves.toEqual({ ok: false });
  });
});

describe("GET /api/powerbi/planner-history", () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.stubEnv("POWERBI_PLANNER_EXPORT_USERNAME", USER);
    vi.stubEnv("POWERBI_PLANNER_EXPORT_PASSWORD", PASS);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    fromMock.mockImplementation(() => ({
      select: () => ({
        then: (resolve: (v: unknown) => unknown) =>
          resolve({
            data: [
              snapshotJoin({
                weekId: "w-a",
                playerId: "p1",
                name: "Ann",
                start: "2026-03-02",
                weekLabel: "W5",
              }),
            ],
            error: null,
          }),
      }),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 with correct auth", async () => {
    const response = await GET(
      new Request("http://localhost/api/powerbi/planner-history", {
        headers: { Authorization: basicHeader(USER, PASS) },
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as {
      schema_version: number;
      generated_at: string;
      rows: Record<string, unknown>[];
    };
    expect(body.schema_version).toBe(1);
    expect(body.generated_at).toMatch(/^\d{4}-/);
    expect(body.rows).toHaveLength(1);
    expect(Object.keys(body.rows[0] ?? {}).sort()).toEqual(
      [...ALLOWED_ROW_KEYS].sort()
    );
    expect(JSON.stringify(body)).not.toMatch(/email|password|Authorization|service-role/i);
  });

  it("returns 401 when auth is missing", async () => {
    const response = await GET(
      new Request("http://localhost/api/powerbi/planner-history")
    );
    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: "Authentication required." });
  });

  it("returns 401 when auth is wrong", async () => {
    const response = await GET(
      new Request("http://localhost/api/powerbi/planner-history", {
        headers: { Authorization: basicHeader(USER, "wrong") },
      })
    );
    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("fails closed when export env is missing", async () => {
    vi.stubEnv("POWERBI_PLANNER_EXPORT_USERNAME", "");
    vi.stubEnv("POWERBI_PLANNER_EXPORT_PASSWORD", "");
    const response = await GET(
      new Request("http://localhost/api/powerbi/planner-history", {
        headers: { Authorization: basicHeader(USER, PASS) },
      })
    );
    expect(response.status).toBe(503);
    expect(fromMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: "Export is not configured." });
  });

  it("does not leak database errors to the client", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        then: (resolve: (v: unknown) => unknown) =>
          resolve({
            data: null,
            error: { message: "JWT service_role leaked here", code: "XX" },
          }),
      }),
    }));
    const response = await GET(
      new Request("http://localhost/api/powerbi/planner-history", {
        headers: { Authorization: basicHeader(USER, PASS) },
      })
    );
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toBe(JSON.stringify({ error: "Could not load planner history." }));
    expect(body).not.toMatch(/JWT|service_role|snapshot/i);
  });

  it("does not modify data", async () => {
    const insert = vi.fn();
    const update = vi.fn();
    const del = vi.fn();
    fromMock.mockImplementation(() => ({
      select: () => ({
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: [], error: null }),
      }),
      insert,
      update,
      delete: del,
    }));
    const response = await GET(
      new Request("http://localhost/api/powerbi/planner-history", {
        headers: { Authorization: basicHeader(USER, PASS) },
      })
    );
    expect(response.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});
