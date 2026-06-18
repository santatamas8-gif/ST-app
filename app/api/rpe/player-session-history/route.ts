import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
import { MATCHDAY_TAGS, SESSION_TYPES } from "@/lib/kioskRpe/constants";
import {
  PLAYER_SESSION_HISTORY_ALL_MATCHDAYS,
  PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES,
  PLAYER_SESSION_HISTORY_NO_TAG,
  buildPlayerSessionHistory,
  calculatePlayerSessionHistorySummary,
  isPlayerSessionHistoryLimit,
  type PlayerSessionHistoryLimit,
} from "@/lib/rpe/playerSessionHistory";
import { createClient } from "@/lib/supabase/server";
import type { SessionRow } from "@/lib/types";

const SESSION_FIELDS =
  "id, user_id, date, duration, rpe, load, session_type, matchday_tag, created_at";
const PAGE_SIZE = 500;
const MAX_QUERY_ROWS = 2500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseLimit(value: string | null): PlayerSessionHistoryLimit | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || !isPlayerSessionHistoryLimit(parsed)) return null;
  return parsed;
}

function parseMatchday(value: string | null): string | null {
  const decoded = value ?? PLAYER_SESSION_HISTORY_ALL_MATCHDAYS;
  if (decoded === PLAYER_SESSION_HISTORY_ALL_MATCHDAYS) return decoded;
  if (decoded === PLAYER_SESSION_HISTORY_NO_TAG) return decoded;
  if ((MATCHDAY_TAGS as readonly string[]).includes(decoded)) return decoded;
  return null;
}

function parseSessionType(value: string | null): string | null {
  const decoded = value ?? PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES;
  if (decoded === PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES) return decoded;
  if ((SESSION_TYPES as readonly string[]).includes(decoded)) return decoded;
  return null;
}

export async function GET(request: Request) {
  const user = await getAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin" && user.role !== "staff") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("playerId") ?? "";
  const limit = parseLimit(searchParams.get("limit"));
  const matchdayFilter = parseMatchday(searchParams.get("matchday"));
  const sessionTypeFilter = parseSessionType(searchParams.get("sessionType"));

  if (!UUID_RE.test(playerId)) {
    return NextResponse.json({ error: "Invalid player." }, { status: 400 });
  }
  if (limit === null) {
    return NextResponse.json({ error: "Invalid history length." }, { status: 400 });
  }
  if (matchdayFilter === null) {
    return NextResponse.json({ error: "Invalid matchday filter." }, { status: 400 });
  }
  if (sessionTypeFilter === null) {
    return NextResponse.json({ error: "Invalid session type filter." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", playerId)
    .eq("role", "player")
    .maybeSingle();

  if (profileError) {
    console.error("[rpe/player-session-history] player verification failed", profileError);
    return NextResponse.json({ error: "Unable to load session history." }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Invalid player." }, { status: 400 });
  }

  const fetched: SessionRow[] = [];
  for (let offset = 0; offset < MAX_QUERY_ROWS; offset += PAGE_SIZE) {
    let query = supabase
      .from("sessions")
      .select(SESSION_FIELDS)
      .eq("user_id", playerId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (matchdayFilter === PLAYER_SESSION_HISTORY_NO_TAG) {
      query = query.or("matchday_tag.is.null,matchday_tag.eq.");
    } else if (matchdayFilter !== PLAYER_SESSION_HISTORY_ALL_MATCHDAYS) {
      query = query.eq("matchday_tag", matchdayFilter);
    }

    if (sessionTypeFilter !== PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES) {
      query = query.eq("session_type", sessionTypeFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[rpe/player-session-history] sessions query failed", error);
      return NextResponse.json({ error: "Unable to load session history." }, { status: 500 });
    }

    fetched.push(...((data ?? []) as SessionRow[]));
    const distinctDates = new Set(fetched.map((session) => session.date));
    if ((data ?? []).length < PAGE_SIZE || distinctDates.size > limit) {
      break;
    }
  }

  const daysNewestFirst = buildPlayerSessionHistory(fetched, {
    playerId,
    limit,
    matchdayFilter,
    sessionTypeFilter,
  });
  const daysChronological = buildPlayerSessionHistory(fetched, {
    playerId,
    limit,
    matchdayFilter,
    sessionTypeFilter,
    chartOrder: "chronological",
  });

  return NextResponse.json({
    daysNewestFirst,
    daysChronological,
    summary: calculatePlayerSessionHistorySummary(daysNewestFirst),
  });
}
