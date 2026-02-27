"use client";

import { useRef, useState, useEffect, Fragment } from "react";
import { MessageBubbleWithActions } from "./MessageBubbleWithActions";
import type { ChatMessageRow } from "@/lib/types";

function getDateLabel(iso: string | undefined): string {
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

type ChatMessageListProps = {
  messages: ChatMessageRow[];
  displayNameByUserId: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
  roomId: string;
  likesByMessage: Record<string, { count: number; userLiked: boolean }>;
};

export function ChatMessageList({
  messages,
  displayNameByUserId,
  currentUserId,
  isAdmin,
  roomId,
  likesByMessage,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 80);
    };
    check();
    el.addEventListener("scroll", check);
    return () => el.removeEventListener("scroll", check);
  }, [messages.length]);

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <p className="text-center text-zinc-500">No messages yet. Send the first message below.</p>
      </div>
    );
  }

  let lastDateKey = "";
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-4">
          {messages.map((m) => {
            const dateKey = m.created_at ? m.created_at.slice(0, 10) : "";
            const showDate = dateKey !== lastDateKey;
            if (showDate) lastDateKey = dateKey;
            return (
              <Fragment key={m.id}>
                {showDate && (
                  <li className="flex justify-center py-2">
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                      {getDateLabel(m.created_at)}
                    </span>
                  </li>
                )}
                <MessageBubbleWithActions
                  message={m}
                  displayName={displayNameByUserId[m.user_id] ?? m.user_id.slice(0, 8)}
                  isOwn={m.user_id === currentUserId}
                  isAdmin={isAdmin}
                  roomId={roomId}
                  likeCount={likesByMessage[m.id]?.count ?? 0}
                  userLiked={likesByMessage[m.id]?.userLiked ?? false}
                />
              </Fragment>
            );
          })}
        </ul>
      </div>
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 rounded-full bg-zinc-700 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-zinc-600"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          ↓ Scroll to bottom
        </button>
      )}
    </div>
  );
}
