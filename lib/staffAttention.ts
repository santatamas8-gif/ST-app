import { createClient } from "@/lib/supabase/server";
import type { WellnessRow } from "@/lib/types";
import { readinessScore } from "@/utils/readiness";
import { averageWellness } from "@/utils/wellness";

const READINESS_AT_RISK_BELOW = 50;
const FATIGUE_AT_RISK_ABOVE = 7;
const SORENESS_AT_RISK_ABOVE = 7;

export interface AttentionPlayer {
  user_id: string;
  email: string;
  full_name?: string | null;
}

export interface AtRiskPlayer extends AttentionPlayer {
  reason?: string;
  wellness?: number | null;
  fatigue?: number | null;
  load?: number;
}

export interface StaffAttentionToday {
  missingWellness: AttentionPlayer[];
  atRisk: AtRiskPlayer[];
}

export async function getStaffAttentionToday(): Promise<StaffAttentionToday | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: players } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "player");

  if (!players?.length) return { missingWellness: [], atRisk: [] };

  const [wellnessRes, sessionsRes] = await Promise.all([
    supabase.from("wellness").select("*").eq("date", today),
    supabase.from("sessions").select("user_id, load").eq("date", today),
  ]);

  const wellnessRows = (wellnessRes.data ?? []) as WellnessRow[];
  const todaySessions = sessionsRes.data ?? [];
  const loadByUser = new Map<string, number>();
  for (const s of todaySessions) {
    const uid = (s as { user_id: string; load?: number }).user_id;
    const load = (s as { user_id: string; load?: number }).load ?? 0;
    loadByUser.set(uid, (loadByUser.get(uid) ?? 0) + load);
  }

  const submittedIds = new Set(wellnessRows.map((r) => r.user_id));
  const emailById = new Map(players.map((p) => [p.id, p.email ?? "—"]));
  const fullNameById = new Map(players.map((p) => [p.id, p.full_name ?? null]));

  const missingWellness: AttentionPlayer[] = players
    .filter((p) => !submittedIds.has(p.id))
    .map((p) => ({ user_id: p.id, email: p.email ?? "—", full_name: p.full_name ?? null }));

  const atRisk: AtRiskPlayer[] = [];
  for (const row of wellnessRows) {
    const readiness = readinessScore({
      sleepQuality: row.sleep_quality ?? null,
      soreness: row.soreness ?? null,
      fatigue: row.fatigue ?? null,
      stress: row.stress ?? null,
      mood: row.mood ?? null,
      sleepHours: row.sleep_duration ?? null,
    });
    const wellnessScore = averageWellness([row]);
    const reasons: string[] = [];
    if (readiness != null && readiness < READINESS_AT_RISK_BELOW)
      reasons.push(`readiness ${readiness}`);
    if ((row.fatigue ?? 0) >= FATIGUE_AT_RISK_ABOVE)
      reasons.push(`fatigue ${row.fatigue}`);
    if ((row.soreness ?? 0) >= SORENESS_AT_RISK_ABOVE)
      reasons.push(`soreness ${row.soreness}`);
    if (reasons.length > 0) {
      atRisk.push({
        user_id: row.user_id,
        email: emailById.get(row.user_id) ?? "—",
        full_name: fullNameById.get(row.user_id) ?? null,
        reason: reasons.join(", "),
        wellness: wellnessScore,
        fatigue: row.fatigue ?? null,
        load: loadByUser.get(row.user_id) ?? 0,
      });
    }
  }

  return { missingWellness, atRisk };
}
