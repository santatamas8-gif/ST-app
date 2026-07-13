"use client";

import { useRouter } from "next/navigation";

export function PlayersCardRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className="cursor-pointer rounded-xl border border-zinc-700/80 bg-zinc-800/50 px-4 py-3 transition-colors hover:bg-zinc-800/70 focus-visible:bg-zinc-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-inset grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-sm text-zinc-300"
    >
      {children}
    </div>
  );
}
