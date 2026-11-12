import "server-only";

import { loadHistoryNote } from "@/lib/drillAnalysis/historyNote.server";
import { loadHistorySessionModel } from "@/lib/drillAnalysis/history.server";
import {
  DRILL_ANALYSIS_IMAGE_BUCKET,
  detectDrillImage,
  isDrillImagePath,
  isPlanImagePath,
} from "@/lib/drillAnalysis/images";
import {
  arrangePlanItems,
  parsePlanSnapshot,
  planSourceKey,
  snapshotFromHistoryModel,
  type FreshPlanItem,
  type PlanItemSnapshot,
  type StoredPlanItem,
} from "@/lib/drillAnalysis/trainingPlan";
import { DRILL_ANALYSIS_SCOPE } from "@/lib/drillAnalysis/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type TrainingPlanSummary = {
  id: string;
  name: string;
  planDate: string;
  updatedAt: string;
  itemCount: number;
};

export type TrainingPlanItemRecord = {
  id: string;
  sortIndex: number;
  hasImage: boolean;
  snapshot: PlanItemSnapshot;
};

export type TrainingPlanRecord = {
  id: string;
  name: string;
  planDate: string;
  notes: string;
  updatedAt: string;
  items: TrainingPlanItemRecord[];
};

type Admin = ReturnType<typeof createAdminClient>;

function missingPlansTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "42P01" || error.code === "PGRST205" || /drill_analysis_training_plan/i.test(message);
}

function setupError(): { ok: false; status: number; error: string } {
  return { ok: false, status: 503, error: "Training plans are not set up yet. Apply migration 054 once in the SQL editor." };
}

export async function listTrainingPlans(): Promise<
  { ok: true; plans: TrainingPlanSummary[] } | { ok: false; status: number; error: string }
> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("drill_analysis_training_plans")
      .select("id, name, plan_date, updated_at, drill_analysis_training_plan_items(id)")
      .eq("scope_key", DRILL_ANALYSIS_SCOPE)
      .order("updated_at", { ascending: false });
    if (error) return missingPlansTable(error) ? setupError() : { ok: false, status: 500, error: "Saved plans could not be loaded." };
    const plans = (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      planDate: String(row.plan_date).slice(0, 10),
      updatedAt: String(row.updated_at),
      itemCount: Array.isArray(row.drill_analysis_training_plan_items) ? row.drill_analysis_training_plan_items.length : 0,
    }));
    return { ok: true, plans };
  } catch {
    return { ok: false, status: 500, error: "Saved plans could not be loaded." };
  }
}

export async function loadTrainingPlan(planId: string): Promise<
  { ok: true; plan: TrainingPlanRecord } | { ok: false; status: number; error: string }
> {
  if (!isUuid(planId)) return { ok: false, status: 404, error: "Plan not found." };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("drill_analysis_training_plans")
      .select("id, name, plan_date, notes, updated_at, drill_analysis_training_plan_items(id, sort_index, snapshot, image_path)")
      .eq("scope_key", DRILL_ANALYSIS_SCOPE)
      .eq("id", planId)
      .maybeSingle();
    if (error) return missingPlansTable(error) ? setupError() : { ok: false, status: 500, error: "The plan could not be opened." };
    if (!data) return { ok: false, status: 404, error: "Plan not found." };
    const items = asItems(data.drill_analysis_training_plan_items);
    const parsed: TrainingPlanItemRecord[] = [];
    for (const item of items.sort((left, right) => left.sort_index - right.sort_index)) {
      const snapshot = parsePlanSnapshot(item.snapshot);
      if (!snapshot) return { ok: false, status: 500, error: "The saved plan could not be read." };
      parsed.push({
        id: String(item.id),
        sortIndex: Number(item.sort_index),
        hasImage: Boolean(item.image_path),
        snapshot,
      });
    }
    return {
      ok: true,
      plan: {
        id: String(data.id),
        name: String(data.name),
        planDate: String(data.plan_date).slice(0, 10),
        notes: typeof data.notes === "string" ? data.notes : "",
        updatedAt: String(data.updated_at),
        items: parsed,
      },
    };
  } catch {
    return { ok: false, status: 500, error: "The plan could not be opened." };
  }
}

export async function captureTrainingPlanItem(
  sessionKey: string,
  cardId: string
): Promise<{ ok: true; item: FreshPlanItem } | { ok: false; status: number; error: string }> {
  const loaded = await loadHistorySessionModel(sessionKey, cardId);
  if (!loaded.ok) return loaded;
  const note = await loadHistoryNote(loaded.model.sessionKey, cardId);
  const snapshot = snapshotFromHistoryModel(loaded.model, cardId, note);
  if (!snapshot) return { ok: false, status: 404, error: "This drill cannot be added." };
  const saved = loaded.savedCards.find((card) => card.id === cardId);
  const sourceImagePath = saved?.imagePath && isDrillImagePath(saved.imagePath) ? saved.imagePath : null;
  return { ok: true, item: { snapshot, sourceImagePath } };
}

