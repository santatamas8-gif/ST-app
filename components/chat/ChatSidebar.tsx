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
      className="flex max-h-[45vh] w-full shrink-0 flex-col overflow-hidden border-b bg-zinc-900/95 lg:max-h-none lg:w-[320px] lg:border-b-0 lg:border-r"
      style={{ borderColor: "var(--card-border)" }}
    >
      <div className="flex flex-col gap-3 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <MessageCircle className="h-5 w-5 text-emerald-500" aria-hidden />
          Chats
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms"
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            aria-label="Search rooms"
          />
        </div>
        {isAdmin && (
          <div>
            {showCreate ? (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-3">
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
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-600 py-2.5 text-sm font-medium text-zinc-400 transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
              >
                <Plus className="h-4 w-4" />
                Create room
              </button>
            )}
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2 lg:px-3 lg:pb-4">
        {filteredRooms.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            {rooms.length === 0
              ? isAdmin ? "No rooms yet. Create one above." : "No rooms yet."
              : "No rooms match your search."}
          </p>
        ) : (
          <ul className="space-y-1.5">
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
                    className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      isActive
                        ? "bg-emerald-500/15 ring-1 ring-emerald-500/30"
                        : "hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm font-semibold ${
                            isActive ? "text-emerald-400" : "text-white"
                          } ${unread > 0 ? "font-semibold" : ""}`}
                        >
                          {room.name}
                        </span>
                        {timestamp && (
                          <span className="shrink-0 text-[10px] text-zinc-500 tabular-nums">
                            {timestamp}
                          </span>
                        )}
                      </div>
                      {preview !== null && (
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {preview}
                        </p>
                      )}
                    </div>
                    {unread > 0 && (
                      <span
                        className="mt-1 shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white"
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
