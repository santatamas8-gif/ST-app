import Link from "next/link";
import { getMyPublishedStrengthCards } from "@/app/actions/strength";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { PLAYER_STRENGTH_CARD_ENABLED } from "@/lib/strength/playerCardEnabled";

export default async function StrengthCardListPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (!PLAYER_STRENGTH_CARD_ENABLED && user.role === "player") redirect("/dashboard");
  if (user.role !== "player") redirect("/forbidden");

  const cards = await getMyPublishedStrengthCards();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Strength Card</h1>
        <p className="mt-1 text-sm text-zinc-400">Your published training cards</p>
      </div>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-6 text-center text-zinc-400">
          No strength cards yet. Your coach will publish cards when ready.
        </p>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const session = card.daily_strength_sessions as {
              date: string;
              title: string;
              session_type: string;
            } | null;
            const title = session?.title ?? "Strength session";
            const date =
              session?.date ??
              (card.published_at ? card.published_at.slice(0, 10) : null) ??
              "—";
            const sessionType = session?.session_type ?? "";
            return (
              <Link
                key={card.id}
                href={`/strength-card/${card.id}`}
                className="block rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4 transition hover:border-emerald-600/40"
              >
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {date}
                  {sessionType ? ` · ${sessionType}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
