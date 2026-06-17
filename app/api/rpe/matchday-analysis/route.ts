import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { listPlayersForKiosk, playerDisplayName } from "@/lib/players/listPlayers";
import { validateDateRange } from "@/lib/kioskRpe/matchdayAnalytics";
import { createClient } from "@/lib/supabase/server";
import type { SessionRow } from "@/lib/types";

const SESSION_FIELDS =
  "id, user_id, date, duration, rpe, load, session_type, matchday_tag";

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const rangeCheck = validateDateRange(from, to);
  if (!rangeCheck.valid) {
    return NextResponse.json({ error: rangeCheck.message }, { status: 400 });
  }

  const supabase = await createClient();

  const [sessionsRes, playersRes] = await Promise.all([
    supabase
      .from("sessions")
      .select(SESSION_FIELDS)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
    listPlayersForKiosk(supabase),
  ]);

  if (sessionsRes.error) {
    return NextResponse.json(
      { error: sessionsRes.error.message, code: sessionsRes.error.code },
      { status: 500 }
    );
  }
  if (playersRes.error) {
    return NextResponse.json(
      { error: playersRes.error.message, code: playersRes.error.code },
      { status: 500 }
    );
  }

  const sessions = (sessionsRes.data ?? []) as SessionRow[];
  const players = playersRes.data.map((p) => ({ id: p.id, name: p.name }));

  const nameByUserId: Record<string, string> = {};
  for (const player of players) {
    nameByUserId[player.id] = player.name;
  }
  for (const session of sessions) {
    if (!nameByUserId[session.user_id]) {
      nameByUserId[session.user_id] = playerDisplayName(null, session.user_id);
    }
  }

  return NextResponse.json({
    sessions,
    players,
    displayNameByUserId: nameByUserId,
  });
}
