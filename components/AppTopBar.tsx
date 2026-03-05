"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Calendar, HeartPulse, Activity } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const TOP_BAR_LINKS = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/wellness", label: "Wellness", icon: HeartPulse },
  { href: "/rpe", label: "RPE", icon: Activity },
] as const;

interface AppTopBarProps {
  unreadChatCount?: number;
  todoToday?: { wellnessDone: boolean; rpeDone: boolean } | null;
}

export function AppTopBar({ unreadChatCount = 0, todoToday }: AppTopBarProps) {
  const pathname = usePathname();
  const { themeId } = useTheme();
  const isLight = themeId === "light";
  const isNeon = themeId === "neon";
  const isMatt = themeId === "matt";

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

  const needsTodo = (href: string) => {
    if (!todoToday) return false;
    if (href === "/wellness") return !todoToday.wellnessDone;
    if (href === "/rpe") return !todoToday.rpeDone;
    return false;
  };

  return (
    <header
      className="flex h-14 min-h-[44px] shrink-0 items-center justify-end gap-1.5 border-b px-4 md:h-16 md:gap-2 md:px-6"
      style={{
        borderColor: isNeon ? "rgba(16,185,129,0.1)" : isMatt ? "rgba(255,255,255,0.14)" : undefined,
        backgroundColor: isNeon ? "#080c0a" : isMatt ? "#141418" : "var(--card-bg)",
      }}
    >
      {TOP_BAR_LINKS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const showTodo = needsTodo(href);
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition md:h-10 md:w-10 ${
              headerIconClass(isActive)
            }`}
            title={label}
            aria-label={label}
          >
            <Icon className="h-5 w-5" />
            {href === "/chat" && unreadChatCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {unreadChatCount > 99 ? "99+" : unreadChatCount}
              </span>
            )}
            {showTodo && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400"
                title="To do today"
                aria-hidden
              />
            )}
          </Link>
        );
      })}
    </header>
  );
}
