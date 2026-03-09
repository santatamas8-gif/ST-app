export default function ChatLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-700/60" />
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-700/50" />
          <div className="h-3 w-48 animate-pulse rounded bg-zinc-700/40" />
        </div>
      </div>
    </div>
  );
}
