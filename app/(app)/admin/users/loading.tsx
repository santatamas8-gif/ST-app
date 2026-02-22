export default function AdminUsersLoading() {
  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "#0b0f14" }}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-9 w-64 animate-pulse rounded bg-zinc-800" />
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    </div>
  );
}
