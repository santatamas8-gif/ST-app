"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUser, isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { computeCardItemFields } from "@/lib/strength/cardItemCalc";
import { getFinalDisplayWeight } from "@/lib/strength/calculation";
import type {
  PlayerStrengthCard,
  SessionExerciseWithSets,
  StrengthExercise,
  StrengthProfile,
  StrengthSessionCard,
} from "@/lib/strength/types";
import { playerDisplayName, normalizeAvatarUrl } from "@/lib/players/listPlayers";
import { isRenderableImageUrl } from "@/lib/strength/imageUrl";
import { syncCardItemImageSnapshots, fetchExerciseImageMap } from "@/lib/strength/exerciseImages";
import {
  dailySchemesFromParsed,
  parseExercisesFromWorkbook,
  parseSchemesFromWorkbook,
} from "@/lib/strength/excelImport";
import { EXPLOSIVE_EXERCISE_SEED, isExplosiveExercise } from "@/lib/strength/explosiveExercises";
import exercisesSeed from "@/lib/strength/seed/exercises.json";
import schemesSeed from "@/lib/strength/seed/schemes.json";

type SchemeSeed = {
  name: string;
  category: string;
  description: string;
  source_excel_name: string;
  items: { set_number: number; percentage: number; reps: number; week_number?: number | null }[];
};

async function insertSchemesBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  schemes: SchemeSeed[]
) {
  const BATCH = 40;
  for (let i = 0; i < schemes.length; i += BATCH) {
    const batch = schemes.slice(i, i + BATCH);
    const { data: inserted, error } = await supabase
      .from("strength_set_rep_schemes")
      .insert(batch.map(({ items: _items, ...meta }) => meta))
      .select("id");
    if (error || !inserted) throw new Error(error?.message ?? "Scheme insert failed");

    const allItems: {
      scheme_id: string;
      set_number: number;
      percentage: number;
      reps: number;
      week_number: number | null;
    }[] = [];

    batch.forEach((scheme, idx) => {
      const schemeId = inserted[idx]?.id;
      if (!schemeId) return;
      for (const it of scheme.items ?? []) {
        allItems.push({
          scheme_id: schemeId,
          set_number: it.set_number,
          percentage: it.percentage,
          reps: it.reps,
          week_number: it.week_number ?? 1,
        });
      }
    });

    if (allItems.length) {
      const { error: itemsErr } = await supabase
        .from("strength_set_rep_scheme_items")
        .insert(allItems);
      if (itemsErr) throw new Error(itemsErr.message);
    }
  }
}

async function requireAdmin() {
  const user = await getAppUser();
  if (!user || !isAdmin(user.role)) {
    throw new Error("Admin access required");
  }
  return user;
}

/** Supabase nested selects may type as T or T[] depending on relationship metadata. */
function asJoinedRow<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function ensureCustomExplosiveExercises(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const names = EXPLOSIVE_EXERCISE_SEED.map((e) => e.name);
  const { data } = await supabase
    .from("strength_exercises")
    .select("name")
    .in("name", names);
  const existing = new Set((data ?? []).map((r) => r.name));
  const missing = EXPLOSIVE_EXERCISE_SEED.filter((e) => !existing.has(e.name));
  if (missing.length) {
    await supabase.from("strength_exercises").insert(missing);
  }
}

type RawStrengthCardRow = Omit<StrengthSessionCard, "profiles">;

async function enrichCardsWithProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cards: RawStrengthCardRow[]
): Promise<StrengthSessionCard[]> {
  if (!cards.length) return [];

  const playerIds = [...new Set(cards.map((c) => c.player_id))];
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", playerIds);

  if (error) {
    console.error("[strength] profiles lookup error:", error.message, error);
  }

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return cards.map((c) => ({
    ...c,
    profiles: byId.get(c.player_id) ?? { full_name: null, email: null, avatar_url: null },
  }));
}

