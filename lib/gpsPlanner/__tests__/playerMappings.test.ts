import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getAppUser = vi.fn();
const executePowerBiDaxQuery = vi.fn();

vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
  isAdmin: (role: string) => role === "admin",
}));

vi.mock("@/lib/powerbi/client.server", () => ({
  executePowerBiDaxQuery: (...args: unknown[]) => executePowerBiDaxQuery(...args),
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (...args: unknown[]) => fromMock(...args) }),
}));

import {
  createPlayerMapping,
  deletePlayerMapping,
  getPlayerMapping,
  listPlayerMappings,
  listPowerBiPlayerCandidates,
  normalizeExternalPlayerName,
  updatePlayerMapping,
} from "@/lib/gpsPlanner/playerMappings.server";
import { getPowerBiPlayerCandidates } from "@/lib/powerbi/queries/playerNames.server";

const ADMIN = { id: "11111111-1111-4111-8111-111111111111", email: "a@t.com", role: "admin" as const };
const STAFF = { id: "22222222-2222-4222-8222-222222222222", email: "s@t.com", role: "staff" as const };
const PLAYER = { id: "33333333-3333-4333-8333-333333333333", email: "p@t.com", role: "player" as const };
const PLAYER_ID = "44444444-4444-4444-8444-444444444444";

function okRows(rows: Record<string, unknown>[]) {
  return { ok: true as const, results: [{ tables: [{ rows }] }] };
}

function chain(result: { data: unknown; error: unknown }, opts?: { single?: boolean; maybeSingle?: boolean }) {
  const api: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: undefined,
  };
  if (opts?.single) {
    api.single = vi.fn().mockResolvedValue(result);
  } else if (opts?.maybeSingle) {
    api.maybeSingle = vi.fn().mockResolvedValue(result);
  } else {
    // terminal thenable for await supabase.from()...order()
    Object.assign(api, {
      then: (resolve: (v: unknown) => unknown) => resolve(result),
    });
  }
  // Make nested calls return same chain
  for (const key of ["select", "eq", "in", "order", "insert", "update", "delete"]) {
    (api[key] as ReturnType<typeof vi.fn>).mockImplementation(() => api);
  }
  return api;
}

describe("normalizeExternalPlayerName", () => {
  it("rejects whitespace-only input without rewriting identities for storage", () => {
    expect(normalizeExternalPlayerName("   ")).toBeNull();
    // Emptiness gate only — create/update must store candidate.playerName, not this value.
    expect(normalizeExternalPlayerName("  Gabriel  Pacurar  ")).toBe(
      "  Gabriel  Pacurar  "
    );
  });
});

describe("getPowerBiPlayerCandidates", () => {
  beforeEach(() => {
    executePowerBiDaxQuery.mockReset();
  });

  it("merges GPS and Match Best names with flags", async () => {
    executePowerBiDaxQuery
      .mockResolvedValueOnce(okRows([{ "[Player]": "Carl Davordzie" }, { Player: "Victor Daguin" }]))
      .mockResolvedValueOnce(okRows([{ Player: "Carl Davordzie" }, { Player: "Joonas Tamm" }]));

    const result = await getPowerBiPlayerCandidates();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([
      { playerName: "Carl Davordzie", hasTrainingData: true, hasMatchBest: true },
      { playerName: "Joonas Tamm", hasTrainingData: false, hasMatchBest: true },
      { playerName: "Victor Daguin", hasTrainingData: true, hasMatchBest: false },
    ]);
    const matchDax = executePowerBiDaxQuery.mock.calls[1][0] as string;
    expect(matchDax).toContain('Match_Benchmark[Method] = "single-match best"');
  });

  it("returns connector error safely", async () => {
    executePowerBiDaxQuery.mockResolvedValueOnce({
      ok: false,
      error: { code: "auth_failed", message: "token failed" },
    });

    const result = await getPowerBiPlayerCandidates();
    expect(result).toEqual({
      ok: false,
      error: { code: "auth_failed", message: "token failed" },
    });
  });

  it("returns empty list when both sources empty", async () => {
    executePowerBiDaxQuery
      .mockResolvedValueOnce(okRows([]))
      .mockResolvedValueOnce(okRows([]));
    const result = await getPowerBiPlayerCandidates();
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe("playerMappings auth", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    executePowerBiDaxQuery.mockReset();
  });

  it("rejects unauthenticated", async () => {
    getAppUser.mockResolvedValue(null);
    await expect(listPlayerMappings()).resolves.toEqual({
      ok: false,
      error: { code: "unauthorized", message: "Authentication required." },
    });
  });

  it("rejects staff", async () => {
    getAppUser.mockResolvedValue(STAFF);
    await expect(listPlayerMappings()).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
  });

  it("rejects player", async () => {
    getAppUser.mockResolvedValue(PLAYER);
    await expect(createPlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "Carl Davordzie",
    })).resolves.toMatchObject({
      ok: false,
      error: { code: "unauthorized" },
    });
  });
});

