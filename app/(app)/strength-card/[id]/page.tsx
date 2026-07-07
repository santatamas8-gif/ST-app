import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMyStrengthCard } from "@/app/actions/strength";
import { getAppUser } from "@/lib/auth";
import { PlayerStrengthCardView } from "@/components/strength/PlayerStrengthCardView";

export default async function StrengthCardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (user.role !== "player") redirect("/forbidden");

  const { id } = await params;
  const card = await getMyStrengthCard(id);
  if (!card) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link href="/strength-card" className="text-sm text-zinc-400 hover:text-white">
        ← All cards
      </Link>
      <PlayerStrengthCardView
        playerName={card.player_name}
        playerAvatarUrl={card.player_avatar_url}
        date={card.session.date}
        title={card.session.title}
        sessionType={card.session.session_type}
        items={card.items}
        exerciseImages={card.exerciseImages}
      />
    </div>
  );
}