export async function saveTrainingPlan(input: {
  planId: string | null;
  name: string;
  planDate: string;
  notes: string | null;
  items: { sourceSessionKey: string; sourceEntryId: string }[];
  userId: string;
}): Promise<{ ok: true; plan: TrainingPlanRecord } | { ok: false; status: number; error: string }> {
  let admin: Admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, status: 500, error: "The plan could not be saved." };
  }

  const existing = input.planId ? await readStoredItems(admin, input.planId) : { ok: true as const, items: [] as StoredPlanItem[] };
  if (!existing.ok) return existing;

  const fresh = new Map<string, FreshPlanItem>();
  const sessions = new Map<string, Awaited<ReturnType<typeof loadHistorySessionModel>>>();
  for (const item of input.items) {
    const key = planSourceKey(item.sourceSessionKey, item.sourceEntryId);
    if (existing.items.some((stored) => planSourceKey(stored.sourceSessionKey, stored.sourceEntryId) === key)) continue;
    let loaded = sessions.get(item.sourceSessionKey);
    if (!loaded) {
      loaded = await loadHistorySessionModel(item.sourceSessionKey, item.sourceEntryId);
      sessions.set(item.sourceSessionKey, loaded);
    }
    if (!loaded.ok) return loaded;
    const note = await loadHistoryNote(loaded.model.sessionKey, item.sourceEntryId);
    const snapshot = snapshotFromHistoryModel(loaded.model, item.sourceEntryId, note);
    if (!snapshot) return { ok: false, status: 404, error: "This drill cannot be added." };
    const saved = loaded.savedCards.find((card) => card.id === item.sourceEntryId);
    fresh.set(key, {
      snapshot,
      sourceImagePath: saved?.imagePath && isDrillImagePath(saved.imagePath) ? saved.imagePath : null,
    });
  }

  const arranged = arrangePlanItems(existing.items, input.items, fresh);
  if (!arranged.ok) return { ok: false, status: 400, error: arranged.error };

  const planId = input.planId ?? crypto.randomUUID();
  const createdRows: { id: string; sortIndex: number; snapshot: PlanItemSnapshot; imagePath: string | null; sourceSessionKey: string; sourceEntryId: string }[] = [];
  const uploaded: string[] = [];
  try {
    for (const item of arranged.plan.created) {
      const id = crypto.randomUUID();
      let imagePath: string | null = null;
      if (item.fresh.sourceImagePath) {
        imagePath = await copyPlanImage(admin, item.fresh.sourceImagePath, planId, id);
        if (!imagePath) {
          await removeUploaded(admin, uploaded);
          return { ok: false, status: 500, error: "The drill drawing could not be saved with the plan." };
        }
        uploaded.push(imagePath);
      }
      createdRows.push({
        id,
        sortIndex: item.sortIndex,
        snapshot: item.fresh.snapshot,
        imagePath,
        sourceSessionKey: item.sourceSessionKey,
        sourceEntryId: item.sourceEntryId,
      });
    }

    if (!input.planId) {
      const { error } = await admin.from("drill_analysis_training_plans").insert({
        id: planId,
        scope_key: DRILL_ANALYSIS_SCOPE,
        name: input.name,
        plan_date: input.planDate,
        notes: input.notes,
        created_by: input.userId,
        updated_by: input.userId,
      });
      if (error) {
        await removeUploaded(admin, uploaded);
        return missingPlansTable(error) ? setupError() : { ok: false, status: 500, error: "The plan could not be saved." };
      }
    } else {
      const { error } = await admin
        .from("drill_analysis_training_plans")
        .update({
          name: input.name,
          plan_date: input.planDate,
          notes: input.notes,
          updated_by: input.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId)
        .eq("scope_key", DRILL_ANALYSIS_SCOPE);
      if (error) {
        await removeUploaded(admin, uploaded);
        return missingPlansTable(error) ? setupError() : { ok: false, status: 500, error: "The plan could not be saved." };
      }
    }

    for (const [index, item] of existing.items.entries()) {
      const shift = await admin
        .from("drill_analysis_training_plan_items")
        .update({ sort_index: 10000 + index })
        .eq("id", item.id)
        .eq("plan_id", planId);
      if (shift.error) {
        await removeUploaded(admin, uploaded);
        return { ok: false, status: 500, error: "The plan could not be saved." };
      }
    }

    for (const item of arranged.plan.kept) {
      const { error } = await admin
        .from("drill_analysis_training_plan_items")
        .update({ sort_index: item.sortIndex })
        .eq("id", item.id)
        .eq("plan_id", planId);
      if (error) {
        await removeUploaded(admin, uploaded);
        return { ok: false, status: 500, error: "The plan could not be saved." };
      }
    }

    if (arranged.plan.removed.length > 0) {
      const { error } = await admin
        .from("drill_analysis_training_plan_items")
        .delete()
        .in("id", arranged.plan.removed.map((item) => item.id));
      if (error) {
        await removeUploaded(admin, uploaded);
        return { ok: false, status: 500, error: "The plan could not be saved." };
      }
      for (const item of arranged.plan.removed) {
        if (item.imagePath && isPlanImagePath(item.imagePath)) {
          await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).remove([item.imagePath]);
        }
      }
    }

    if (createdRows.length > 0) {
      const { error } = await admin.from("drill_analysis_training_plan_items").insert(
        createdRows.map((item) => ({
          id: item.id,
          plan_id: planId,
          scope_key: DRILL_ANALYSIS_SCOPE,
          sort_index: item.sortIndex,
          source_session_key: item.sourceSessionKey,
          source_entry_id: item.sourceEntryId,
          snapshot: item.snapshot,
          image_path: item.imagePath,
        }))
      );
      if (error) {
        await removeUploaded(admin, uploaded);
        return missingPlansTable(error) ? setupError() : { ok: false, status: 500, error: "The plan could not be saved." };
      }
    }
  } catch {
    await removeUploaded(admin, uploaded);
    return { ok: false, status: 500, error: "The plan could not be saved." };
  }

  return loadTrainingPlan(planId);
}

