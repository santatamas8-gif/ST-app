import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppUser = vi.fn();
vi.mock("@/lib/auth", () => ({
  getAppUser: (...args: unknown[]) => getAppUser(...args),
}));

const fromMock = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (...args: unknown[]) => fromMock(...args) }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { POST as createMatch } from "@/app/api/kiosk-match/create/route";
import { POST as addParticipants } from "@/app/api/kiosk-match/add-participants/route";
import { POST as deleteMatch } from "@/app/api/kiosk-match/delete/route";
import { POST as submitMatch } from "@/app/api/kiosk-match/submit/route";

const ADMIN = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "admin@t.com",
  role: "admin" as const,
};
const STAFF = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  email: "staff@t.com",
  role: "staff" as const,
};
const PLAYER = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  email: "player@t.com",
  role: "player" as const,
};
const PLAYER_A = "11111111-1111-4111-8111-111111111111";
const PLAYER_B = "22222222-2222-4222-8222-222222222222";
const MATCH_ID = "44444444-4444-4444-8444-444444444444";
const RESPONSE_ID = "55555555-5555-4555-8555-555555555555";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/kiosk-match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function chain(result: { data: unknown; error: unknown }, mode: "maybeSingle" | "single" | "then") {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const key of ["select", "eq", "in", "insert", "update", "delete"]) {
    api[key] = vi.fn(self);
  }
  if (mode === "maybeSingle") {
    api.maybeSingle = vi.fn().mockResolvedValue(result);
  } else if (mode === "single") {
    api.single = vi.fn().mockResolvedValue(result);
  } else {
    Object.assign(api, {
      then: (resolve: (v: unknown) => unknown) => resolve(result),
    });
  }
  return api;
}

