"use client";

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
}: {
  roomName: string;
  membersCount: number;
  isAdmin: boolean;
  roomId: string;
  members?: Member[];
  availableUsers?: AvailableUser[];
  currentUserId?: string;
}) {
  const membersLabel = `${membersCount} ${membersCount === 1 ? "member" : "members"}`;

  return (
    <header
      className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 md:mx-1.5 md:mt-1.5 md:flex-nowrap md:rounded-xl md:border md:border-zinc-700/60 md:bg-zinc-800/80 md:px-3 md:py-2 md:shadow-sm"
      style={{ borderColor: "var(--card-border)" }}
    >
      {/* Left: room name; on desktop add secondary "X members" line */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold tracking-tight text-white sm:text-xl md:text-base md:font-semibold">
          {roomName}
        </h1>
        <p className="mt-0.5 hidden text-xs text-zinc-500 md:block" aria-hidden>
          {membersLabel}
        </p>
      </div>

      {/* Right: desktop = subtle members (admin) + delete; mobile = same as before */}
      <div className="flex shrink-0 items-center gap-2">
        {isAdmin && currentUserId ? (
          <RoomMembersManager
            roomId={roomId}
            members={members}
            availableUsers={availableUsers}
            currentUserId={currentUserId}
            subtleOnDesktop
          />
        ) : (
          <span
            className="rounded-full border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-300 md:hidden"
            title="Members"
          >
            {membersLabel}
          </span>
        )}
        {isAdmin && <DeleteRoomButton roomId={roomId} />}
      </div>
    </header>
  );
}
