import "server-only";

/**
 * ADMIN-ONLY ST-AMS ↔ Power BI player mapping domain.
 *
 * Historical planner weeks use frozen `planner_match_best_snapshots.powerbi_player_name`.
 * Creating/updating/deleting a current mapping must NOT rewrite frozen snapshot identity
 * and must NOT cascade-delete profiles, snapshots, or weekly/daily targets.
 */

import { getAppUser, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { playerDisplayName } from "@/lib/players/listPlayers";
import {
  getPowerBiPlayerCandidates,
  type PowerBiPlayerCandidate,
} from "@/lib/powerbi/queries/playerNames.server";
import { resolvePowerBiPlayerCandidate } from "@/lib/powerbi/queries/playerNames";

export const POWERBI_MAPPING_PROVIDER = "powerbi" as const;

export type PlayerMappingErrorCode =
  | "unauthorized"
  | "player_not_found"
  | "not_a_player"
  | "external_player_not_found"
  | "mapping_not_found"
  | "player_already_mapped"
  | "external_player_already_mapped"
  | "database_error"
  | "powerbi_error"
  | "invalid_input";

export type PlayerMappingSafeError = {
  code: PlayerMappingErrorCode;
  message: string;
};

export type PlayerMappingResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PlayerMappingSafeError };

export type PlayerExternalMappingRow = {
  id: string;
  playerId: string;
  provider: typeof POWERBI_MAPPING_PROVIDER;
  externalPlayerName: string;
  createdAt: string;
  updatedAt: string;
  playerDisplayName: string;
};

