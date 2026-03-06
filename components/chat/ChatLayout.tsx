"use client";

import { ChatSidebar } from "./ChatSidebar";
import type { ChatRoomRow } from "@/lib/types";

type LastMessageByRoom = Record<string, { body: string | null; created_at: string }>;

export function ChatLayout({
  rooms,
  unreadByRoom,
  lastMessageByRoom,
  isAdmin,
  children,
}: {
  rooms: ChatRoomRow[];
  unreadByRoom: Record<string, number>;
  lastMessageByRoom: LastMessageByRoom;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border bg-zinc-900/50 lg:flex-row"
      style={{ borderColor: "var(--card-border)" }}
    >
      <ChatSidebar
        rooms={rooms}
        unreadByRoom={unreadByRoom}
        lastMessageByRoom={lastMessageByRoom}
        isAdmin={isAdmin}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-900/30">
        {children}
      </main>
    </div>
  );
}
