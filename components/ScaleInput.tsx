"use client";

interface ScaleInputProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  inverted?: boolean;
  id?: string;
}

export function ScaleInput({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  inverted = false,
  id,
}: ScaleInputProps) {
  const name = id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div>
      <div className="flex items-center justify-between">
        <label
          htmlFor={name}
          className="block text-sm font-medium text-zinc-300"
        >
          {label}
          {inverted && (
            <span className="ml-1.5 text-zinc-500">(higher = worse)</span>
          )}
        </label>
        <span className="text-sm tabular-nums text-zinc-400">{value}</span>
      </div>
      <input
        id={name}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-2 w-full appearance-none rounded-full bg-zinc-700 accent-emerald-500"
      />
    </div>
  );
}
