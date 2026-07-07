import { notFound } from "next/navigation";
import { getPrintCards } from "@/app/actions/strength";
import { PrintPageClient } from "./PrintPageClient";

export default async function PrintStrengthCardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cards = await getPrintCards(id);
  if (!cards.length) notFound();
  return <PrintPageClient cards={cards} />;
}
