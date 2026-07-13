import { notFound } from "next/navigation";
import { getPrintCards } from "@/app/actions/strength";
import { getPublicTeamLogo } from "@/app/actions/teamSettings";
import { PrintPageClient } from "./PrintPageClient";

export default async function PrintStrengthCardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [cards, { team_logo_url }] = await Promise.all([getPrintCards(id), getPublicTeamLogo()]);
  if (!cards.length) notFound();
  return <PrintPageClient cards={cards} teamLogoUrl={team_logo_url} />;
}
