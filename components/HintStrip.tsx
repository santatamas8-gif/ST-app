import type { ReactNode } from "react";

interface HintStripProps {
  icon: ReactNode;
  children: ReactNode;
}

/** Single-row hint: icon + text. Visually subtle so the main content stays in focus. */
export function HintStrip({ icon, children }: HintStripProps) {
  return (
    <div
      className="flex flex-nowrap items-center gap-1 rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-4 py-3"
      role="status"
    >
      <span className="shrink-0 text-emerald-400/90" aria-hidden>
        {icon}
      </span>
      <p className="min-w-0 text-sm font-medium text-zinc-400">{children}</p>
    </div>
  );
}