describe("playerMappings CRUD", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
    executePowerBiDaxQuery.mockReset();
    getAppUser.mockResolvedValue(ADMIN);
  });

  function mockCandidates(names: string[]) {
    executePowerBiDaxQuery
      .mockResolvedValueOnce(okRows(names.map((n) => ({ Player: n }))))
      .mockResolvedValueOnce(okRows(names.map((n) => ({ Player: n }))));
  }

  it("lists mappings with display names", async () => {
    const mappingChain = chain({
      data: [
        {
          id: "m1",
          player_id: PLAYER_ID,
          provider: "powerbi",
          external_player_name: "Carl Davordzie",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
      ],
      error: null,
    });
    const profilesChain = chain({
      data: [{ id: PLAYER_ID, full_name: "Carl D", email: "c@t.com" }],
      error: null,
    });
    fromMock.mockImplementation((table: string) =>
      table === "player_external_mappings" ? mappingChain : profilesChain
    );

    const result = await listPlayerMappings();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0]).toMatchObject({
      playerId: PLAYER_ID,
      externalPlayerName: "Carl Davordzie",
      playerDisplayName: "Carl D",
      provider: "powerbi",
    });
  });

  it("gets mapping for player", async () => {
    const mappingChain = chain(
      {
        data: {
          id: "m1",
          player_id: PLAYER_ID,
          provider: "powerbi",
          external_player_name: "Carl Davordzie",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
        },
        error: null,
      },
      { maybeSingle: true }
    );
    const profilesChain = chain({
      data: [{ id: PLAYER_ID, full_name: "Carl D", email: null }],
      error: null,
    });
    fromMock.mockImplementation((table: string) =>
      table === "player_external_mappings" ? mappingChain : profilesChain
    );

    const result = await getPlayerMapping(PLAYER_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.externalPlayerName).toBe("Carl Davordzie");
  });

  it("creates mapping storing exact Power BI candidate.playerName (not trimmed reconstruction)", async () => {
    const exactName = "Gabriel  Pacurar";
    mockCandidates([exactName]);

    const insertCapture: {
      payload: { external_player_name?: string } | null;
    } = { payload: null };
    const insertChain = {
      insert: vi.fn((payload: { external_player_name?: string }) => {
        insertCapture.payload = payload;
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "m1",
                player_id: PLAYER_ID,
                provider: "powerbi",
                external_player_name: exactName,
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-01T00:00:00Z",
              },
              error: null,
            }),
          }),
        };
      }),
    };

    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: PLAYER_ID, role: "player" },
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: [{ id: PLAYER_ID, full_name: "Gabriel", email: null }],
              error: null,
            }),
          }),
        };
      }
      return insertChain;
    });

    const result = await createPlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: `  ${exactName}  `,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.externalPlayerName).toBe(exactName);
    expect(insertCapture.payload?.external_player_name).toBe(exactName);
    expect(insertCapture.payload?.external_player_name).not.toBe(`  ${exactName}  `);
  });

  it("rejects case-changed Power BI guesses", async () => {
    mockCandidates(["Gabriel  Pacurar"]);
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: PLAYER_ID, role: "player" },
            error: null,
          }),
        }),
      }),
    }));

    const result = await createPlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "gabriel  pacurar",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "external_player_not_found" },
    });
  });

  it("creates mapping when admin, player valid, and Power BI name known", async () => {
    mockCandidates(["Carl Davordzie"]);

    const insertChain = chain(
      {
        data: {
          id: "m1",
          player_id: PLAYER_ID,
          provider: "powerbi",
          external_player_name: "Carl Davordzie",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
        error: null,
      },
      { single: true }
    );

    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: PLAYER_ID, role: "player" },
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: [{ id: PLAYER_ID, full_name: "Carl", email: null }],
              error: null,
            }),
          }),
        };
      }
      return insertChain;
    });

    const result = await createPlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "Carl Davordzie",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.externalPlayerName).toBe("Carl Davordzie");
  });

  it("rejects unknown Power BI player", async () => {
    mockCandidates(["Carl Davordzie"]);
    fromMock.mockImplementation(() =>
      chain(
        { data: { id: PLAYER_ID, role: "player" }, error: null },
        { maybeSingle: true }
      )
    );

    // profiles select for requirePlayerProfile
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: PLAYER_ID, role: "player" },
            error: null,
          }),
        }),
      }),
    }));

    const result = await createPlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "Unknown Player",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "external_player_not_found" },
    });
  });

  it("rejects non-player profile", async () => {
    mockCandidates(["Carl Davordzie"]);
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: PLAYER_ID, role: "staff" },
            error: null,
          }),
        }),
      }),
    }));

    const result = await createPlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "Carl Davordzie",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "not_a_player" },
    });
  });

  it("rejects missing profile", async () => {
    mockCandidates(["Carl Davordzie"]);
    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));

    const result = await createPlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "Carl Davordzie",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "player_not_found" },
    });
  });

  it("maps duplicate player unique violation", async () => {
    mockCandidates(["Carl Davordzie"]);
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: PLAYER_ID, role: "player" },
                error: null,
              }),
            }),
          }),
        };
      }
      return chain(
        {
          data: null,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "player_external_mappings_provider_player_id_key"',
          },
        },
        { single: true }
      );
    });

    const result = await createPlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "Carl Davordzie",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "player_already_mapped" },
    });
  });

  it("maps duplicate external identity unique violation", async () => {
    mockCandidates(["Carl Davordzie"]);
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: PLAYER_ID, role: "player" },
                error: null,
              }),
            }),
          }),
        };
      }
      return chain(
        {
          data: null,
          error: {
            code: "23505",
            message:
              'duplicate key value violates unique constraint "player_external_mappings_provider_external_player_name_key"',
          },
        },
        { single: true }
      );
    });

    const result = await createPlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "Carl Davordzie",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "external_player_already_mapped" },
    });
  });

  it("updates mapping", async () => {
    mockCandidates(["Joonas Tamm"]);
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: PLAYER_ID, role: "player" },
                error: null,
              }),
            }),
            in: vi.fn().mockResolvedValue({
              data: [{ id: PLAYER_ID, full_name: "Carl", email: null }],
              error: null,
            }),
          }),
        };
      }
      return chain(
        {
          data: {
            id: "m1",
            player_id: PLAYER_ID,
            provider: "powerbi",
            external_player_name: "Joonas Tamm",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-03T00:00:00Z",
          },
          error: null,
        },
        { maybeSingle: true }
      );
    });

    const result = await updatePlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "Joonas Tamm",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.externalPlayerName).toBe("Joonas Tamm");
  });

  it("returns mapping_not_found on update miss", async () => {
    mockCandidates(["Carl Davordzie"]);
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: PLAYER_ID, role: "player" },
                error: null,
              }),
            }),
          }),
        };
      }
      return chain({ data: null, error: null }, { maybeSingle: true });
    });

    const result = await updatePlayerMapping({
      playerId: PLAYER_ID,
      externalPlayerName: "Carl Davordzie",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "mapping_not_found" },
    });
  });

  it("deletes mapping", async () => {
    fromMock.mockImplementation(() =>
      chain({ data: { player_id: PLAYER_ID }, error: null }, { maybeSingle: true })
    );
    const result = await deletePlayerMapping(PLAYER_ID);
    expect(result).toEqual({ ok: true, data: { playerId: PLAYER_ID } });
  });

  it("returns mapping_not_found on delete miss", async () => {
    fromMock.mockImplementation(() =>
      chain({ data: null, error: null }, { maybeSingle: true })
    );
    const result = await deletePlayerMapping(PLAYER_ID);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "mapping_not_found" },
    });
  });

  it("surfaces database_error safely", async () => {
    fromMock.mockImplementation(() =>
      chain({
        data: null,
        error: { code: "42P01", message: "relation missing" },
      })
    );
    const result = await listPlayerMappings();
    expect(result).toMatchObject({
      ok: false,
      error: { code: "database_error", message: "Could not complete mapping operation." },
    });
  });

  it("surfaces powerbi_error for candidate listing", async () => {
    executePowerBiDaxQuery.mockResolvedValue({
      ok: false,
      error: { code: "http_error", message: "boom" },
    });
    const result = await listPowerBiPlayerCandidates();
    expect(result).toMatchObject({
      ok: false,
      error: { code: "powerbi_error" },
    });
  });
});
