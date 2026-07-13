import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMyStrengthCard } from "@/app/actions/strength";
import { getPublicTeamLogo } from "@/app/actions/teamSettings";
import { getAppUser } from "@/lib/auth";
import { PLAYER_STRENGTH_CARD_ENABLED } from "@/lib/strength/playerCardEnabled";
import { PlayerStrengthCardView } from "@/components/strength/PlayerStrengthCardView";

export default async function StrengthCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (!PLAYER_STRENGTH_CARD_ENABLED && user.role === "player") redirect("/dashboard");
  if (user.role !== "player") redirect("/forbidden");

  const { id } = await params;
  const [card, { team_logo_url }] = await Promise.all([getMyStrengthCard(id), getPublicTeamLogo()]);
  if (!card) notFound();

  const session = card.session;
  if (!session?.date || !session?.title) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/strength-card" className="text-sm text-zinc-400 hover:text-white">
        ← All cards
      </Link>
      <PlayerStrengthCardView
        playerName={card.player_name}
        playerAvatarUrl={card.player_avatar_url}
        teamLogoUrl={team_logo_url}
        date={card.session.date}
        title={card.session.title}
        sessionType={card.session.session_type}
        items={card.items}
        exerciseImages={card.exerciseImages}
      />
    </div>
  );
}