describe("POST /api/kiosk-match/create auth", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
  });

  it("rejects unauthenticated create with 401", async () => {
    getAppUser.mockResolvedValue(null);
    const res = await createMatch(
      jsonRequest({ opponent: "X", matchDate: "2026-08-11", matchday: 1, playerIds: [PLAYER_A] })
    );
    expect(res.status).toBe(401);
  });

  it("rejects staff create with 403", async () => {
    getAppUser.mockResolvedValue(STAFF);
    const res = await createMatch(
      jsonRequest({ opponent: "X", matchDate: "2026-08-11", matchday: 1, playerIds: [PLAYER_A] })
    );
    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects player create with 403", async () => {
    getAppUser.mockResolvedValue(PLAYER);
    const res = await createMatch(
      jsonRequest({ opponent: "X", matchDate: "2026-08-11", matchday: 1, playerIds: [PLAYER_A] })
    );
    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows admin create after verifying player profiles", async () => {
    getAppUser.mockResolvedValue(ADMIN);
    fromMock.mockImplementation((table: string) => {
      if (table === "profiles") {
        return chain({ data: [{ id: PLAYER_A, role: "player" }], error: null }, "then");
      }
      if (table === "match_feedback_matches") {
        return chain({ data: { id: MATCH_ID }, error: null }, "single");
      }
      if (table === "match_feedback_participants") {
        return chain({ data: null, error: null }, "then");
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await createMatch(
      jsonRequest({
        opponent: "FCSB",
        matchDate: "2026-08-11",
        matchday: 4,
        playerIds: [PLAYER_A],
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matchId).toBe(MATCH_ID);
  });
});

describe("POST /api/kiosk-match/add-participants auth", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
  });

  it("rejects unauthenticated add with 401", async () => {
    getAppUser.mockResolvedValue(null);
    const res = await addParticipants(jsonRequest({ matchId: MATCH_ID, playerIds: [PLAYER_B] }));
    expect(res.status).toBe(401);
  });

  it("rejects staff add with 403", async () => {
    getAppUser.mockResolvedValue(STAFF);
    const res = await addParticipants(jsonRequest({ matchId: MATCH_ID, playerIds: [PLAYER_B] }));
    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("allows admin to add players not already on the match", async () => {
    getAppUser.mockResolvedValue(ADMIN);
    fromMock.mockImplementation((table: string) => {
      if (table === "match_feedback_matches") {
        return chain({ data: { id: MATCH_ID }, error: null }, "maybeSingle");
      }
      if (table === "profiles") {
        return chain({ data: [{ id: PLAYER_B, role: "player" }], error: null }, "then");
      }
      if (table === "match_feedback_participants") {
        return chain({ data: [], error: null }, "then");
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await addParticipants(jsonRequest({ matchId: MATCH_ID, playerIds: [PLAYER_B] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.addedPlayerIds).toEqual([PLAYER_B]);
  });
});

describe("POST /api/kiosk-match/submit", () => {
  const validBody = {
    matchId: MATCH_ID,
    playerId: PLAYER_A,
    preMatchFeelings: ["Prepared"],
    physicalDemand: 7,
    performanceRating: 8,
    physicalDropoff: "60–75 min",
    mentalDemand: 6,
  };

  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
  });

  it("rejects player submit with 403", async () => {
    getAppUser.mockResolvedValue(PLAYER);
    const res = await submitMatch(jsonRequest(validBody));
    expect(res.status).toBe(403);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects unselected participant with 400", async () => {
    getAppUser.mockResolvedValue(STAFF);
    fromMock.mockImplementation((table: string) => {
      if (table === "match_feedback_participants") {
        return chain({ data: null, error: null }, "maybeSingle");
      }
      throw new Error(`unexpected table ${table}`);
    });
    const res = await submitMatch(jsonRequest({ ...validBody, playerId: PLAYER_B }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not a participant/i);
  });

  it("inserts first response for a selected participant", async () => {
    getAppUser.mockResolvedValue(STAFF);
    let responseCalls = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "match_feedback_participants") {
        return chain({ data: { player_id: PLAYER_A }, error: null }, "maybeSingle");
      }
      if (table === "match_feedback_responses") {
        responseCalls += 1;
        if (responseCalls === 1) {
          return chain({ data: null, error: null }, "maybeSingle");
        }
        return chain(
          { data: { id: RESPONSE_ID, updated_at: "2026-08-11T10:00:00.000Z" }, error: null },
          "single"
        );
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await submitMatch(jsonRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.responseId).toBe(RESPONSE_ID);
    expect(body.updated).toBe(false);
  });

  it("updates same response id and changes updated_at without resetting created_at", async () => {
    getAppUser.mockResolvedValue(ADMIN);
    const previousUpdatedAt = "2026-08-11T10:00:00.000Z";
    const nextUpdatedAt = "2026-08-11T11:00:00.000Z";
    let updatePayload: Record<string, unknown> | null = null;

    fromMock.mockImplementation((table: string) => {
      if (table === "match_feedback_participants") {
        return chain({ data: { player_id: PLAYER_A }, error: null }, "maybeSingle");
      }
      if (table === "match_feedback_responses") {
        const api: Record<string, unknown> = {};
        const self = () => api;
        api.select = vi.fn(self);
        api.eq = vi.fn(self);
        api.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: RESPONSE_ID, updated_at: previousUpdatedAt },
          error: null,
        });
        api.update = vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload;
          const upd: Record<string, unknown> = {};
          const selfUpd = () => upd;
          upd.eq = vi.fn(selfUpd);
          upd.select = vi.fn(selfUpd);
          upd.single = vi.fn().mockResolvedValue({
            data: { id: RESPONSE_ID, updated_at: nextUpdatedAt },
            error: null,
          });
          return upd;
        });
        api.insert = vi.fn(() => {
          throw new Error("insert must not be called on update path");
        });
        return api;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await submitMatch(jsonRequest(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.responseId).toBe(RESPONSE_ID);
    expect(body.updated).toBe(true);
    expect(body.updatedAt).toBe(nextUpdatedAt);
    expect(body.previousUpdatedAt).toBe(previousUpdatedAt);
    expect(body.updatedAt).not.toBe(body.previousUpdatedAt);
    expect(updatePayload).not.toBeNull();
    expect(updatePayload).not.toHaveProperty("created_at");
    expect(updatePayload).toHaveProperty("updated_at");
  });
});

describe("POST /api/kiosk-match/delete auth", () => {
  beforeEach(() => {
    getAppUser.mockReset();
    fromMock.mockReset();
  });

  it("rejects unauthenticated delete with 401", async () => {
    getAppUser.mockResolvedValue(null);
    const res = await deleteMatch(jsonRequest({ matchId: MATCH_ID }));
    expect(res.status).toBe(401);
  });

  it("rejects staff delete with 403", async () => {
    getAppUser.mockResolvedValue(STAFF);
    const res = await deleteMatch(jsonRequest({ matchId: MATCH_ID }));
    expect(res.status).toBe(403);
  });

  it("deletes match for admin", async () => {
    getAppUser.mockResolvedValue(ADMIN);
    fromMock.mockImplementation((table: string) => {
      if (table === "match_feedback_matches") {
        return chain({ data: { id: MATCH_ID }, error: null }, "maybeSingle");
      }
      if (
        table === "match_feedback_responses" ||
        table === "match_feedback_participants"
      ) {
        return chain({ data: null, error: null }, "then");
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await deleteMatch(jsonRequest({ matchId: MATCH_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
