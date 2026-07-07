import { notFound } from "next/navigation";
import { getPlayersWithProfiles, getSessionDetail, getStrengthExercises } from "@/app/actions/strength";
import { normalizeAvatarUrl, playerDisplayName } from "@/lib/players/listPlayers";
import { fetchExerciseImageMap } from "@/lib/strength/exerciseImages";
import type { StrengthProfile } from "@/lib/strength/types";
import { createClient } from "@/lib/supabase/server";
import { SessionDetailView } from "./SessionDetailView";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getSessionDetail(id);
  if (!detail) notFound();

  const players = await getPlayersWithProfiles();
  const allExercises = await getStrengthExercises();
  const playerOptions = players.map((p) => ({
    id: p.id,
    name: p.name,
    hasProfile: p.profile != null,
  }));

  let previewCard = null;
  if (detail.cards.length > 0) {
    const firstCard = detail.cards[0];
    const supabase = await createClient();
    const { data: items } = await supabase
      .from("daily_strength_player_card_items")
      .select("*")
      .eq("card_id", firstCard.id)
      .order("exercise_order")
      .order("set_number");

    const { data: previewProfileRow } = await supabase
      .from("strength_profiles")
      .select("*")
      .eq("player_id", firstCard.player_id)
      .maybeSingle();

    const profile = firstCard.profiles as {
      full_name: string | null;
      email: string | null;
      avatar_url: string | null;
    } | null;
    const cardItems = items ?? [];
    const exerciseImages = await fetchExerciseImageMap(supabase, cardItems);
    previewCard = {
      playerName: playerDisplayName(profile?.full_name, profile?.email),
      playerAvatarUrl: normalizeAvatarUrl(profile?.avatar_url),
      previewProfile: (previewProfileRow as StrengthProfile | null) ?? null,
      items: cardItems,
      exerciseImages,
    };
  }

  return (
    <SessionDetailView
      key={`${id}-${detail.cards.length}-${detail.cards[0]?.id ?? "none"}-${previewCard?.items.length ?? 0}`}
      sessionId={id}
      session={detail.session}
      exercises={detail.exercises}
      cards={detail.cards}
      players={playerOptions}
      allExercises={allExercises}
      previewCard={previewCard}
    />
  );
}
