import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/dashboard";
import { getStaffAttentionToday } from "@/lib/staffAttention";

export async function GET() {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await getDashboardData(user);
    const metrics = {
      todayWellness: data.metrics.todayWellnessAvg ?? null,
      avgSleepHours: data.metrics.avgSleepHours ?? null,
      readiness: data.metrics.readiness ?? null,
      monotony: data.metrics.monotonyValue,
      strain: data.metrics.strainValue,
      redFlags: data.metrics.redFlags ?? [],
      todayWellnessCount: data.metrics.todayWellnessCount,
      todaySessionsCount: data.metrics.todaySessionsCount,
      totalPlayers: data.metrics.totalPlayers,
      totalTeamLoadToday: data.metrics.totalTeamLoadToday,
    };
    const isStaff = user.role === "admin" || user.role === "staff";
    const attentionToday = isStaff ? await getStaffAttentionToday() : null;

    let playersWithStatus: { id: string; email: string; full_name: string | null; status: string; avatar_url: string | null }[] = [];
    if (isStaff) {
      const supabase = await createClient();
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .eq("role", "player")
        .order("full_name", { ascending: true });
      const playerIds = (profiles ?? []).map((p) => p.id);
      let statusByUser = new Map<string, string>();
      if (playerIds.length > 0) {
        const { data: statusRows, error: statusErr } = await supabase
          .from("player_status")
          .select("user_id, status")
          .in("user_id", playerIds);
        if (!statusErr && statusRows) {
          statusByUser = new Map(
            statusRows.map((r) => [r.user_id, r.status as string])
          );
        }
      }
      playersWithStatus = (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email ?? "",
        full_name: p.full_name ?? null,
        status: statusByUser.get(p.id) ?? "available",
        avatar_url: p.avatar_url ?? null,
      }));
    }

    const today = new Date().toISOString().slice(0, 10);
    const supabaseForSchedule = await createClient();
    const { data: todayRows } = await supabaseForSchedule
      .from("schedule")
      .select("id, activity_type, sort_order, start_time, end_time")
      .eq("date", today)
      .order("sort_order", { ascending: true });

    const raw = (todayRows ?? []).map((r) => ({
      id: r.id,
      activity_type: r.activity_type as string,
      sort_order: r.sort_order ?? 0,
      start_time: r.start_time != null ? String(r.start_time).slice(0, 5) : null,
      end_time: r.end_time != null ? String(r.end_time).slice(0, 5) : null,
    }));
    const todayScheduleItems = [...raw].sort((a, b) => {
      const aStart = a.start_time ?? "zzz";
      const bStart = b.start_time ?? "zzz";
      return aStart.localeCompare(bStart) || a.sort_order - b.sort_order;
    });

    const todayScheduleItem =
      todayScheduleItems.length > 0
        ? { activity_type: todayScheduleItems[0].activity_type }
        : null;

    return NextResponse.json({
      role: user.role,
      metrics,
      chart7: data.chart7,
      chart28: data.chart28,
      attentionToday,
      todayScheduleItem,
      todayScheduleItems,
      playersWithStatus,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const code = e instanceof Error ? (e as { code?: string }).code ?? "DASHBOARD_ERROR" : "DASHBOARD_ERROR";
    console.error("[dashboard-api]", { area: "dashboard", code, message, details: String(e) });
    return NextResponse.json(
      { errorCode: "DASHBOARD_ERROR", error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
