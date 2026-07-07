import { formatSetPercentage } from "@/lib/strength/cardLayout";

type SetRow = {
  id?: string;
  set_number: number;
  percentage: number;
  reps: number;
  display_weight: string;
};

interface StrengthSetTableProps {
  sets: SetRow[];
  variant?: "screen" | "print";
}

export function StrengthSetTable({ sets, variant = "screen" }: StrengthSetTableProps) {
  if (variant === "print") {
    return (
      <table className="strength-set-table-print">
        <thead>
          <tr>
            <th>%</th>
            <th>Weight</th>
            <th>Reps</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((s) => (
            <tr key={s.id ?? s.set_number}>
              <td>{formatSetPercentage(s.percentage)}</td>
              <td>{s.display_weight}</td>
              <td>{s.reps}</td>
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
          <th className="pb-2 pr-4 font-medium">%</th>
          <th className="pb-2 pr-4 font-medium">Weight</th>
          <th className="pb-2 font-medium">Reps</th>
        </tr>
      </thead>
      <tbody>
        {sets.map((s) => (
          <tr key={s.id ?? s.set_number} className="border-b border-zinc-800/60 last:border-0">
            <td className="py-2 pr-4 tabular-nums text-zinc-300">
              {formatSetPercentage(s.percentage)}
            </td>
            <td className="py-2 pr-4 font-medium tabular-nums text-white">{s.display_weight}</td>
            <td className="py-2 tabular-nums text-zinc-300">{s.reps}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
