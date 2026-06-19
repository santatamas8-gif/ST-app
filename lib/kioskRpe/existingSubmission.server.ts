import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildExistingSubmissionMap,
  type ExistingSubmissionMap,
  type ExistingKioskSubmissionRow,
} from "@/lib/kioskRpe/existingSubmission";

const EXISTING_SUBMISSION_FIELDS =
  "id, user_id, date, duration, rpe, load, session_type, matchday_tag, kiosk_batch_id, created_at";

export async function getEligibleSameDayPhoneSubmissions({
  date,
  players,
}: {
  date: string;
  players: { id: string }[];
}): Promise<{
  data: ExistingSubmissionMap;
  conflictPlayerIds: string[];
  error: { message: string; code?: string } | null;
}> {
  if (players.length === 0) {
    return { data: {}, conflictPlayerIds: [], error: null };
  }

  const playerIds = players.map((player) => player.id);
  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    return {
      data: {},
      conflictPlayerIds: [],
      error: {
        message: error instanceof Error ? error.message : "Admin client unavailable.",
      },
    };
  }

  const { data, error } = await admin
    .from("sessions")
    .select(EXISTING_SUBMISSION_FIELDS)
    .eq("date", date)
    .in("user_id", playerIds)
    .is("kiosk_batch_id", null);

  if (error) {
    return { data: {}, conflictPlayerIds: [], error };
  }

  const result = buildExistingSubmissionMap(
    (data ?? []) as ExistingKioskSubmissionRow[],
    players,
    date
  );

  if (result.conflictPlayerIds.length > 0) {
    console.warn("[kiosk-rpe] Multiple eligible same-day phone submissions", {
      date,
      conflictPlayerIds: result.conflictPlayerIds,
    });
  }

  return {
    data: result.submissions,
    conflictPlayerIds: result.conflictPlayerIds,
    error: null,
  };
}