export async function readPlanImage(planId: string, itemId: string): Promise<
  { ok: true; bytes: ArrayBuffer; contentType: string } | { ok: false; status: number; error: string }
> {
  if (!isUuid(planId) || !isUuid(itemId)) return { ok: false, status: 404, error: "Image not found." };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("drill_analysis_training_plan_items")
      .select("image_path")
      .eq("id", itemId)
      .eq("plan_id", planId)
      .eq("scope_key", DRILL_ANALYSIS_SCOPE)
      .maybeSingle();
    if (error || !data?.image_path || !isPlanImagePath(String(data.image_path))) {
      return { ok: false, status: 404, error: "Image not found." };
    }
    const path = String(data.image_path);
    const file = await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).download(path);
    if (file.error || !file.data) return { ok: false, status: 404, error: "Image not found." };
    const bytes = new Uint8Array(await file.data.arrayBuffer());
    const detected = detectDrillImage(bytes);
    if (!detected) return { ok: false, status: 404, error: "Image not found." };
    return {
      ok: true,
      bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      contentType: detected.contentType,
    };
  } catch {
    return { ok: false, status: 404, error: "Image not found." };
  }
}

async function readStoredItems(admin: Admin, planId: string): Promise<
  { ok: true; items: StoredPlanItem[] } | { ok: false; status: number; error: string }
> {
  if (!isUuid(planId)) return { ok: false, status: 404, error: "Plan not found." };
  const plan = await admin
    .from("drill_analysis_training_plans")
    .select("id")
    .eq("id", planId)
    .eq("scope_key", DRILL_ANALYSIS_SCOPE)
    .maybeSingle();
  if (plan.error) return missingPlansTable(plan.error) ? setupError() : { ok: false, status: 500, error: "The plan could not be saved." };
  if (!plan.data) return { ok: false, status: 404, error: "Plan not found." };
  const items = await admin
    .from("drill_analysis_training_plan_items")
    .select("id, source_session_key, source_entry_id, snapshot, image_path, sort_index")
    .eq("plan_id", planId)
    .eq("scope_key", DRILL_ANALYSIS_SCOPE)
    .order("sort_index", { ascending: true });
  if (items.error) return missingPlansTable(items.error) ? setupError() : { ok: false, status: 500, error: "The plan could not be saved." };
  const stored: StoredPlanItem[] = [];
  for (const row of items.data ?? []) {
    const snapshot = parsePlanSnapshot(row.snapshot);
    if (!snapshot) return { ok: false, status: 500, error: "The saved plan could not be read." };
    stored.push({
      id: String(row.id),
      sourceSessionKey: String(row.source_session_key),
      sourceEntryId: String(row.source_entry_id),
      snapshot,
      imagePath: row.image_path ? String(row.image_path) : null,
    });
  }
  return { ok: true, items: stored };
}

async function removeUploaded(admin: Admin, paths: string[]) {
  if (paths.length === 0) return;
  await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).remove(paths).catch(() => undefined);
}

async function copyPlanImage(admin: Admin, sourcePath: string, planId: string, itemId: string): Promise<string | null> {
  const file = await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).download(sourcePath);
  if (file.error || !file.data) return null;
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  const detected = detectDrillImage(bytes);
  if (!detected) return null;
  const path = `plans/${planId}/${itemId}.${detected.ext}`;
  if (!isPlanImagePath(path)) return null;
  const uploaded = await admin.storage.from(DRILL_ANALYSIS_IMAGE_BUCKET).upload(path, bytes, {
    contentType: detected.contentType,
    upsert: false,
  });
  if (uploaded.error) return null;
  return path;
}

function asItems(value: unknown): { id: string; sort_index: number; snapshot: unknown; image_path: string | null }[] {
  if (Array.isArray(value)) return value as { id: string; sort_index: number; snapshot: unknown; image_path: string | null }[];
  if (value && typeof value === "object") return [value as { id: string; sort_index: number; snapshot: unknown; image_path: string | null }];
  return [];
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