type MappingDbRow = {
  id: string;
  player_id: string;
  provider: string;
  external_player_name: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function err(
  code: PlayerMappingErrorCode,
  message: string
): PlayerMappingSafeError {
  return { code, message };
}

function logMappingError(
  area: string,
  error: PlayerMappingSafeError,
  detail?: Record<string, unknown>
): void {
  console.error("[gpsPlanner.playerMappings]", {
    area,
    code: error.code,
    message: error.message,
    ...(detail ? { detail } : {}),
  });
}

async function requireAdmin(): Promise<PlayerMappingSafeError | null> {
  const user = await getAppUser();
  if (!user) {
    return err("unauthorized", "Authentication required.");
  }
  if (!isAdmin(user.role)) {
    return err("unauthorized", "Admin access required.");
  }
  return null;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Emptiness gate only: whitespace-only requests are invalid.
 * Does NOT rewrite a Power BI identity for storage — create/update resolve
 * against candidates and store `candidate.playerName` exactly.
 */
export function normalizeExternalPlayerName(value: string): string | null {
  if (value.trim().length === 0) return null;
  return value;
}

function mapDbRow(
  row: MappingDbRow,
  displayName: string
): PlayerExternalMappingRow {
  return {
    id: row.id,
    playerId: row.player_id,
    provider: POWERBI_MAPPING_PROVIDER,
    externalPlayerName: row.external_player_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    playerDisplayName: displayName,
  };
}

function mapUniqueViolation(
  message: string
): PlayerMappingSafeError | null {
  const lower = message.toLowerCase();
  if (
    lower.includes("player_external_mappings_provider_player_id_key") ||
    (lower.includes("provider_player_id") && lower.includes("unique"))
  ) {
    return err(
      "player_already_mapped",
      "This ST-AMS player already has a Power BI mapping."
    );
  }
  if (
    lower.includes("player_external_mappings_provider_external_player_name_key") ||
    (lower.includes("provider_external_player_name") && lower.includes("unique"))
  ) {
    return err(
      "external_player_already_mapped",
      "This Power BI player identity is already mapped to another ST-AMS player."
    );
  }
  if (lower.includes("duplicate key") || lower.includes("unique")) {
    // Fallback: prefer player uniqueness wording when ambiguous
    if (lower.includes("player_id")) {
      return err(
        "player_already_mapped",
        "This ST-AMS player already has a Power BI mapping."
      );
    }
    if (lower.includes("external_player_name")) {
      return err(
        "external_player_already_mapped",
        "This Power BI player identity is already mapped to another ST-AMS player."
      );
    }
  }
  return null;
}

function toDatabaseError(
  area: string,
  supabaseError: { code?: string; message?: string } | null
): PlayerMappingSafeError {
  const message = supabaseError?.message ?? "Database error.";
  const unique = mapUniqueViolation(message);
  if (unique) {
    logMappingError(area, unique, { code: supabaseError?.code });
    return unique;
  }
  const safe = err("database_error", "Could not complete mapping operation.");
  logMappingError(area, safe, {
    code: supabaseError?.code,
    message,
  });
  return safe;
}

async function loadDisplayNames(
  playerIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (playerIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", playerIds);
  if (error) {
    logMappingError(
      "loadDisplayNames",
      err("database_error", "Could not load player display names."),
      { code: error.code, message: error.message }
    );
    for (const id of playerIds) {
      map.set(id, "Unknown player");
    }
    return map;
  }
  for (const row of (data ?? []) as Pick<ProfileRow, "id" | "full_name" | "email">[]) {
    map.set(row.id, playerDisplayName(row.full_name, row.email));
  }
  for (const id of playerIds) {
    if (!map.has(id)) map.set(id, "Unknown player");
  }
  return map;
}

async function requirePlayerProfile(
  playerId: string
): Promise<PlayerMappingSafeError | null> {
  if (!isUuid(playerId)) {
    return err("invalid_input", "playerId must be a valid UUID.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", playerId)
    .maybeSingle();

  if (error) {
    return toDatabaseError("requirePlayerProfile", error);
  }
  if (!data) {
    return err("player_not_found", "ST-AMS player profile was not found.");
  }
  if ((data as ProfileRow).role !== "player") {
    return err("not_a_player", "Only profiles with role 'player' may be mapped.");
  }
  return null;
}

async function resolveExactExternalCandidate(
  requestedExternalPlayerName: string
): Promise<
  | { ok: true; candidate: PowerBiPlayerCandidate }
  | { ok: false; error: PlayerMappingSafeError }
> {
  const candidates = await getPowerBiPlayerCandidates();
  if (!candidates.ok) {
    const safe = err(
      "powerbi_error",
      "Could not load Power BI player candidates."
    );
    logMappingError("resolveExactExternalCandidate", safe, {
      code: candidates.error.code,
      message: candidates.error.message,
    });
    return { ok: false, error: safe };
  }
  const candidate = resolvePowerBiPlayerCandidate(
    requestedExternalPlayerName,
    candidates.data
  );
  if (!candidate) {
    return {
      ok: false,
      error: err(
        "external_player_not_found",
        "Selected Power BI player identity was not found in GPS_Log or Match_Benchmark (single-match best)."
      ),
    };
  }
  return { ok: true, candidate };
}

/** Admin-only list of Power BI mapping candidates (union + flags). */
export async function listPowerBiPlayerCandidates(): Promise<
  PlayerMappingResult<PowerBiPlayerCandidate[]>
> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const result = await getPowerBiPlayerCandidates();
  if (!result.ok) {
    const safe = err(
      "powerbi_error",
      "Could not load Power BI player candidates."
    );
    logMappingError("listPowerBiPlayerCandidates", safe, {
      code: result.error.code,
      message: result.error.message,
    });
    return { ok: false, error: safe };
  }
  return { ok: true, data: result.data };
}

/** List all Power BI mappings with ST-AMS display names. */
export async function listPlayerMappings(): Promise<
  PlayerMappingResult<PlayerExternalMappingRow[]>
> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_external_mappings")
    .select(
      "id, player_id, provider, external_player_name, created_at, updated_at"
    )
    .eq("provider", POWERBI_MAPPING_PROVIDER)
    .order("external_player_name", { ascending: true });

  if (error) {
    return { ok: false, error: toDatabaseError("listPlayerMappings", error) };
  }

  const rows = (data ?? []) as MappingDbRow[];
  const names = await loadDisplayNames(rows.map((r) => r.player_id));
  return {
    ok: true,
    data: rows.map((row) =>
      mapDbRow(row, names.get(row.player_id) ?? "Unknown player")
    ),
  };
}

/** Get Power BI mapping for one ST-AMS player UUID. */
export async function getPlayerMapping(
  playerId: string
): Promise<PlayerMappingResult<PlayerExternalMappingRow | null>> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isUuid(playerId)) {
    return {
      ok: false,
      error: err("invalid_input", "playerId must be a valid UUID."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_external_mappings")
    .select(
      "id, player_id, provider, external_player_name, created_at, updated_at"
    )
    .eq("provider", POWERBI_MAPPING_PROVIDER)
    .eq("player_id", playerId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: toDatabaseError("getPlayerMapping", error) };
  }
  if (!data) {
    return { ok: true, data: null };
  }

  const row = data as MappingDbRow;
  const names = await loadDisplayNames([row.player_id]);
  return {
    ok: true,
    data: mapDbRow(row, names.get(row.player_id) ?? "Unknown player"),
  };
}

export type CreatePlayerMappingInput = {
  playerId: string;
  externalPlayerName: string;
};

/**
 * Create a Power BI mapping for an ST-AMS player.
 * Does not affect frozen planner snapshots.
 */
export async function createPlayerMapping(
  input: CreatePlayerMappingInput
): Promise<PlayerMappingResult<PlayerExternalMappingRow>> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const user = await getAppUser();
  if (!user) {
    return { ok: false, error: err("unauthorized", "Authentication required.") };
  }

  const externalPlayerNameRequest = normalizeExternalPlayerName(
    input.externalPlayerName ?? ""
  );
  if (!externalPlayerNameRequest) {
    return {
      ok: false,
      error: err("invalid_input", "externalPlayerName is required."),
    };
  }

  const playerError = await requirePlayerProfile(input.playerId);
  if (playerError) return { ok: false, error: playerError };

  const resolved = await resolveExactExternalCandidate(externalPlayerNameRequest);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const exactExternalPlayerName = resolved.candidate.playerName;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_external_mappings")
    .insert({
      player_id: input.playerId,
      provider: POWERBI_MAPPING_PROVIDER,
      external_player_name: exactExternalPlayerName,
      created_by: user.id,
      updated_by: user.id,
    })
    .select(
      "id, player_id, provider, external_player_name, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: toDatabaseError("createPlayerMapping", error),
    };
  }

  const row = data as MappingDbRow;
  const names = await loadDisplayNames([row.player_id]);
  return {
    ok: true,
    data: mapDbRow(row, names.get(row.player_id) ?? "Unknown player"),
  };
}

