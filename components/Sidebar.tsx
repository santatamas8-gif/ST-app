"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Calendar, Palette, Home, Users, HeartPulse, Activity, UserCog, LogOut } from "lucide-react";
import type { UserRole } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, type ThemeId } from "@/lib/themes";

/** Chat, Schedule, Theme are only in the header as logos – exclude from sidebar list */
const HEADER_ONLY_HREFS = ["/chat", "/schedule"];

const THEME_SWATCH: Record<ThemeId, string> = {
  dark: "#0f1216",
  light: "#f4f4f5",
  red: "#1f1315",
  blue: "#0f172a",
  green: "#0f2621",
  neon: "#022c22",
  matt: "#0a0a0c",
};

const navItems: { href: string; label: string; icon: typeof Home; roles?: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/players", label: "Players", icon: Users, roles: ["admin", "staff"] },
  { href: "/wellness", label: "Wellness", icon: HeartPulse },
  { href: "/rpe", label: "RPE", icon: Activity },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/admin/users", label: "Users", icon: UserCog, roles: ["admin"] },
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

  const isLight = themeId === "light";
  const isNeon = themeId === "neon";
  const isMatt = themeId === "matt";
  const activeNavClass =
    isNeon
      ? "bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-400 pl-2.5 shadow-[0_0_8px_rgba(0,0,0,0.2),0_0_3px_rgba(16,185,129,0.015)]"
      : isMatt
        ? "bg-white/15 text-white border-l-2 border-white/70 pl-2.5 shadow-[0_0_20px_rgba(0,0,0,0.4)]"
        : isLight
          ? "bg-emerald-600/25 text-emerald-700"
          : "bg-emerald-600/20 text-emerald-400";
  const inactiveNavClass =
    isNeon
      ? "text-white/80 hover:bg-emerald-500/10 hover:text-emerald-200"
      : isMatt
        ? "text-white/85 hover:bg-white/8 hover:text-white"
        : isLight
          ? "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-white";
  const sidebarMutedClass = isNeon || isMatt ? "text-white/60" : isLight ? "text-zinc-500" : "text-zinc-500";
  const sidebarLabelClass = isNeon || isMatt ? "text-white/80" : isLight ? "text-zinc-600" : "text-zinc-400";
  const sidebarBorderClass = isNeon ? "border-emerald-500/10" : isMatt ? "border-white/28" : "border-zinc-800";
  const sidebarBgStyle =
    isNeon
      ? {
          backgroundColor: "#080c0a",
          boxShadow:
            "4px 0 24px rgba(0,0,0,0.4), 4px 0 28px rgba(6,95,70,0.02), inset -1px 0 0 rgba(16,185,129,0.02)",
        }
      : isMatt
        ? {
            backgroundColor: "#141418",
            boxShadow:
              "4px 0 32px rgba(0,0,0,0.45), 4px 0 48px rgba(255,255,255,0.1), inset -1px 0 0 rgba(255,255,255,0.22)",
          }
        : undefined;
  const headerIconClass = (active: boolean) =>
    isNeon
      ? active
        ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.025)]"
        : "text-white/80 hover:bg-emerald-500/10 hover:text-emerald-300"
      : isMatt
        ? active
          ? "bg-white/20 text-white shadow-[0_0_12px_rgba(0,0,0,0.3)]"
          : "text-white/85 hover:bg-white/8 hover:text-white"
        : active
          ? isLight ? "bg-emerald-600/25 text-emerald-600" : "bg-emerald-600/25 text-emerald-400"
          : isLight ? "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900" : "text-zinc-400 hover:bg-zinc-800 hover:text-white";
  const signOutHoverClass =
    isNeon ? "hover:bg-emerald-500/10 hover:text-white" : isMatt ? "hover:bg-white/8 hover:text-white" : "hover:bg-zinc-800 hover:text-white";

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
      <item.icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0">{item.label}</span>
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
    <aside
      className={`flex w-full flex-col border-b md:h-full md:w-64 md:border-b-0 md:border-r ${sidebarBorderClass}`}
      style={sidebarBgStyle ?? { backgroundColor: "var(--card-bg)" }}
    >
      <div className={`flex h-14 items-center justify-between gap-2 border-b px-4 md:h-16 md:px-5 ${sidebarBorderClass}`}>
        <Link href="/dashboard" className={`shrink-0 text-lg font-bold tracking-tight transition-opacity duration-200 hover:opacity-90 md:text-xl ${isNeon ? "text-emerald-400/90" : "text-white"}`}>
          ST AMS
        </Link>
        <div className="flex items-center gap-1.5 md:gap-2 md:ml-auto">
          <Link
            href="/chat"
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${
              headerIconClass(pathname === "/chat" || pathname.startsWith("/chat/"))
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
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${headerIconClass(pathname === "/schedule")}`}
            title="Schedule"
            aria-label="Schedule"
          >
            <Calendar className="h-5 w-5" />
          </Link>
          <div className="relative" ref={themePopoverRef}>
            <button
              type="button"
              onClick={() => setThemePopoverOpen((o) => !o)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${headerIconClass(false)}`}
              title="Theme"
              aria-label="Theme"
              aria-expanded={themePopoverOpen}
            >
              <Palette className="h-5 w-5" />
            </button>
            {themePopoverOpen && (
              <div
                className={`absolute left-0 top-full z-50 mt-1 flex flex-wrap gap-2 rounded-lg border p-2 shadow-xl ${isLight ? "border-zinc-300 bg-white" : "border-zinc-700 bg-zinc-900"}`}
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
                      themeId === t.id ? "border-emerald-500 ring-2 ring-emerald-500/30" : isLight ? "border-zinc-300 hover:border-zinc-400" : "border-zinc-600 hover:border-zinc-500"
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
                className={`flex min-h-[44px] items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition ${
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
                className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive ? activeNavClass : inactiveNavClass
                }`}
            >
              {linkContent(item)}
            </Link>
          );
        })}
      </nav>
      <div className={`hidden border-t p-3 md:block ${sidebarBorderClass}`}>
        <p className={`truncate px-3 py-2 text-xs ${sidebarMutedClass}`} title={userEmail}>
          {userEmail}
        </p>
        <p className={`px-3 text-xs font-medium capitalize ${sidebarLabelClass}`}>
          {role}
        </p>
        <form action="/api/auth/signout" method="post" className="mt-2">
          <button
            type="submit"
            className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${sidebarMutedClass} ${signOutHoverClass}`}
          >
            <LogOut className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
      <div className={`flex flex-col gap-2 border-t px-4 py-2 md:hidden ${sidebarBorderClass}`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className={`truncate text-xs ${sidebarMutedClass}`} title={userEmail}>{userEmail}</p>
            <p className={`text-xs font-medium capitalize ${sidebarLabelClass}`}>{role}</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm ${sidebarMutedClass} ${signOutHoverClass}`}
            >
              <LogOut className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
