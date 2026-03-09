"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Search, Plus } from "lucide-react";
import { CreateChatRoomForm } from "@/app/(app)/chat/CreateChatRoomForm";
import type { ChatRoomRow } from "@/lib/types";

function getRoomDateLabel(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const key = (x: Date) => x.toISOString().slice(0, 10);
  if (key(d) === key(today)) return "Today";
  if (key(d) === key(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  return getRoomDateLabel(iso);
}

/** 1–2 initials from room name: "Sepsi Players" → SP, "Staff" → ST */
function getRoomInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const a = words[0][0] ?? "";
    const b = words[1][0] ?? "";
    return (a + b).toUpperCase().slice(0, 2);
  }
  const first = trimmed.slice(0, 2).toUpperCase();
  return first || "?";
}

const ROOM_AVATAR_COLORS = [
  "bg-emerald-600/80 text-emerald-100",
  "bg-teal-600/80 text-teal-100",
  "bg-zinc-600/80 text-zinc-200",
  "bg-amber-600/80 text-amber-100",
  "bg-sky-600/80 text-sky-100",
  "bg-violet-600/80 text-violet-100",
] as const;

/** Stable subtle accent for a room name (no backend). */
function getRoomAvatarColor(name: string): string {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return ROOM_AVATAR_COLORS[Math.abs(n) % ROOM_AVATAR_COLORS.length];
}

type LastMessageByRoom = Record<string, { body: string | null; created_at: string }>;

export function ChatSidebar({
  rooms,
  unreadByRoom,
  lastMessageByRoom,
  isAdmin,
}: {
  rooms: ChatRoomRow[];
  unreadByRoom: Record<string, number>;
  lastMessageByRoom: LastMessageByRoom;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const activeRoomId = useMemo(() => {
    const m = pathname?.match(/^\/chat\/([^/]+)$/);
    return m ? m[1] : null;
  }, [pathname]);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, search]);

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border-b bg-zinc-900/95 lg:max-h-none lg:min-h-0 lg:h-auto lg:w-[320px] lg:flex-none lg:border-b-0 lg:border-r"
      style={{ borderColor: "var(--card-border)" }}
    >
      <div className="flex shrink-0 flex-col gap-2 p-3 pb-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:gap-3 lg:p-4 lg:pb-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white lg:text-lg">
          <MessageCircle className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden />
          Chats
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 lg:py-2.5"
            aria-label="Search rooms"
          />
        </div>
        {isAdmin && (
          <div>
            {showCreate ? (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/80 p-3 lg:rounded-lg">
                <CreateChatRoomForm />
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="mt-2 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex w-full min-h-[42px] items-center justify-center gap-2 rounded-xl bg-zinc-800/90 py-2.5 text-sm font-medium text-zinc-300 shadow-sm transition hover:bg-zinc-700/80 hover:text-white active:bg-zinc-700 lg:min-h-[44px] lg:rounded-lg lg:border lg:border-zinc-600 lg:bg-transparent lg:py-3 lg:text-zinc-400 lg:hover:border-emerald-500/50 lg:hover:bg-emerald-500/10 lg:hover:text-emerald-400 lg:active:bg-emerald-500/15"
              >
                <Plus className="h-4 w-4" />
                Create room
              </button>
            )}
          </div>
        )}
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:px-3 lg:py-2 lg:pb-4">
        {filteredRooms.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            {rooms.length === 0
              ? isAdmin ? "No rooms yet. Create one above." : "No rooms yet."
              : "No rooms match your search."}
          </p>
        ) : (
          <ul className="space-y-2 lg:space-y-1.5">
            {filteredRooms.map((room) => {
              const unread = unreadByRoom[room.id] ?? 0;
              const last = lastMessageByRoom[room.id];
              const preview = last?.body?.trim()
                ? last.body.length > 50
                  ? last.body.slice(0, 50) + "…"
                  : last.body
                : last
                  ? "Attachment"
                  : null;
              const isActive = activeRoomId === room.id;
              const timestamp = last?.created_at
                ? getRelativeTime(last.created_at)
                : room.created_at
                  ? getRoomDateLabel(room.created_at)
                  : null;
              return (
                <li key={room.id}>
                  <Link
                    href={`/chat/${room.id}`}
                    prefetch={true}
                    className={`group flex min-h-[60px] items-center gap-3 rounded-xl px-3.5 py-2.5 transition-colors active:scale-[0.99] lg:min-h-0 lg:items-start lg:rounded-xl lg:px-3 lg:py-2.5 ${
                      isActive
                        ? "bg-emerald-500/20 ring-1.5 ring-emerald-500/40 shadow-md lg:bg-emerald-500/15 lg:ring-1 lg:ring-emerald-500/30 lg:shadow-sm"
                        : "border border-zinc-700/40 bg-zinc-800/60 shadow-sm hover:bg-zinc-800/70 hover:border-zinc-600/50 active:bg-zinc-700/60 lg:border-0 lg:bg-transparent lg:shadow-none lg:hover:bg-white/[0.06] lg:active:bg-white/[0.08]"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold lg:h-8 lg:w-8 lg:text-[11px] ${getRoomAvatarColor(room.name)}`}
                      aria-hidden
                    >
                      {getRoomInitials(room.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-[15px] font-bold leading-tight ${
                            isActive ? "text-emerald-400" : "text-white"
                          } lg:text-sm lg:font-semibold ${unread > 0 ? "text-white lg:font-semibold" : ""}`}
                        >
                          {room.name}
                        </span>
                        {timestamp && (
                          <span className="shrink-0 text-[9px] text-zinc-500/90 tabular-nums lg:text-[10px] lg:text-zinc-500">
                            {timestamp}
                          </span>
                        )}
                      </div>
                      {preview !== null && (
                        <p className="mt-0.5 truncate text-[11px] leading-snug text-zinc-500/90 lg:mt-0.5 lg:text-xs lg:text-zinc-500">
                          {preview}
                        </p>
                      )}
                    </div>
                    {unread > 0 && (
                      <span
                        className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white"
                        title={`${unread} unread`}
                      >
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}