export type UpdatePlayerMappingInput = {
  playerId: string;
  externalPlayerName: string;
};

/**
 * Update the Power BI external name for an existing mapping.
 * Historical frozen snapshot names are unchanged.
 */
export async function updatePlayerMapping(
  input: UpdatePlayerMappingInput
): Promise<PlayerMappingResult<PlayerExternalMappingRow>> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const user = await getAppUser();
  if (!user) {
    return { ok: false, error: err("unauthorized", "Authentication required.") };
  }

  const externalPlayerNameRequest = normalizeExternalPlayerName(
    input.externalPlayerName ?? ""
  );
  if (!externalPlayerNameRequest) {
    return {
      ok: false,
      error: err("invalid_input", "externalPlayerName is required."),
    };
  }

  if (!isUuid(input.playerId)) {
    return {
      ok: false,
      error: err("invalid_input", "playerId must be a valid UUID."),
    };
  }

  const playerError = await requirePlayerProfile(input.playerId);
  if (playerError) return { ok: false, error: playerError };

  const resolved = await resolveExactExternalCandidate(externalPlayerNameRequest);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const exactExternalPlayerName = resolved.candidate.playerName;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_external_mappings")
    .update({
      external_player_name: exactExternalPlayerName,
      updated_by: user.id,
    })
    .eq("provider", POWERBI_MAPPING_PROVIDER)
    .eq("player_id", input.playerId)
    .select(
      "id, player_id, provider, external_player_name, created_at, updated_at"
    )
    .maybeSingle();

  if (error) {
    return { ok: false, error: toDatabaseError("updatePlayerMapping", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: err("mapping_not_found", "No Power BI mapping found for this player."),
    };
  }

  const row = data as MappingDbRow;
  const names = await loadDisplayNames([row.player_id]);
  return {
    ok: true,
    data: mapDbRow(row, names.get(row.player_id) ?? "Unknown player"),
  };
}

/**
 * Delete the Power BI mapping for an ST-AMS player.
 * Does not delete profiles, snapshots, weekly targets, or daily targets.
 * Frozen historical `powerbi_player_name` values remain on existing snapshots.
 */
export async function deletePlayerMapping(
  playerId: string
): Promise<PlayerMappingResult<{ playerId: string }>> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isUuid(playerId)) {
    return {
      ok: false,
      error: err("invalid_input", "playerId must be a valid UUID."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_external_mappings")
    .delete()
    .eq("provider", POWERBI_MAPPING_PROVIDER)
    .eq("player_id", playerId)
    .select("player_id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: toDatabaseError("deletePlayerMapping", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: err("mapping_not_found", "No Power BI mapping found for this player."),
    };
  }

  return { ok: true, data: { playerId } };
}
