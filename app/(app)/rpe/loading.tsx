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

export default function RpeLoading() {
  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: BG_PAGE }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </div>
        <div
          className="flex flex-wrap gap-4 rounded-xl p-4"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
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
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-48 w-full" />
          </div>
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-3 h-64 w-full" />
          </div>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <Skeleton className="h-6 w-full" />
          <Skeleton className="mt-4 h-12 w-full" />
          <Skeleton className="mt-2 h-12 w-full" />
          <Skeleton className="mt-2 h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
