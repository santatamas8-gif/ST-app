export default function ChatRoomLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="flex shrink-0 items-center gap-3 border-b border-zinc-700/80 px-4 py-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-700/60" />
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-700/50" />
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex justify-start">
            <div className="h-10 max-w-[75%] animate-pulse rounded-2xl rounded-bl-sm bg-zinc-700/50" style={{ width: `${40 + (i % 3) * 20}%` }} />
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-zinc-700/80 px-4 py-3">
        <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-700/50" />
      </div>
    </div>
  );
}
