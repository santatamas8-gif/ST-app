"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { revalidateChatLayout } from "@/app/actions/chat";
import { ChatSidebar } from "./ChatSidebar";
import type { ChatRoomRow } from "@/lib/types";

type LastMessageByRoom = Record<string, { body: string | null; created_at: string }>;

const SIDEBAR_REFRESH_DEBOUNCE_MS = 400;

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
  const pathname = usePathname();
  const router = useRouter();
  const [isLg, setIsLg] = useState(true);
  const sidebarRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsLg(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);

  // Realtime: any new message → revalidate layout so sidebar (last message, timestamp, unread) stays fresh
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("chat-sidebar-refresh")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload: { new?: { room_id?: string } }) => {
          const roomId = payload.new?.room_id;
          const currentRoomMatch = pathname?.match(/^\/chat\/([^/]+)$/);
          const currentRoomId = currentRoomMatch?.[1];
          if (roomId && currentRoomId === roomId) return;
          if (sidebarRefreshTimeoutRef.current) clearTimeout(sidebarRefreshTimeoutRef.current);
          sidebarRefreshTimeoutRef.current = setTimeout(() => {
            sidebarRefreshTimeoutRef.current = null;
            revalidateChatLayout().then(() => router.refresh());
          }, SIDEBAR_REFRESH_DEBOUNCE_MS);
        }
      )
      .subscribe();
    return () => {
      if (sidebarRefreshTimeoutRef.current) clearTimeout(sidebarRefreshTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [pathname, router]);

  const isRoomPage = pathname != null && /^\/chat\/[^/]+$/.test(pathname);
  const showSidebar = isLg || !isRoomPage;
  const showMain = isLg || isRoomPage;

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-none border-0 bg-zinc-900/50 lg:flex-row lg:rounded-xl lg:border"
      style={{ borderColor: "var(--card-border)" }}
    >
      {showSidebar && (
        <ChatSidebar
          rooms={rooms}
          unreadByRoom={unreadByRoom}
          lastMessageByRoom={lastMessageByRoom}
          isAdmin={isAdmin}
        />
      )}
      {showMain && (
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-zinc-900/30">
          {children}
        </main>
      )}
    </div>
  );
}
