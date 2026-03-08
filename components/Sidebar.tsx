"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Calendar, Palette, Home, Users, HeartPulse, Activity, UserCog, LogOut, Menu, X, ArrowLeft } from "lucide-react";
import type { UserRole } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, type ThemeId } from "@/lib/themes";

/** On desktop: only Wellness, RPE, Chat in top bar; Schedule is in 3-dot flyout */
const TOP_BAR_HREFS = ["/wellness", "/rpe", "/chat"];
/** Chat, Schedule are header-only in original sidebar list (mobile) */
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
  /** Main content (layout passes children here for desktop dashboard panel + main). */
  children?: React.ReactNode;
}

export function Sidebar({ role, userEmail, todoToday, unreadChatCount = 0, canAccessUsers = false, children }: SidebarProps) {
  const pathname = usePathname();
  const { themeId, setThemeId } = useTheme();
  const [themePopoverOpen, setThemePopoverOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const flyoutCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themePopoverRef = useRef<HTMLDivElement>(null);
  const stripAndFlyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

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
  /** Desktop flyout: Dashboard, Schedule, Players, Users (Wellness, RPE, Chat are in top bar) */
  const flyoutNavItems = visibleItems.filter(
    (item) => !TOP_BAR_HREFS.includes(item.href)
  );

  const clearFlyoutCloseTimer = () => {
    if (flyoutCloseTimerRef.current) {
      clearTimeout(flyoutCloseTimerRef.current);
      flyoutCloseTimerRef.current = null;
    }
  };
  const scheduleFlyoutClose = () => {
    clearFlyoutCloseTimer();
    flyoutCloseTimerRef.current = setTimeout(() => setFlyoutOpen(false), 120);
  };
  const handleStripFlyoutMouseEnter = () => {
    clearFlyoutCloseTimer();
    setFlyoutOpen(true);
  };
  const handleStripFlyoutMouseLeave = () => {
    if (pathname !== "/dashboard") scheduleFlyoutClose();
  };

  /** On dashboard keep flyout open; on other pages close it (more space). Hover still opens on any page. */
  useEffect(() => {
    if (pathname === "/dashboard") setFlyoutOpen(true);
    else setFlyoutOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  const mobileDrawer = (
    <>
      <div
        className="no-print fixed inset-0 z-40 bg-black/60 md:hidden"
        aria-hidden
        onClick={() => setMobileMenuOpen(false)}
      />
      <div
        className="no-print fixed inset-y-0 left-0 z-50 flex w-full max-w-[280px] flex-col md:hidden"
        style={sidebarBgStyle ?? { backgroundColor: "var(--card-bg)" }}
        role="dialog"
        aria-label="Navigation menu"
      >
        <div className={`flex h-14 items-center justify-between border-b px-4 ${sidebarBorderClass}`}>
          <span className={`text-lg font-bold tracking-tight ${isNeon ? "text-emerald-400/90" : isLight ? "text-zinc-900" : "text-white"}`}>Menu</span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${headerIconClass(false)}`}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-auto p-3">
          {sidebarNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-[48px] items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition ${
                  isActive ? activeNavClass : inactiveNavClass
                }`}
              >
                {linkContent(item)}
              </Link>
            );
          })}
        </nav>
        <div className={`border-t p-3 ${sidebarBorderClass}`}>
          <p className={`truncate px-3 py-2 text-xs ${sidebarMutedClass}`} title={userEmail}>{userEmail}</p>
          <p className={`px-3 text-xs font-medium capitalize ${sidebarLabelClass}`}>{role}</p>
          <form action="/api/auth/signout" method="post" className="mt-2">
            <button
              type="submit"
              className={`flex min-h-[48px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${sidebarMutedClass} ${signOutHoverClass}`}
            >
              <LogOut className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );

  const isDashboardDesktop = pathname === "/dashboard";
  const menuPanelContent = (
    <>
      <nav className="flex-1 space-y-0.5 overflow-auto p-3 min-h-0">
        {flyoutNavItems.map((item) => {
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
      <div className={`shrink-0 border-t p-3 ${sidebarBorderClass}`}>
        <button
          type="button"
          onClick={() => setThemePanelOpen((o) => !o)}
          className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium transition md:min-h-[44px] ${sidebarMutedClass} ${isNeon || isMatt ? "hover:bg-white/8 hover:text-white" : "hover:bg-zinc-800 hover:text-white"}`}
          aria-expanded={themePanelOpen}
          aria-label={themePanelOpen ? "Close theme options" : "Open theme options"}
        >
          <Palette className="h-5 w-5 shrink-0" />
          <span>Theme</span>
        </button>
        {themePanelOpen && (
          <div className="mb-2 flex flex-wrap gap-2 pl-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setThemeId(t.id)}
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
        <p className={`mt-3 truncate px-3 py-2 text-xs ${sidebarMutedClass}`} title={userEmail}>
          {userEmail}
        </p>
        <p className={`px-3 text-xs font-medium capitalize ${sidebarLabelClass}`}>{role}</p>
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
    </>
  );

  const flyoutContent = (
    <div
      className={`flex w-60 flex-col overflow-hidden rounded-b-lg border border-t-0 shadow-xl ${sidebarBorderClass}`}
      style={{
        ...(sidebarBgStyle ?? { backgroundColor: "var(--card-bg)" }),
        maxHeight: "min(80vh, 480px)",
      }}
      onMouseEnter={handleStripFlyoutMouseEnter}
      onMouseLeave={handleStripFlyoutMouseLeave}
    >
      {menuPanelContent}
    </div>
  );

  return (
    <>
    <aside
      className={`no-print flex w-full shrink-0 flex-col border-b md:h-auto md:w-full md:border-r-0 ${sidebarBorderClass}`}
      style={sidebarBgStyle ?? { backgroundColor: "var(--card-bg)" }}
    >
      {/* Mobile: full header row with hamburger, ST AMS, Chat, Schedule, Theme */}
      <div className={`flex h-14 min-h-[44px] items-center justify-between gap-2 border-b px-3 py-2 md:hidden md:px-5 ${sidebarBorderClass}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-initial">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition ${headerIconClass(false)}`}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className={`shrink-0 text-lg font-bold tracking-tight transition-opacity duration-200 hover:opacity-90 md:text-xl ${isNeon ? "text-emerald-400/90" : "text-white"}`}>
            ST AMS
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <Link href="/chat" className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition ${headerIconClass(pathname === "/chat" || pathname.startsWith("/chat/"))}`} title="Chat" aria-label="Chat">
            <MessageCircle className="h-5 w-5" />
            {unreadChatCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {unreadChatCount > 99 ? "99+" : unreadChatCount}
              </span>
            )}
          </Link>
          <Link href="/schedule" className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${headerIconClass(pathname === "/schedule")}`} title="Schedule" aria-label="Schedule">
            <Calendar className="h-5 w-5" />
          </Link>
          <div className="relative" ref={themePopoverRef}>
            <button type="button" onClick={() => setThemePopoverOpen((o) => !o)} className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${headerIconClass(false)}`} title="Theme" aria-label="Theme" aria-expanded={themePopoverOpen}>
              <Palette className="h-5 w-5" />
            </button>
            {themePopoverOpen && (
              <div className={`absolute right-0 top-full z-50 mt-1 flex flex-wrap gap-2 rounded-lg border p-2 shadow-xl ${isLight ? "border-zinc-300 bg-white" : "border-zinc-700 bg-zinc-900"}`} style={{ borderRadius: "10px" }}>
                {THEMES.map((t) => (
                  <button key={t.id} type="button" onClick={() => { setThemeId(t.id); setThemePopoverOpen(false); }} title={t.name} className={`h-8 w-8 rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${themeId === t.id ? "border-emerald-500 ring-2 ring-emerald-500/30" : isLight ? "border-zinc-300 hover:border-zinc-400" : "border-zinc-600 hover:border-zinc-500"}`} style={{ backgroundColor: THEME_SWATCH[t.id] }} aria-label={t.name} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop (md+): hamburger | back (when not dashboard) | ST AMS | 3 icons; flyout below hamburger */}
      <div className={`hidden md:flex md:h-16 md:w-full md:flex-row md:items-center md:gap-2 md:border-b md:px-2 md:py-2 md:pr-4 ${sidebarBorderClass}`}>
        <div
          ref={stripAndFlyoutRef}
          className="relative flex shrink-0 items-center"
          onMouseEnter={handleStripFlyoutMouseEnter}
          onMouseLeave={handleStripFlyoutMouseLeave}
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${headerIconClass(false)}`} aria-hidden>
            <Menu className="h-6 w-6" />
          </span>
          {!isDashboardDesktop && flyoutOpen && (
            <div className="absolute left-0 top-full z-50 mt-0.5">
              {flyoutContent}
            </div>
          )}
        </div>
        {!isDashboardDesktop && (
          <Link
            href="/dashboard"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition ${headerIconClass(false)}`}
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <Link href="/dashboard" className={`shrink-0 text-lg font-bold tracking-tight transition-opacity hover:opacity-90 md:text-xl ${isNeon ? "text-emerald-400/90" : "text-white"}`}>
          ST AMS
        </Link>
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <Link href="/wellness" className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition md:h-10 md:w-10 ${headerIconClass(pathname === "/wellness" || pathname.startsWith("/wellness/"))}`} title="Wellness" aria-label="Wellness">
            <HeartPulse className="h-5 w-5" />
            {todoToday && !todoToday.wellnessDone && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" title="To do today" aria-hidden />}
          </Link>
          <Link href="/rpe" className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition md:h-10 md:w-10 ${headerIconClass(pathname === "/rpe" || pathname.startsWith("/rpe/"))}`} title="RPE" aria-label="RPE">
            <Activity className="h-5 w-5" />
            {todoToday && !todoToday.rpeDone && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400" title="To do today" aria-hidden />}
          </Link>
          <Link href="/chat" className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition md:h-10 md:w-10 ${headerIconClass(pathname === "/chat" || pathname.startsWith("/chat/"))}`} title="Chat" aria-label="Chat">
            <MessageCircle className="h-5 w-5" />
            {unreadChatCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {unreadChatCount > 99 ? "99+" : unreadChatCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Email + Sign out on mobile: only in drawer (hamburger menu), not below header */}
      <div className={`hidden border-t px-4 py-2 md:hidden ${sidebarBorderClass}`} aria-hidden>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className={`truncate text-xs ${sidebarMutedClass}`} title={userEmail}>{userEmail}</p>
            <p className={`text-xs font-medium capitalize ${sidebarLabelClass}`}>{role}</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm ${sidebarMutedClass} ${signOutHoverClass}`}>
              <LogOut className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
    {/* Main content: on desktop dashboard show full left panel + main; else main only. Laptop only. */}
    <div className={`flex min-w-0 flex-1 flex-col ${isDashboardDesktop ? "md:flex-row" : ""}`}>
      {isDashboardDesktop && (
        <div
          className={`no-print hidden h-full min-h-0 w-64 shrink-0 flex-col border-r md:flex ${sidebarBorderClass}`}
          style={sidebarBgStyle ?? { backgroundColor: "var(--card-bg)" }}
        >
          {menuPanelContent}
        </div>
      )}
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
    {mobileMenuOpen && mobileDrawer}
    </>
  );
}