export async function seedStrengthDataIfEmpty() {
  await requireAdmin();
  const supabase = await createClient();

  const { count } = await supabase
    .from("strength_exercises")
    .select("id", { count: "exact", head: true });

  if ((count ?? 0) === 0) {
    await supabase.from("strength_exercises").insert(exercisesSeed);
  }

  const { count: schemeCount } = await supabase
    .from("strength_set_rep_schemes")
    .select("id", { count: "exact", head: true });

  if ((schemeCount ?? 0) === 0) {
    await insertSchemesBatch(supabase, schemesSeed as SchemeSeed[]);
  }
  await ensureCustomExplosiveExercises(supabase);
}

export async function getStrengthExercises(activeOnly = true) {
  await requireAdmin();
  const supabase = await createClient();
  let q = supabase.from("strength_exercises").select("*").order("name");
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as StrengthExercise[];
}

export async function updateExerciseImage(exerciseId: string, imageUrl: string) {
  await requireAdmin();
  const trimmed = imageUrl.trim();
  if (trimmed && !isRenderableImageUrl(trimmed)) {
    return { error: "Use a web image URL (https://…) or upload a file." };
  }
  const supabase = await createClient();
  const normalized = trimmed || null;
  const { error } = await supabase
    .from("strength_exercises")
    .update({ image_url: normalized, updated_at: new Date().toISOString() })
    .eq("id", exerciseId);
  if (error) return { error: error.message };

  await syncCardItemImageSnapshots(supabase, exerciseId, normalized);

  revalidatePath("/admin/strength/exercises");
  revalidatePath("/strength-card");
  return { success: true };
}

export async function getSetRepSchemes() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: schemes, error } = await supabase
    .from("strength_set_rep_schemes")
    .select("*, strength_set_rep_scheme_items(*)")
    .order("name");
  if (error) throw new Error(error.message);
  return schemes ?? [];
}

export async function getPlayersWithProfiles() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role")
    .eq("role", "player")
    .order("full_name");

  const { data: strengthProfiles } = await supabase.from("strength_profiles").select("*");

  const byPlayer = new Map((strengthProfiles ?? []).map((p) => [p.player_id, p]));

  return (profiles ?? []).map((p) => ({
    id: p.id,
    name: playerDisplayName(p.full_name, p.email),
    avatarUrl: normalizeAvatarUrl(p.avatar_url),
    profile: (byPlayer.get(p.id) as StrengthProfile | undefined) ?? null,
  }));
}

