"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

const navItems: { href: string; label: string; roles?: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/wellness", label: "Wellness" },
  { href: "/rpe", label: "RPE" },
  { href: "/users", label: "Users", roles: ["admin"] },
];

interface SidebarProps {
  role: UserRole;
  userEmail: string;
}

export function Sidebar({ role, userEmail }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  return (
    <aside className="flex w-64 flex-col border-r border-zinc-800 bg-zinc-900/80">
      <div className="flex h-16 items-center border-b border-zinc-800 px-5">
        <Link href="/dashboard" className="text-xl font-bold text-white">
          ST App
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-emerald-600/20 text-emerald-400"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 p-3">
        <p className="truncate px-3 py-2 text-xs text-zinc-500" title={userEmail}>
          {userEmail}
        </p>
        <p className="px-3 text-xs font-medium capitalize text-zinc-400">
          {role}
        </p>
        <form action="/api/auth/signout" method="post" className="mt-2">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
