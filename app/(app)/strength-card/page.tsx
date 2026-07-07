import Link from "next/link";
import { getMyPublishedStrengthCards } from "@/app/actions/strength";
import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";

export default async function StrengthCardListPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");
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
            };
            return (
              <Link
                key={card.id}
                href={`/strength-card/${card.id}`}
                className="block rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4 transition hover:border-emerald-600/40"
              >
                <h2 className="font-semibold text-white">{session.title}</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {session.date} · {session.session_type}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
