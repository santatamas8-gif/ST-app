"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, MoreVertical } from "lucide-react";
import { RoomMembersManager } from "@/app/(app)/chat/[roomId]/RoomMembersManager";
import { DeleteRoomButton } from "@/app/(app)/chat/[roomId]/DeleteRoomButton";

type Member = { user_id: string; email: string; full_name: string | null };
type AvailableUser = { id: string; email: string; full_name: string | null };

export function ChatHeader({
  roomName,
  membersCount,
  isAdmin,
  roomId,
  members = [],
  availableUsers = [],
  currentUserId,
  teamLogoUrl = null,
}: {
  roomName: string;
  membersCount: number;
  isAdmin: boolean;
  roomId: string;
  members?: Member[];
  availableUsers?: AvailableUser[];
  currentUserId?: string;
  /** Team logo URL set by admin on dashboard – shown before room name */
  teamLogoUrl?: string | null;
}) {
  const membersLabel = `${membersCount} ${membersCount === 1 ? "member" : "members"}`;
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [menuOpen]);

  return (
    <header
      className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:mx-1.5 md:mt-1.5 md:flex-nowrap md:rounded-xl md:border md:border-zinc-700/60 md:bg-zinc-800/80 md:px-3 md:py-2 md:pl-3 md:pr-3 md:shadow-sm"
      style={{ borderColor: "var(--card-border)" }}
    >
      {/* Mobile: back + room name; Desktop: room name + members count */}
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-3">
        <Link
          href="/chat"
          prefetch={true}
          className="flex shrink-0 items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Back to chats"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        {teamLogoUrl ? (
          <img
            src={teamLogoUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-lg object-contain sm:h-9 sm:w-9"
            aria-hidden
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight text-white sm:text-lg md:text-base md:font-semibold">
            {roomName}
          </h1>
          {isAdmin && (
            <p className="mt-0.5 hidden text-xs text-zinc-500 lg:block" aria-hidden>
              {membersLabel}
            </p>
          )}
        </div>
      </div>

      {/* Desktop: members (admin) + delete; Mobile: three-dots menu or members badge */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Desktop: unchanged */}
        {isAdmin && currentUserId ? (
          <div className="hidden lg:block">
            <RoomMembersManager
              roomId={roomId}
              members={members}
              availableUsers={availableUsers}
              currentUserId={currentUserId}
              subtleOnDesktop
            />
          </div>
        ) : null}
        <div className="hidden lg:block">
          {isAdmin && <DeleteRoomButton roomId={roomId} />}
        </div>

        {/* Mobile: single menu (admin only) */}
        {isAdmin && (
          <div className="relative lg:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Room options"
              aria-expanded={menuOpen}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
                style={{ borderColor: "var(--card-border)" }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setMembersOpen(true);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-300 hover:bg-white/10"
                >
                  <span aria-hidden>👥</span>
                  Members
                </button>
                <DeleteRoomButton roomId={roomId} variant="menuitem" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: members panel (controlled, modal) — only when admin and opened from menu */}
      {isAdmin && currentUserId && (
        <div className="lg:hidden">
          <RoomMembersManager
            roomId={roomId}
            members={members}
            availableUsers={availableUsers}
            currentUserId={currentUserId}
            hideTrigger
            modal
            open={membersOpen}
            onOpenChange={setMembersOpen}
          />
        </div>
      )}
    </header>
  );
}