export async function upsertStrengthProfile(
  playerId: string,
  data: Omit<StrengthProfile, "id" | "player_id" | "updated_at">
) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("strength_profiles").upsert(
    {
      player_id: playerId,
      ...data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/admin/strength/profiles");
  return { success: true };
}

export async function createDailySession(input: {
  date: string;
  title: string;
  session_type: string;
}) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_strength_sessions")
    .insert({
      date: input.date,
      title: input.title,
      session_type: input.session_type,
      created_by: user.id,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/admin/strength");
  return { success: true, sessionId: data.id };
}

export async function saveSessionExercises(
  sessionId: string,
  exercises: {
    exercise_id: string;
    exercise_order: number;
    sets: { set_number: number; reps: number; percentage: number }[];
  }[]
) {
  await requireAdmin();
  if (exercises.length < 1 || exercises.length > 8) {
    return { error: "Select between 1 and 8 exercises" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("daily_strength_session_exercises")
    .select("id")
    .eq("session_id", sessionId);

  if (existing?.length) {
    await supabase
      .from("daily_strength_session_exercises")
      .delete()
      .eq("session_id", sessionId);
  }

  for (const ex of exercises) {
    const { data: se, error: seErr } = await supabase
      .from("daily_strength_session_exercises")
      .insert({
        session_id: sessionId,
        exercise_id: ex.exercise_id,
        exercise_order: ex.exercise_order,
      })
      .select("id")
      .single();
    if (seErr || !se) return { error: seErr?.message ?? "Failed to save exercise" };

    if (ex.sets.length) {
      const { error: setErr } = await supabase.from("daily_strength_session_sets").insert(
        ex.sets.map((s) => ({
          session_exercise_id: se.id,
          set_number: s.set_number,
          reps: s.reps,
          percentage: s.percentage,
        }))
      );
      if (setErr) return { error: setErr.message };
    }
  }

  await supabase
    .from("daily_strength_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  revalidatePath(`/admin/strength/sessions/${sessionId}`);
  return { success: true };
}

export async function getSessionDetail(sessionId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("daily_strength_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error || !session) return null;

  const { data: sessionExercises } = await supabase
    .from("daily_strength_session_exercises")
    .select("*, strength_exercises(*), daily_strength_session_sets(*)")
    .eq("session_id", sessionId)
    .order("exercise_order");

  const exercises: SessionExerciseWithSets[] = (sessionExercises ?? [])
    .map((se) => {
      const exercise = asJoinedRow(
        se.strength_exercises as StrengthExercise | StrengthExercise[] | null
      );
      if (!exercise) return null;
      return {
        id: se.id,
        session_id: se.session_id,
        exercise_id: se.exercise_id,
        exercise_order: se.exercise_order,
        exercise,
        sets: (se.daily_strength_session_sets ?? [])
          .sort((a: { set_number: number }, b: { set_number: number }) => a.set_number - b.set_number)
          .map((s: { id: string; set_number: number; reps: number; percentage: number }) => ({
            id: s.id,
            set_number: s.set_number,
            reps: s.reps,
            percentage: s.percentage,
          })),
      };
    })
    .filter((row): row is SessionExerciseWithSets => row != null);

  const { data: rawCards, error: cardsError } = await supabase
    .from("daily_strength_player_cards")
    .select("*")
    .eq("session_id", sessionId);

  if (cardsError) {
    console.error("[getSessionDetail] cards query error:", cardsError.message, cardsError);
  }

  const cards = await enrichCardsWithProfiles(
    supabase,
    (rawCards ?? []) as RawStrengthCardRow[]
  );

  return { session, exercises, cards };
}

export async function generatePlayerCards(sessionId: string, playerIds: string[]) {
  try {
    await requireAdmin();
    console.log("[generatePlayerCards] start", {
      sessionId,
      playerIds,
      playerCount: playerIds.length,
    });

    if (!playerIds.length) return { error: "Select at least one player" };

    const supabase = await createClient();
    const detail = await getSessionDetail(sessionId);
    if (!detail) return { error: "Session not found" };
    if (!detail.exercises.length) return { error: "Add exercises first" };

    const exercisesCount = detail.exercises.length;
    const setsCount = detail.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    console.log("[generatePlayerCards] session loaded", {
      sessionId,
      exercisesCount,
      setsCount,
    });

    if (setsCount === 0) return { error: "Session exercises have no sets configured" };

    const { data: profiles, error: profilesError } = await supabase
      .from("strength_profiles")
      .select("*")
      .in("player_id", playerIds);

    if (profilesError) {
      console.error("[generatePlayerCards] strength_profiles error:", profilesError.message, profilesError);
      return { error: `Failed to load strength profiles: ${profilesError.message}` };
    }

    const profileByPlayer = new Map((profiles ?? []).map((p) => [p.player_id, p as StrengthProfile]));

    let generatedCardCount = 0;
    let totalItemsCount = 0;

    for (const playerId of playerIds) {
      const profile = profileByPlayer.get(playerId);
      if (!profile) {
        return { error: `Missing strength profile for player ${playerId}` };
      }

      const { data: existingCard, error: existingErr } = await supabase
        .from("daily_strength_player_cards")
        .select("id")
        .eq("session_id", sessionId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (existingErr) {
        console.error("[generatePlayerCards] existing card lookup error:", existingErr.message, existingErr);
        return { error: `Failed to check existing card: ${existingErr.message}` };
      }

      let cardId = existingCard?.id;
      if (cardId) {
        const { error: delErr } = await supabase
          .from("daily_strength_player_card_items")
          .delete()
          .eq("card_id", cardId);
        if (delErr) {
          console.error("[generatePlayerCards] delete items error:", delErr.message, delErr);
          return { error: `Failed to clear existing card items: ${delErr.message}` };
        }
      } else {
        const { data: newCard, error: cardErr } = await supabase
          .from("daily_strength_player_cards")
          .insert({ session_id: sessionId, player_id: playerId, status: "draft" })
          .select("id")
          .single();
        if (cardErr || !newCard) {
          console.error("[generatePlayerCards] card insert error:", cardErr?.message, cardErr);
          return { error: cardErr?.message ?? "Failed to create card" };
        }
        cardId = newCard.id;
      }

      const items = [];
      for (const se of detail.exercises) {
        const ex = se.exercise;
        for (const set of se.sets) {
          items.push({
            card_id: cardId,
            ...computeCardItemFields(ex, profile, set, se.exercise_order),
          });
        }
      }

      console.log("[generatePlayerCards] inserting items", {
        sessionId,
        playerId,
        cardId,
        itemCount: items.length,
      });

      const { error: itemsErr } = await supabase.from("daily_strength_player_card_items").insert(items);
      if (itemsErr) {
        console.error("[generatePlayerCards] items insert error:", itemsErr.message, itemsErr);
        return { error: `Failed to save card items: ${itemsErr.message}` };
      }

      generatedCardCount += 1;
      totalItemsCount += items.length;
    }

    console.log("[generatePlayerCards] success", {
      sessionId,
      generatedCardCount,
      totalItemsCount,
    });

    revalidatePath(`/admin/strength/sessions/${sessionId}`);
    revalidatePath("/admin/strength");
    return { success: true as const, generatedCardCount, totalItemsCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error generating cards";
    console.error("[generatePlayerCards] unexpected error:", err);
    return { error: message };
  }
}

export async function saveCardExerciseEdits(
  sessionId: string,
  exerciseOrder: number,
  input: {
    exerciseId?: string;
    sets: { set_number: number; reps: number; percentage: number }[];
  }
) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("daily_strength_sessions")
    .select("status")
    .eq("id", sessionId)
    .single();
  if (!session) return { error: "Session not found" };
  if (session.status === "published") return { error: "Published cards cannot be edited" };

  if (!input.sets.length) return { error: "At least one set is required" };

  const normalizedSets = input.sets.map((set, index) => ({
    set_number: index + 1,
    reps: set.reps,
    percentage: set.percentage,
  }));

  const { data: sessionExercise } = await supabase
    .from("daily_strength_session_exercises")
    .select("id, exercise_id, strength_exercises(*)")
    .eq("session_id", sessionId)
    .eq("exercise_order", exerciseOrder)
    .single();
  if (!sessionExercise) return { error: "Exercise slot not found" };

  const joinedExercise = asJoinedRow(
    sessionExercise.strength_exercises as StrengthExercise | StrengthExercise[] | null
  );
  if (!joinedExercise) return { error: "Exercise not found" };

  let exercise = joinedExercise;
  if (input.exerciseId && input.exerciseId !== sessionExercise.exercise_id) {
    const { data: newExercise, error: exErr } = await supabase
      .from("strength_exercises")
      .select("*")
      .eq("id", input.exerciseId)
      .single();
    if (exErr || !newExercise) return { error: "Exercise not found" };

    const { error: updateExErr } = await supabase
      .from("daily_strength_session_exercises")
      .update({ exercise_id: input.exerciseId })
      .eq("id", sessionExercise.id);
    if (updateExErr) return { error: updateExErr.message };
    exercise = newExercise as StrengthExercise;
  }

  const explosive = isExplosiveExercise(exercise.name);
  for (const set of normalizedSets) {
    if (!Number.isFinite(set.reps) || set.reps < 1) {
      return { error: "Reps must be at least 1" };
    }
    if (!explosive && (!Number.isFinite(set.percentage) || set.percentage <= 0)) {
      return { error: "Percentage must be greater than 0" };
    }
  }

  const { error: delSetsErr } = await supabase
    .from("daily_strength_session_sets")
    .delete()
    .eq("session_exercise_id", sessionExercise.id);
  if (delSetsErr) return { error: delSetsErr.message };

  if (normalizedSets.length) {
    const { error: insertSetsErr } = await supabase.from("daily_strength_session_sets").insert(
      normalizedSets.map((set) => ({
        session_exercise_id: sessionExercise.id,
        set_number: set.set_number,
        reps: set.reps,
        percentage: set.percentage,
      }))
    );
    if (insertSetsErr) return { error: insertSetsErr.message };
  }

  const { data: cards } = await supabase
    .from("daily_strength_player_cards")
    .select("id, player_id")
    .eq("session_id", sessionId);
  if (!cards?.length) return { error: "No generated cards for this session" };

  const { data: profiles } = await supabase
    .from("strength_profiles")
    .select("*")
    .in(
      "player_id",
      cards.map((c) => c.player_id)
    );
  const profileByPlayer = new Map((profiles ?? []).map((p) => [p.player_id, p as StrengthProfile]));

  for (const card of cards) {
    const { error: delErr } = await supabase
      .from("daily_strength_player_card_items")
      .delete()
      .eq("card_id", card.id)
      .eq("exercise_order", exerciseOrder);
    if (delErr) return { error: delErr.message };
  }

  for (const card of cards) {
    const profile = profileByPlayer.get(card.player_id);
    if (!profile) return { error: `Missing strength profile for player ${card.player_id}` };

    const rows = normalizedSets.map((set) => ({
      card_id: card.id,
      ...computeCardItemFields(exercise, profile, set, exerciseOrder),
    }));

    if (rows.length) {
      const { error } = await supabase.from("daily_strength_player_card_items").insert(rows);
      if (error) return { error: error.message };
    }
  }

  await supabase
    .from("daily_strength_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  revalidatePath(`/admin/strength/sessions/${sessionId}`);
  revalidatePath(`/admin/strength/sessions/${sessionId}/print`);
  return { success: true as const };
}

export async function updateCoachAdjustedWeight(itemId: string, weight: number | null) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("daily_strength_player_card_items")
    .select("*, daily_strength_player_cards(session_id)")
    .eq("id", itemId)
    .single();
  if (!item) return { error: "Item not found" };

  const loadType = item.load_type;
  const displayWeight = getFinalDisplayWeight(
    item.calculated_weight,
    weight,
    loadType
  );

  const { error } = await supabase
    .from("daily_strength_player_card_items")
    .update({
      coach_adjusted_weight: weight,
      display_weight: displayWeight,
    })
    .eq("id", itemId);

  if (error) return { error: error.message };
  const sessionId = (item.daily_strength_player_cards as { session_id: string }).session_id;
  revalidatePath(`/admin/strength/sessions/${sessionId}`);
  return { success: true };
}

export async function publishSessionCards(sessionId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error: cardErr } = await supabase
    .from("daily_strength_player_cards")
    .update({ status: "published", published_at: now })
    .eq("session_id", sessionId);

  if (cardErr) return { error: cardErr.message };

  await supabase
    .from("daily_strength_sessions")
    .update({ status: "published", updated_at: now })
    .eq("id", sessionId);

  revalidatePath(`/admin/strength/sessions/${sessionId}`);
  revalidatePath("/strength-card");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getSessionsList() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_strength_sessions")
    .select("*, daily_strength_player_cards(count)")
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPlayerCardForSession(sessionId: string, playerId: string) {
  await requireAdmin();
  const supabase = await createClient();
  return loadPlayerCard(supabase, sessionId, playerId);
}

export async function getMyPublishedStrengthCards() {
  const user = await getAppUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data: cards } = await supabase
    .from("daily_strength_player_cards")
    .select("*, daily_strength_sessions(*)")
    .eq("player_id", user.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return cards ?? [];
}

export async function getMyStrengthCard(cardId: string): Promise<PlayerStrengthCard | null> {
  const user = await getAppUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: card, error: cardError } = await supabase
    .from("daily_strength_player_cards")
    .select("*, daily_strength_sessions(*)")
    .eq("id", cardId)
    .eq("player_id", user.id)
    .eq("status", "published")
    .single();

  if (cardError) {
    console.error("[getMyStrengthCard] card query error:", cardError.message, cardError);
  }
  if (!card) return null;

  const [enriched] = await enrichCardsWithProfiles(supabase, [card as RawStrengthCardRow]);

  const { data: items } = await supabase
    .from("daily_strength_player_card_items")
    .select("*")
    .eq("card_id", cardId)
    .order("exercise_order")
    .order("set_number");

  const cardItems = items ?? [];
  const exerciseImages = await fetchExerciseImageMap(supabase, cardItems);

  const profile = enriched.profiles as {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;

  return {
    id: enriched.id,
    session_id: enriched.session_id,
    player_id: enriched.player_id,
    status: enriched.status as "draft" | "published",
    created_at: enriched.created_at,
    published_at: enriched.published_at ?? null,
    session: card.daily_strength_sessions as PlayerStrengthCard["session"],
    player_name: playerDisplayName(profile?.full_name, profile?.email),
    player_avatar_url: normalizeAvatarUrl(profile?.avatar_url),
    items: cardItems,
    exerciseImages,
  };
}

async function loadPlayerCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  playerId: string
): Promise<PlayerStrengthCard | null> {
  const { data: card, error: cardError } = await supabase
    .from("daily_strength_player_cards")
    .select("*, daily_strength_sessions(*)")
    .eq("session_id", sessionId)
    .eq("player_id", playerId)
    .single();

  if (cardError) {
    console.error("[loadPlayerCard] card query error:", cardError.message, cardError);
  }
  if (!card) return null;

  const [enriched] = await enrichCardsWithProfiles(supabase, [card as RawStrengthCardRow]);

  const { data: items } = await supabase
    .from("daily_strength_player_card_items")
    .select("*")
    .eq("card_id", card.id)
    .order("exercise_order")
    .order("set_number");

  const cardItems = items ?? [];
  const exerciseImages = await fetchExerciseImageMap(supabase, cardItems);

  const profile = enriched.profiles as {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;

  return {
    id: enriched.id,
    session_id: enriched.session_id,
    player_id: enriched.player_id,
    status: enriched.status as "draft" | "published",
    created_at: enriched.created_at,
    published_at: enriched.published_at ?? null,
    session: card.daily_strength_sessions as PlayerStrengthCard["session"],
    player_name: playerDisplayName(profile?.full_name, profile?.email),
    player_avatar_url: normalizeAvatarUrl(profile?.avatar_url),
    items: cardItems,
    exerciseImages,
  };
}

export async function getPrintCards(sessionId: string): Promise<PlayerStrengthCard[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: cards } = await supabase
    .from("daily_strength_player_cards")
    .select("player_id")
    .eq("session_id", sessionId);

  const results: PlayerStrengthCard[] = [];
  for (const c of cards ?? []) {
    const card = await loadPlayerCard(supabase, sessionId, c.player_id);
    if (card) results.push(card);
  }
  results.sort((a, b) => a.player_name.localeCompare(b.player_name));
  return results;
}

export async function deleteSession(sessionId: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("daily_strength_sessions").delete().eq("id", sessionId);
  if (error) return { error: error.message };
  revalidatePath("/admin/strength");
  return { success: true };
}

export async function importFromExcel(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided" };

  const buffer = Buffer.from(await file.arrayBuffer());
  let XLSX;
  try {
    XLSX = await import("xlsx");
  } catch {
    return { error: "xlsx package not installed. Run: npm install xlsx" };
  }

  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const admin = createAdminClient();

  const exercises = parseExercisesFromWorkbook(wb, XLSX);
  if (!exercises.length) return { error: 'Sheet "Exercises" not found or empty' };

  const schemes = dailySchemesFromParsed(parseSchemesFromWorkbook(wb, XLSX, 1));

  await admin.from("strength_set_rep_scheme_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("strength_set_rep_schemes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await admin.from("strength_exercises").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const { error: exErr } = await admin.from("strength_exercises").insert(exercises);
  if (exErr) return { error: exErr.message };

  if (schemes.length) {
    await insertSchemesBatch(admin, schemes);
  }

  revalidatePath("/admin/strength");
  revalidatePath("/admin/strength/exercises");
  return {
    success: true,
    exerciseCount: exercises.length,
    schemeCount: schemes.length,
  };
}
