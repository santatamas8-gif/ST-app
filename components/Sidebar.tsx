"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";

const navItems: { href: string; label: string; roles?: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/players", label: "Players", roles: ["admin", "staff"] },
  { href: "/wellness", label: "Wellness" },
  { href: "/rpe", label: "RPE" },
  { href: "/admin/users", label: "Users", roles: ["admin"] },
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
    <aside className="flex w-full flex-col border-b border-zinc-800 bg-zinc-900/80 md:h-full md:w-64 md:border-b-0 md:border-r">
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4 md:h-16 md:justify-start md:px-5">
        <Link href="/dashboard" className="text-lg font-bold text-white md:text-xl">
          ST App
        </Link>
        <nav className="flex gap-1 md:hidden">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                  isActive ? "bg-emerald-600/20 text-emerald-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <nav className="hidden flex-1 space-y-0.5 p-3 md:block">
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
      <div className="hidden border-t border-zinc-800 p-3 md:block">
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
      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2 md:hidden">
        <div className="min-w-0">
          <p className="truncate text-xs text-zinc-500" title={userEmail}>{userEmail}</p>
          <p className="text-xs font-medium capitalize text-zinc-400">{role}</p>
        </div>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
