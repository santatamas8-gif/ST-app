import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-lg ${className}`}
    >
      {title && (
        <div className="border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
