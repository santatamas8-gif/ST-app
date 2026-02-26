"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { ThemeSelector } from "@/components/ThemeSelector";
import { useTheme } from "@/components/ThemeProvider";

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
  /** Player only: today's check-in status. Show dot when not done. */
  todoToday?: { wellnessDone: boolean; rpeDone: boolean } | null;
}

export function Sidebar({ role, userEmail, todoToday }: SidebarProps) {
  const pathname = usePathname();
  const { themeId } = useTheme();
  const activeNavClass =
    themeId === "black"
      ? "bg-emerald-600/20 text-emerald-400"
      : "bg-emerald-500/25 text-emerald-300";
  const inactiveNavClass =
    themeId === "black"
      ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
      : "text-zinc-300 hover:bg-white/10 hover:text-white";
  const sidebarMutedClass = themeId === "black" ? "text-zinc-500" : "text-zinc-400";
  const sidebarLabelClass = themeId === "black" ? "text-zinc-400" : "text-zinc-300";

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  const needsTodo = (href: string) => {
    if (!todoToday) return false;
    if (href === "/wellness") return !todoToday.wellnessDone;
    if (href === "/rpe") return !todoToday.rpeDone;
    return false;
  };

  const linkContent = (item: (typeof navItems)[0]) => (
    <>
      {item.label}
      {needsTodo(item.href) && (
        <span className="ml-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400" title="To do today" aria-hidden />
      )}
    </>
  );

  return (
    <aside className="flex w-full flex-col border-b border-zinc-800 md:h-full md:w-64 md:border-b-0 md:border-r" style={{ backgroundColor: "var(--card-bg)" }}>
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4 md:h-16 md:justify-start md:px-5">
        <Link href="/dashboard" className="text-lg font-bold text-white md:text-xl">
          ST AMS
        </Link>
        <nav className="flex gap-1 md:hidden">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[44px] items-center rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                  isActive ? activeNavClass : inactiveNavClass
                }`}
              >
                {linkContent(item)}
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
              className={`flex min-h-[44px] items-center rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive ? activeNavClass : inactiveNavClass
              }`}
            >
              {linkContent(item)}
            </Link>
          );
        })}
      </nav>
      <div className="hidden md:block">
        <ThemeSelector />
      </div>
      <div className="hidden border-t border-zinc-800 p-3 md:block">
        <p className={`truncate px-3 py-2 text-xs ${sidebarMutedClass}`} title={userEmail}>
          {userEmail}
        </p>
        <p className={`px-3 text-xs font-medium capitalize ${sidebarLabelClass}`}>
          {role}
        </p>
        <form action="/api/auth/signout" method="post" className="mt-2">
          <button
            type="submit"
            className={`min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-sm ${sidebarMutedClass} hover:bg-zinc-800 hover:text-white`}
          >
            Sign out
          </button>
        </form>
      </div>
      <div className="flex flex-col gap-2 border-t border-zinc-800 px-4 py-2 md:hidden">
        <ThemeSelector />
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className={`truncate text-xs ${sidebarMutedClass}`} title={userEmail}>{userEmail}</p>
            <p className={`text-xs font-medium capitalize ${sidebarLabelClass}`}>{role}</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className={`min-h-[44px] min-w-[44px] rounded-lg px-3 py-2 text-sm ${sidebarMutedClass} hover:bg-zinc-800 hover:text-white`}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
