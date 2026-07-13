import Link from "next/link";
import { getSessionsList } from "@/app/actions/strength";

export default async function StrengthAdminPage() {
  const sessions = await getSessionsList();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Strength Cards</h1>
          <p className="mt-1 text-sm text-zinc-400">Daily strength session builder</p>
        </div>
        <Link
          href="/admin/strength/create"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          New Session
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/strength/exercises" className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:bg-zinc-800">
          Exercises
        </Link>
        <Link href="/admin/strength/profiles" className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300 hover:bg-zinc-800">
          Player Profiles
        </Link>
      </nav>

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-6 text-center text-zinc-400">
            No sessions yet. Create your first daily strength session.
          </p>
        ) : (
          sessions.map((s) => {
            const cardCount = Array.isArray(s.daily_strength_player_cards)
              ? s.daily_strength_player_cards[0]?.count ?? 0
              : 0;
            return (
              <Link
                key={s.id}
                href={`/admin/strength/sessions/${s.id}`}
                className="block rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4 transition hover:border-emerald-600/40 hover:bg-zinc-900/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-white">{s.title}</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {s.date} · {s.session_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.status === "published"
                          ? "bg-emerald-600/20 text-emerald-400"
                          : "bg-amber-600/20 text-amber-400"
                      }`}
                    >
                      {s.status}
                    </span>
                    {cardCount > 0 && (
                      <span className="text-xs text-zinc-500">{cardCount} cards</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
