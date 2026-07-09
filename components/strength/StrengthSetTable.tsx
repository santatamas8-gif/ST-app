import { formatSetPercentage } from "@/lib/strength/cardLayout";

type SetRow = {
  id?: string;
  set_number: number;
  percentage: number;
  display_percentage?: string;
  reps: number;
  display_weight: string;
};

interface StrengthSetTableProps {
  sets: SetRow[];
  variant?: "screen" | "print";
  /** Hide % column — pull-up exercises use fixed set % (reps-only editing). */
  repsOnlyPullUp?: boolean;
}

export function StrengthSetTable({
  sets,
  variant = "screen",
  repsOnlyPullUp = false,
}: StrengthSetTableProps) {
  if (variant === "print") {
    return (
      <table
        className={`strength-set-table-print${repsOnlyPullUp ? " strength-set-table-print--reps-only" : ""}`}
      >
        <thead>
          <tr>
            {!repsOnlyPullUp && <th className="print-col-pct">%</th>}
            <th className="print-col-weight">Weight</th>
            <th className="print-col-reps">Reps</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.id ?? s.set_number}>
              {!repsOnlyPullUp && (
                <td className="print-col-pct">
                  {s.display_percentage ?? formatSetPercentage(s.percentage)}
                </td>
              )}
              <td className="print-col-weight">
                {repsOnlyPullUp ? "" : (s.display_weight || "—")}
              </td>
              <td className="print-col-reps">{s.reps}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full min-w-[200px] text-sm">
      <thead>
        <tr className="border-b border-zinc-700/50 text-left text-xs uppercase tracking-wide text-zinc-500">
          {!repsOnlyPullUp && <th className="pb-2 pr-4 font-medium">%</th>}
          <th className="pb-2 pr-4 font-medium">Weight</th>
          <th className="pb-2 font-medium">Reps</th>
        </tr>
      </thead>
      <tbody>
        {sets.map((s) => (
          <tr key={s.id ?? s.set_number} className="border-b border-zinc-800/60 last:border-0">
            {!repsOnlyPullUp && (
              <td className="py-2 pr-4 tabular-nums whitespace-nowrap text-zinc-300">
                {s.display_percentage ?? formatSetPercentage(s.percentage)}
              </td>
            )}
            <td className="py-2 pr-4 font-medium tabular-nums whitespace-nowrap text-white">
              {repsOnlyPullUp ? "" : s.display_weight}
            </td>
            <td className="py-2 tabular-nums text-zinc-300">{s.reps}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
