export default function PlayersLoading() {
  return (
    <div className="min-w-0 -mx-4 overflow-x-hidden space-y-6 px-3 sm:mx-0 sm:px-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-zinc-800" />
        <div className="h-4 w-48 animate-pulse rounded bg-zinc-800" />
      </div>
      <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-5">
        <div className="mb-4 h-5 w-32 animate-pulse rounded bg-zinc-800" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-zinc-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
