import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";
import type { WellnessRow } from "@/lib/types";
import type { SessionRow } from "@/lib/types";
import { averageWellness, averageSleepHours } from "@/utils/wellness";
import { monotony, strain } from "@/utils/metrics";
import { readinessScore } from "@/utils/readiness";
import { detectRedFlags } from "@/utils/redFlags";

const DAYS_7 = 7;
const DAYS_28 = 28;

function getDateRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export interface DashboardMetrics {
  todayWellnessAvg: number | null;
  avgSleepHours: number | null;
  weeklyLoad: number;
  previousWeekLoad: number | null;
  monotonyValue: number;
  strainValue: number;
  readiness: number | null;
  redFlags: { type: string; label: string; value?: string | number }[];
  todayFatigue: number | null;
  /** Staff: hány játékos töltötte ki a mai wellness-t */
  todayWellnessCount?: number;
  /** Staff: hány edzés/rpe bejegyzés van ma */
  todaySessionsCount?: number;
}

export interface ChartPoint {
  date: string;
  load: number;
  wellness: number | null;
  sleepHours: number | null;
}

export async function getDashboardData(
  user: AppUser
): Promise<{
  metrics: DashboardMetrics;
  chart7: ChartPoint[];
  chart28: ChartPoint[];
}> {
  const supabase = await createClient();
  const { from: from7, to: to7 } = getDateRange(DAYS_7);
  const { from: from28, to: to28 } = getDateRange(DAYS_28);
  const { from: from14 } = getDateRange(14);

  let wellnessQuery = supabase
    .from("wellness")
    .select("*")
    .gte("date", from28)
    .lte("date", to28)
    .order("date", { ascending: true });

  let sessionsQuery = supabase
    .from("sessions")
    .select("*")
    .gte("date", from28)
    .lte("date", to28)
    .order("date", { ascending: true });

  if (user.role === "player") {
    wellnessQuery = wellnessQuery.eq("user_id", user.id);
    sessionsQuery = sessionsQuery.eq("user_id", user.id);
  }

  const [wellnessRes, sessionsRes] = await Promise.all([
    wellnessQuery,
    sessionsQuery,
  ]);

  const wellnessRows = (wellnessRes.data ?? []) as WellnessRow[];
  const sessionRows = (sessionsRes.data ?? []) as SessionRow[];

  const today = new Date().toISOString().slice(0, 10);
  const todayWellness = wellnessRows.filter((r) => r.date === today);
  const todayWellnessAvg =
    todayWellness.length > 0 ? averageWellness(todayWellness) : null;
  const avgSleep =
    todayWellness.length > 0 ? averageSleepHours(todayWellness) : null;
  const todayFatigue =
    todayWellness.length > 0
      ? Math.max(...todayWellness.map((r) => r.fatigue ?? 0), 0) || null
      : null;

  const last7Days = sessionRows.filter(
    (s) => s.date >= from7 && s.date <= to7
  );
  const previous7From = new Date(from7);
  previous7From.setDate(previous7From.getDate() - 7);
  const previous7To = new Date(from7);
  previous7To.setDate(previous7To.getDate() - 1);
  const prev7FromStr = previous7From.toISOString().slice(0, 10);
  const prev7ToStr = previous7To.toISOString().slice(0, 10);
  const previous7Sessions = sessionRows.filter(
    (s) => s.date >= prev7FromStr && s.date <= prev7ToStr
  );

  const weeklyLoad = last7Days.reduce((sum, s) => sum + (s.load ?? 0), 0);
  const previousWeekLoad = previous7Sessions.reduce(
    (sum, s) => sum + (s.load ?? 0),
    0
  );
  const dailyLoads7 = getDailyLoads(last7Days, from7, to7);
  const monotonyValue = monotony(dailyLoads7);
  const strainValue = strain(weeklyLoad, monotonyValue);

  const avgSleepHours7 =
    wellnessRows.filter((r) => r.date >= from7 && r.date <= to7).length > 0
      ? averageSleepHours(
          wellnessRows.filter((r) => r.date >= from7 && r.date <= to7)
        )
      : null;

  const readiness =
    todayWellness.length === 0
      ? null
      : todayWellness.length === 1
        ? readinessScore({
            sleepQuality: todayWellness[0].sleep_quality ?? null,
            soreness: todayWellness[0].soreness ?? null,
            fatigue: todayWellness[0].fatigue ?? null,
            stress: todayWellness[0].stress ?? null,
            mood: todayWellness[0].mood ?? null,
            sleepHours: todayWellness[0].sleep_duration ?? avgSleep ?? null,
          })
        : (() => {
            const scores = todayWellness
              .map((r) =>
                readinessScore({
                  sleepQuality: r.sleep_quality ?? null,
                  soreness: r.soreness ?? null,
                  fatigue: r.fatigue ?? null,
                  stress: r.stress ?? null,
                  mood: r.mood ?? null,
                  sleepHours: r.sleep_duration ?? null,
                })
              )
              .filter((s): s is number => s != null);
            if (scores.length === 0) return null;
            return Math.round(
              scores.reduce((a, b) => a + b, 0) / scores.length
            );
          })();

  const redFlags = detectRedFlags({
    wellnessAverage: todayWellnessAvg,
    avgSleepHours: avgSleep ?? avgSleepHours7,
    monotonyValue,
    weeklyLoad,
    previousWeekLoad: previousWeekLoad > 0 ? previousWeekLoad : null,
    fatigue: todayFatigue,
  });

  const todaySessionsCount =
    user.role === "player"
      ? undefined
      : sessionRows.filter((s) => s.date === today).length;

  const chart7 = buildChartData(
    wellnessRows.filter((r) => r.date >= from7 && r.date <= to7),
    sessionRows.filter((s) => s.date >= from7 && s.date <= to7),
    from7,
    to7
  );
  const chart28 = buildChartData(
    wellnessRows,
    sessionRows,
    from28,
    to28
  );

  return {
    metrics: {
      todayWellnessAvg,
      avgSleepHours: avgSleep ?? avgSleepHours7,
      weeklyLoad,
      previousWeekLoad: previousWeekLoad > 0 ? previousWeekLoad : null,
      monotonyValue,
      strainValue,
      readiness,
      redFlags,
      todayFatigue,
      todayWellnessCount: user.role === "player" ? undefined : todayWellness.length,
      todaySessionsCount,
    },
    chart7,
    chart28,
  };
}

