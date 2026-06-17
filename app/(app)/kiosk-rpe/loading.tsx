export default function KioskRpeLoading() {
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 shrink-0 animate-pulse rounded bg-zinc-800" />
        <div className="space-y-2">
          <div className="h-8 w-40 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
      <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-5">
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
}
