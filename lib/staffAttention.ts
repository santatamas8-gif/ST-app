import { createClient } from "@/lib/supabase/server";
import type { WellnessRow } from "@/lib/types";
import { readinessScore } from "@/utils/readiness";

const READINESS_AT_RISK_BELOW = 50;
const FATIGUE_AT_RISK_ABOVE = 7;
const SORENESS_AT_RISK_ABOVE = 7;

export interface AttentionPlayer {
  user_id: string;
  email: string;
}

export interface StaffAttentionToday {
  missingWellness: AttentionPlayer[];
  atRisk: (AttentionPlayer & { reason?: string })[];
}

export async function getStaffAttentionToday(): Promise<StaffAttentionToday | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: players } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("role", "player");

  if (!players?.length) return { missingWellness: [], atRisk: [] };

  const { data: todayWellness } = await supabase
    .from("wellness")
    .select("*")
    .eq("date", today);

  const wellnessRows = (todayWellness ?? []) as WellnessRow[];
  const submittedIds = new Set(wellnessRows.map((r) => r.user_id));
  const emailById = new Map(players.map((p) => [p.id, p.email ?? "—"]));

  const missingWellness: AttentionPlayer[] = players
    .filter((p) => !submittedIds.has(p.id))
    .map((p) => ({ user_id: p.id, email: p.email ?? "—" }));

  const atRisk: (AttentionPlayer & { reason?: string })[] = [];
  for (const row of wellnessRows) {
    const readiness = readinessScore({
      sleepQuality: row.sleep_quality ?? null,
      soreness: row.soreness ?? null,
      fatigue: row.fatigue ?? null,
      stress: row.stress ?? null,
      mood: row.mood ?? null,
      sleepHours: row.sleep_duration ?? null,
    });
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
        reason: reasons.join(", "),
      });
    }
  }

  return { missingWellness, atRisk };
}
