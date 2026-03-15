"use client";

import { useRouter } from "next/navigation";

export function PlayersTableRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className="cursor-pointer border-b border-zinc-800 transition-colors hover:bg-zinc-800/60 focus-visible:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-inset"
    >
      {children}
    </tr>
  );
}
