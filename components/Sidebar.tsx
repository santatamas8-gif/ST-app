"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Calendar, Palette } from "lucide-react";
import type { UserRole } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, type ThemeId } from "@/lib/themes";

/** Chat, Schedule, Theme are only in the header as logos – exclude from sidebar list */
const HEADER_ONLY_HREFS = ["/chat", "/schedule"];

const THEME_SWATCH: Record<ThemeId, string> = {
  black: "#0b0f14",
  green: "#0d1f1a",
  navy: "#0f172a",
  brown: "#1c1917",
  purple: "#1e1b2e",
};

const navItems: { href: string; label: string; roles?: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/players", label: "Players", roles: ["admin", "staff"] },
  { href: "/wellness", label: "Wellness" },
  { href: "/rpe", label: "RPE" },
  { href: "/chat", label: "Chat" },
  { href: "/admin/users", label: "Users", roles: ["admin"] },
];

interface SidebarProps {
  role: UserRole;
  userEmail: string;
  /** Player only: today's check-in status. Show dot when not done. */
  todoToday?: { wellnessDone: boolean; rpeDone: boolean } | null;
  /** Number of unread chat messages (red badge on Chat link). */
  unreadChatCount?: number;
  /** True for admin or primary admin when staff (so they can open Users and reclaim admin). */
  canAccessUsers?: boolean;
}

export function Sidebar({ role, userEmail, todoToday, unreadChatCount = 0, canAccessUsers = false }: SidebarProps) {
  const pathname = usePathname();
  const { themeId, setThemeId } = useTheme();
  const [themePopoverOpen, setThemePopoverOpen] = useState(false);
  const themePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!themePopoverOpen) return;
    const close = (e: MouseEvent) => {
      if (themePopoverRef.current && !themePopoverRef.current.contains(e.target as Node)) {
        setThemePopoverOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [themePopoverOpen]);

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
    (item) => !item.roles || item.roles.includes(role) || (item.href === "/admin/users" && canAccessUsers)
  );
  const sidebarNavItems = visibleItems.filter(
    (item) => !HEADER_ONLY_HREFS.includes(item.href)
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
      {item.href === "/chat" && unreadChatCount > 0 && (
        <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white" title="Unread messages" aria-label={`${unreadChatCount} unread`}>
          {unreadChatCount > 99 ? "99+" : unreadChatCount}
        </span>
      )}
    </>
  );

  return (
    <aside className="flex w-full flex-col border-b border-zinc-800 md:h-full md:w-64 md:border-b-0 md:border-r" style={{ backgroundColor: "var(--card-bg)" }}>
      <div className="flex h-14 items-center justify-between gap-2 border-b border-zinc-800 px-4 md:h-16 md:px-5">
        <Link href="/dashboard" className="shrink-0 text-lg font-bold tracking-tight text-white transition-opacity duration-200 hover:opacity-90 md:text-xl">
          ST AMS
        </Link>
        <div className="flex items-center gap-1.5 md:gap-2 md:ml-auto">
          <Link
            href="/chat"
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${
              pathname === "/chat" || pathname.startsWith("/chat/")
                ? "bg-emerald-600/25 text-emerald-400"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Chat"
            aria-label="Chat"
          >
            <MessageCircle className="h-5 w-5" />
            {unreadChatCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {unreadChatCount > 99 ? "99+" : unreadChatCount}
              </span>
            )}
          </Link>
          <Link
            href="/schedule"
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
              pathname === "/schedule"
                ? "bg-emerald-600/25 text-emerald-400"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Schedule"
            aria-label="Schedule"
          >
            <Calendar className="h-5 w-5" />
          </Link>
          <div className="relative" ref={themePopoverRef}>
            <button
              type="button"
              onClick={() => setThemePopoverOpen((o) => !o)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition text-zinc-400 hover:bg-zinc-800 hover:text-white`}
              title="Theme"
              aria-label="Theme"
              aria-expanded={themePopoverOpen}
            >
              <Palette className="h-5 w-5" />
            </button>
            {themePopoverOpen && (
              <div
                className="absolute left-0 top-full z-50 mt-1 flex flex-wrap gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl"
                style={{ borderRadius: "10px" }}
              >
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setThemeId(t.id);
                      setThemePopoverOpen(false);
                    }}
                    title={t.name}
                    className={`h-8 w-8 rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      themeId === t.id ? "border-emerald-400 ring-2 ring-emerald-400/30" : "border-zinc-600 hover:border-zinc-500"
                    }`}
                    style={{ backgroundColor: THEME_SWATCH[t.id] }}
                    aria-label={t.name}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <nav className="flex gap-1 md:hidden shrink-0">
          {sidebarNavItems.map((item) => {
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
        {sidebarNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
                className={`flex min-h-[44px] items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive ? activeNavClass : inactiveNavClass
                }`}
            >
              {linkContent(item)}
            </Link>
          );
        })}
      </nav>
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
