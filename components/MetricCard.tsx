import type { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number | null;
  suffix?: string;
  subtitle?: string;
  variant?: "default" | "danger" | "success";
  children?: ReactNode;
}

export function MetricCard({
  title,
  value,
  suffix,
  subtitle,
  variant = "default",
  children,
}: MetricCardProps) {
  const borderClass =
    variant === "danger"
      ? "border-red-500/50 bg-red-500/5"
      : variant === "success"
        ? "border-emerald-500/30 bg-emerald-500/5"
        : "border-zinc-800";

  const displayValue = value ?? "—";
  const displaySuffix = suffix ?? "";

  return (
    <div
      className={`rounded-xl border ${borderClass} bg-zinc-900/50 p-4 shadow-lg`}
    >
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white">
        {displayValue}{displaySuffix}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      )}
      {children}
    </div>
  );
}