function getDailyLoads(sessions: SessionRow[], from: string, to: string): number[] {
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    const current = byDate.get(s.date) ?? 0;
    byDate.set(s.date, current + (s.load ?? 0));
  }
  const result: number[] = [];
  const d = new Date(from);
  const end = new Date(to);
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    result.push(byDate.get(key) ?? 0);
    d.setDate(d.getDate() + 1);
  }
  return result;
}

function buildChartData(
  wellness: WellnessRow[],
  sessions: SessionRow[],
  from: string,
  to: string
): ChartPoint[] {
  const wellnessByDate = new Map<string, WellnessRow[]>();
  for (const w of wellness) {
    const list = wellnessByDate.get(w.date) ?? [];
    list.push(w);
    wellnessByDate.set(w.date, list);
  }
  const loadByDate = new Map<string, number>();
  for (const s of sessions) {
    const current = loadByDate.get(s.date) ?? 0;
    loadByDate.set(s.date, current + (s.load ?? 0));
  }

  const points: ChartPoint[] = [];
  const d = new Date(from);
  const end = new Date(to);
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    const wList = wellnessByDate.get(key) ?? [];
    const wellnessAvg =
      wList.length > 0 ? averageWellness(wList) : null;
    const sleepAvg =
      wList.length > 0 ? averageSleepHours(wList) : null;
    points.push({
      date: key,
      load: loadByDate.get(key) ?? 0,
      wellness: wellnessAvg,
      sleepHours: sleepAvg,
    });
    d.setDate(d.getDate() + 1);
  }
  return points;
}
