const BG_PAGE = "#0b0f14";
const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-zinc-700/50 ${className}`}
      aria-hidden
    />
  );
}

export default function WellnessLoading() {
  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: BG_PAGE }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <div
          className="flex flex-wrap gap-4 rounded-xl p-4"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl p-4"
              style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-16" />
            </div>
          ))}
        </div>
        <div
          className="overflow-hidden rounded-xl"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <div className="border-b border-zinc-700 px-4 py-3">
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-4 w-20" />
              ))}
            </div>
          </div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex gap-4 border-b border-zinc-800 px-4 py-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                <Skeleton key={j} className="h-5 w-16" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
