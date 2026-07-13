export default function RpeLoading() {
  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="h-9 w-48 animate-pulse rounded bg-zinc-800" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-zinc-800" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    </div>
  );
}
