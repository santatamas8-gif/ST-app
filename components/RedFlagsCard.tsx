interface RedFlagItem {
  type: string;
  label: string;
  value?: string | number;
}

interface RedFlagsCardProps {
  flags: RedFlagItem[];
}

export function RedFlagsCard({ flags }: RedFlagsCardProps) {
  if (flags.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 shadow-lg">
        <p className="text-sm font-medium text-zinc-400">Red flags</p>
        <p className="mt-2 text-sm text-emerald-400/90">No red flags detected.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-500/50 bg-red-500/5 p-4 shadow-lg">
      <p className="text-sm font-medium text-red-400">Red flags</p>
      <ul className="mt-2 space-y-1.5">
        {flags.map((f, i) => (
          <li
            key={`${f.type}-${i}`}
            className="flex items-center gap-2 text-sm text-red-300"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
            {f.label}
            {f.value != null && (
              <span className="tabular-nums text-red-400">({f.value})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
