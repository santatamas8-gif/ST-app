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

    let todayScheduleItem: { activity_type: string } | null = null;
    if (user.role === "player") {
      const today = new Date().toISOString().slice(0, 10);
      const supabase = await createClient();
      const { data: scheduleRow } = await supabase
        .from("schedule")
        .select("activity_type")
        .eq("date", today)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (scheduleRow) todayScheduleItem = { activity_type: scheduleRow.activity_type };
    }

    return NextResponse.json({
      role: user.role,
      metrics,
      chart7: data.chart7,
      chart28: data.chart28,
      attentionToday,
      todayScheduleItem,
      playersWithStatus,
    });
  } catch (e) {
    console.error("Dashboard API error:", e);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
