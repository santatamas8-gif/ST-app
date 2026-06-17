import "server-only";

import { getAppUser } from "@/lib/auth";
import {
  buildRecentKioskPlayerNameMap,
  countDistinctKioskBatchIds,
  DEFAULT_RECENT_KIOSK_BATCH_LIMIT,
  groupRecentKioskSessions,
  RECENT_KIOSK_DISCOVERY_ROW_LIMIT,
  type RecentKioskPlayerProfile,
  type RecentKioskSessionRow,
  type RecentKioskSessionSummary,
} from "@/lib/kioskRpe/recentKioskSessions";
import { isValidIsoDateString } from "@/lib/kioskRpe/submitValidation";
import { createClient } from "@/lib/supabase/server";
import type { SafeError } from "@/lib/supabase/safeQuery";

const RECENT_KIOSK_SESSION_FIELDS =
  "id, user_id, date, duration, rpe, load, created_at, session_type, matchday_tag, kiosk_batch_id";

type ServerResult<T> = {
  data: T | null;
  error: SafeError | null;
};

async function requireStaffOrAdmin(): Promise<SafeError | null> {
  const user = await getAppUser();
  if (!user) {
    return { code: "unauthorized", message: "Unauthorized" };
  }
  if (user.role !== "admin" && user.role !== "staff") {
    return { code: "forbidden", message: "Forbidden" };
  }
  return null;
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_RECENT_KIOSK_BATCH_LIMIT;
  return Math.max(1, Math.floor(limit));
}

function toSafeError(area: string, error: { code?: string; message?: string } | null): SafeError {
  const code = error?.code ?? "unknown";
  const message = error?.message ?? "Unknown error";
  console.error("[recentKioskSessions]", { area, code, message, details: error });
  return { code: String(code), message };
}

export async function getRecentKioskSessions(
  limit = DEFAULT_RECENT_KIOSK_BATCH_LIMIT
): Promise<ServerResult<RecentKioskSessionSummary[]>> {
  const authError = await requireStaffOrAdmin();
  if (authError) return { data: null, error: authError };

  const batchLimit = normalizeLimit(limit);
  const supabase = await createClient();

  const discoveryRes = await supabase
    .from("sessions")
    .select("kiosk_batch_id, created_at")
    .not("kiosk_batch_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_KIOSK_DISCOVERY_ROW_LIMIT);

  if (discoveryRes.error) {
    return {
      data: null,
      error: toSafeError("recent-kiosk-discovery", discoveryRes.error),
    };
  }

  const batchIds: string[] = [];
  const seenBatchIds = new Set<string>();
  for (const row of discoveryRes.data ?? []) {
    const batchId = typeof row.kiosk_batch_id === "string" ? row.kiosk_batch_id.trim() : "";
    if (!batchId || seenBatchIds.has(batchId)) continue;
    seenBatchIds.add(batchId);
    batchIds.push(batchId);
    if (batchIds.length >= batchLimit) break;
  }

  if (batchIds.length === 0) {
    return { data: [], error: null };
  }

  const sessionsRes = await supabase
    .from("sessions")
    .select(RECENT_KIOSK_SESSION_FIELDS)
    .in("kiosk_batch_id", batchIds)
    .order("created_at", { ascending: false });

  if (sessionsRes.error) {
    return {
      data: null,
      error: toSafeError("recent-kiosk-sessions", sessionsRes.error),
    };
  }

  const rows = (sessionsRes.data ?? []) as RecentKioskSessionRow[];
  const playerIds = [...new Set(rows.map((row) => row.user_id))];
  let playerNameById: Record<string, string> = {};

  if (playerIds.length > 0) {
    const profilesRes = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", playerIds);

    if (profilesRes.error) {
      console.error("[recentKioskSessions]", {
        area: "recent-kiosk-profiles",
        code: profilesRes.error.code ?? "unknown",
        message: profilesRes.error.message ?? "Unknown error",
        details: profilesRes.error,
      });
    } else {
      playerNameById = buildRecentKioskPlayerNameMap(
        (profilesRes.data ?? []) as RecentKioskPlayerProfile[]
      );
    }
  }

  return {
    data: groupRecentKioskSessions(rows, playerNameById).slice(0, batchLimit),
    error: null,
  };
}

export async function getKioskBatchCountForDate(
  date: string
): Promise<ServerResult<number>> {
  const normalizedDate = date.trim();
  if (!isValidIsoDateString(normalizedDate)) {
    return {
      data: null,
      error: { code: "invalid_date", message: "date must be a valid YYYY-MM-DD value." },
    };
  }

  const authError = await requireStaffOrAdmin();
  if (authError) return { data: null, error: authError };

  const supabase = await createClient();
  const sessionsRes = await supabase
    .from("sessions")
    .select("kiosk_batch_id")
    .eq("date", normalizedDate)
    .not("kiosk_batch_id", "is", null);

  if (sessionsRes.error) {
    return {
      data: null,
      error: toSafeError("kiosk-batch-count-for-date", sessionsRes.error),
    };
  }

  return {
    data: countDistinctKioskBatchIds(sessionsRes.data ?? []),
    error: null,
  };
}
