"use client";

/** Interpolate thumb: red (1) → orange (mid) → green (10) */
function thumbColorFor(value: number, min: number, max: number): string {
  const t = max === min ? 0 : (value - min) / (max - min);
  const red = { r: 220, g: 38, b: 38 };
  const orange = { r: 234, g: 88, b: 12 };
  const green = { r: 22, g: 163, b: 74 };
  let r: number;
  let g: number;
  let b: number;
  if (t <= 0.5) {
    const u = t * 2;
    r = Math.round(red.r + (orange.r - red.r) * u);
    g = Math.round(red.g + (orange.g - red.g) * u);
    b = Math.round(red.b + (orange.b - red.b) * u);
  } else {
    const u = (t - 0.5) * 2;
    r = Math.round(orange.r + (green.r - orange.r) * u);
    g = Math.round(orange.g + (green.g - orange.g) * u);
    b = Math.round(orange.b + (green.b - orange.b) * u);
  }
  return `rgb(${r},${g},${b})`;
}

interface ScaleInputProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /** When true, low value = green (good), high = red (e.g. soreness, fatigue, stress) */
  inverted?: boolean;
  /** Optional scale hint shown under the label (used when no lowLabel/highLabel) */
  labelHint?: string;
  /** Optional explanation under the slider */
  legend?: string;
  /** Label at low end of scale (e.g. "Very poor") – shown at 1 */
  lowLabel?: string;
  /** Label at high end of scale (e.g. "Excellent") – shown at 10 */
  highLabel?: string;
  id?: string;
}

export function ScaleInput({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  inverted = false,
  labelHint,
  legend,
  lowLabel,
  highLabel,
  id,
}: ScaleInputProps) {
  const name = id ?? label.replace(/\s+/g, "-").toLowerCase();
  const showEndLabels = lowLabel != null || highLabel != null;
  const colorValue = inverted ? min + max - value : value;
  const thumbColor = thumbColorFor(colorValue, min, max);
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="min-w-0 overflow-visible">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={name} className="block min-w-0 flex-1">
          <span className="block text-sm font-semibold text-zinc-200">
            {label.includes(" (") ? (() => {
              const parenStart = label.indexOf(" (");
              const parenContent = label.slice(parenStart + 2).replace(/\)\s*$/, "");
              if (parenContent === "fatigue" || parenContent === "soreness") return label;
              return (
                <>
                  {label.slice(0, parenStart)}
                  <span className="text-xs font-normal opacity-90">{label.slice(parenStart)}</span>
                </>
              );
            })() : (
              label
            )}
          </span>
          {labelHint != null && !showEndLabels && (
            <span className="mt-0.5 block text-xs text-zinc-500" aria-hidden>
              {labelHint}
            </span>
          )}
        </label>
        {!showEndLabels && (
          <span className="shrink-0 rounded-md bg-zinc-700/90 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-white">{value}</span>
        )}
      </div>
      {showEndLabels ? (
        <div id={`${name}-ends`} className="mt-0.5 flex min-w-0 flex-col overflow-visible md:mt-1.5 md:flex-row md:items-center md:gap-3" aria-hidden>
          {/* Desktop: left label */}
          <span className="hidden shrink-0 truncate text-xs text-zinc-500 md:block md:w-[8rem]" title={lowLabel ?? undefined}>
            {lowLabel ?? ""}
          </span>
          {/* Slider + value bubble (full width on mobile, flex-1 on desktop); py-3 on mobile = larger touch target */}
          <div className="flex min-w-0 flex-1 flex-col overflow-visible w-full py-3 md:min-w-0 md:py-0">
            <div className="relative h-7 w-full overflow-visible">
              <span
                className="absolute top-0 whitespace-nowrap rounded-md bg-zinc-800/95 px-2 py-0.5 text-sm font-semibold tabular-nums shadow-sm"
                style={{
                  left: `${percent}%`,
                  transform: "translateX(-50%)",
                  color: thumbColor,
                }}
                aria-live="polite"
              >
                {value}
              </span>
            </div>
            <input
              id={name}
              type="range"
              min={min}
              max={max}
              value={value}
              onChange={(e) => onChange(Number(e.target.value))}
              className="scale-input-track mt-0.5 h-2 w-full min-w-0 appearance-none rounded-full bg-transparent accent-emerald-500 [--track-h:10px] md:[--track-h:8px]"
              style={{ ["--thumb-color" as string]: thumbColor }}
            />
          </div>
          {/* Desktop: right label */}
          <span className="hidden shrink-0 truncate text-right text-xs text-zinc-500 md:block md:w-[8rem]" title={highLabel ?? undefined}>
            {highLabel ?? ""}
          </span>
          {/* Mobile only: labels row – much closer to slider */}
          <div className="flex justify-between gap-2 -mt-2.5 text-[10px] leading-tight text-zinc-400 md:hidden">
            <span className="truncate max-w-[45%]" title={lowLabel ?? undefined}>{lowLabel ?? ""}</span>
            <span className="truncate max-w-[45%] text-right" title={highLabel ?? undefined}>{highLabel ?? ""}</span>
          </div>
        </div>
      ) : (
        <input
          id={name}
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="scale-input-track mt-1.5 h-2 w-full appearance-none rounded-full bg-transparent accent-emerald-500 [--track-h:10px] md:[--track-h:8px]"
          style={{ ["--thumb-color" as string]: thumbColor }}
        />
      )}
      {legend != null && !showEndLabels && (
        <p className="mt-1 text-xs text-zinc-500" aria-hidden>
          {legend}
        </p>
      )}
    </div>
  );
}
