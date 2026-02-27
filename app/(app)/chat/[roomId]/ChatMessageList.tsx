"use client";

import { useRef, useState, useEffect, Fragment } from "react";
import { MessageCircle } from "lucide-react";
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
  lastReadAt: string | null;
};

export function ChatMessageList({
  messages,
  displayNameByUserId,
  currentUserId,
  isAdmin,
  roomId,
  likesByMessage,
  lastReadAt,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const prevLengthRef = useRef(messages.length);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [openMessageId, setOpenMessageId] = useState<string | null>(null);

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

  // Initial load: scroll to first unread or bottom
  useEffect(() => {
    if (initialScrollDone.current || messages.length === 0) return;
    initialScrollDone.current = true;
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (firstUnreadRef.current) {
        firstUnreadRef.current.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, [messages.length, lastReadAt]);

  // New message while in room: auto-scroll to bottom
  useEffect(() => {
    if (!initialScrollDone.current) return;
    if (messages.length > prevLengthRef.current) {
      prevLengthRef.current = messages.length;
      scrollToBottom();
    } else {
      prevLengthRef.current = messages.length;
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div ref={scrollRef} className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-8">
        <MessageCircle
          className="mb-4 h-14 w-14 text-zinc-600"
          aria-hidden
        />
        <p className="text-center text-sm text-zinc-500">
          Send the first message to get started.
        </p>
      </div>
    );
  }

  const firstUnreadId =
    lastReadAt && messages.find((m) => m.created_at && m.created_at > lastReadAt)?.id;
  let lastDateKey = "";
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-0">
          {messages.map((m, i) => {
            const dateKey = m.created_at ? m.created_at.slice(0, 10) : "";
            const showDate = dateKey !== lastDateKey;
            if (showDate) lastDateKey = dateKey;
            const prev = messages[i - 1];
            const showSender = !prev || prev.user_id !== m.user_id;
            const isConsecutiveSameSender = prev?.user_id === m.user_id;
            const isFirstMessageOfDay = showDate;
            const dateLabel = showDate ? getDateLabel(m.created_at) : "";
            const isFirstUnread = m.id === firstUnreadId;
            const replyToMsg = m.reply_to_message_id
              ? messages.find((m2) => m2.id === m.reply_to_message_id)
              : null;
            const replyTo =
              replyToMsg && m.reply_to_message_id
                ? {
                    body: replyToMsg.body ?? "",
                    senderName:
                      displayNameByUserId[replyToMsg.user_id] ?? replyToMsg.user_id.slice(0, 8),
                  }
                : null;
            const bubble = (
              <MessageBubbleWithActions
                message={m}
                displayName={displayNameByUserId[m.user_id] ?? m.user_id.slice(0, 8)}
                isOwn={m.user_id === currentUserId}
                isAdmin={isAdmin}
                roomId={roomId}
                likeCount={likesByMessage[m.id]?.count ?? 0}
                userLiked={likesByMessage[m.id]?.userLiked ?? false}
                showSender={showSender}
                isFirstMessageOfDay={isFirstMessageOfDay}
                dateLabel={dateLabel}
                replyTo={replyTo}
                actionsOpen={openMessageId === m.id}
                onToggleActions={() => setOpenMessageId((id) => (id === m.id ? null : m.id))}
                onCloseActions={() => setOpenMessageId(null)}
              />
            );
            return (
              <Fragment key={m.id}>
                {showDate && (
                  <li className="mt-3 flex justify-center py-1.5 first:mt-0">
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                      {getDateLabel(m.created_at)}
                    </span>
                  </li>
                )}
                <li
                  className={isConsecutiveSameSender ? "mt-px" : "mt-1.5"}
                  ref={isFirstUnread ? firstUnreadRef : undefined}
                >
                  {bubble}
                </li>
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
          ↓ Bottom
        </button>
      )}
    </div>
  );
}
