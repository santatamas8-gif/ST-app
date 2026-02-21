import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
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
    return NextResponse.json({
      role: user.role,
      metrics,
      chart7: data.chart7,
      chart28: data.chart28,
      attentionToday,
    });
  } catch (e) {
    console.error("Dashboard API error:", e);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
