import { getAppUser } from "@/lib/auth";
import { getTeamSessionDateString } from "@/lib/kioskRpe/localDate";
import { getEligibleSameDayPhoneSubmissions } from "@/lib/kioskRpe/existingSubmission.server";
import type { ExistingSubmissionMap } from "@/lib/kioskRpe/existingSubmission";
import { getKioskBatchCountForDate } from "@/lib/kioskRpe/recentKioskSessions.server";
import { getKioskLockState } from "@/lib/kioskLock/cookies.server";
import { getWellnessSubmittedForDate } from "@/lib/kioskWellness/todaySubmissions.server";
import { listPlayersForKiosk } from "@/lib/players/listPlayers";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/supabase/safeQuery";
import { redirect } from "next/navigation";
import { KioskPinGate } from "./components/KioskPinGate";
import { KioskShellView } from "./components/KioskShellView";

export default async function KioskRpePage() {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "staff") redirect("/dashboard");

  const isKioskLocked = await getKioskLockState();
  if (!isKioskLocked) {
    return <KioskPinGate />;
  }

  const supabase = await createClient();
  const { data: players, error: loadError } = await runQuery("kiosk-rpe-players", () =>
    listPlayersForKiosk(supabase)
  );
  const sessionDate = getTeamSessionDateString();
  let todayKioskBatchCount = 0;
  let todayKioskBatchCountUnavailable = false;

  try {
    const countResult = await getKioskBatchCountForDate(sessionDate);
    if (countResult.error) {
      todayKioskBatchCountUnavailable = true;
      console.error("[kiosk-rpe] Today Kiosk batch count unavailable", countResult.error);
    } else {
      todayKioskBatchCount = countResult.data ?? 0;
    }
  } catch (error) {
    todayKioskBatchCountUnavailable = true;
    console.error("[kiosk-rpe] Today Kiosk batch count failed to load", error);
  }

  const roster = players ?? [];
  let existingSubmissions: ExistingSubmissionMap = {};
  try {
    const existingResult = await getEligibleSameDayPhoneSubmissions({
      date: sessionDate,
      players: roster,
    });
    if (existingResult.error) {
      console.error("[kiosk-rpe] Existing phone submissions unavailable", existingResult.error);
    } else {
      existingSubmissions = existingResult.data;
    }
  } catch (error) {
    console.error("[kiosk-rpe] Existing phone submissions failed to load", error);
  }

  let wellnessSubmittedToday = {};
  try {
    const wellnessResult = await getWellnessSubmittedForDate(
      supabase,
      roster.map((player) => player.id),
      sessionDate
    );
    if (wellnessResult.error) {
      console.error("[kiosk-rpe] Wellness submissions unavailable", wellnessResult.error);
    } else {
      wellnessSubmittedToday = wellnessResult.data;
    }
  } catch (error) {
    console.error("[kiosk-rpe] Wellness submissions failed to load", error);
  }

  const existingKey = Object.values(existingSubmissions)
    .map((row) => row.id)
    .sort()
    .join("|");
  const wellnessKey = Object.keys(wellnessSubmittedToday).sort().join("|");
  const rosterKey = `${roster.map((player) => player.id).join("|")}::${existingKey}::${wellnessKey}`;

  return (
    <KioskShellView
      key={rosterKey}
      players={roster}
      loadError={loadError}
      todayKioskBatchCount={todayKioskBatchCount}
      todayKioskBatchCountUnavailable={todayKioskBatchCountUnavailable}
      existingSubmissions={existingSubmissions}
      wellnessSubmittedToday={wellnessSubmittedToday}
      sessionDate={sessionDate}
    />
  );
}
