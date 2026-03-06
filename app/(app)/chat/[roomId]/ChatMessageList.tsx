"use client";

import { useRef, useState, useEffect, Fragment } from "react";
import { MessageCircle, ChevronDown } from "lucide-react";
import { MessageBubbleWithActions } from "./MessageBubbleWithActions";
import type { ChatMessageRow } from "@/lib/types";

const GROUP_TIME_GAP_MS = 20 * 60 * 1000; // 20 minutes

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

/** Start a new message group when sender changes, day changes, or time gap >= 20 min. */
function isStartOfGroup(
  m: { user_id: string; created_at?: string | null },
  prev: { user_id: string; created_at?: string | null } | undefined,
  prevDateKey: string
): boolean {
  if (!prev) return true;
  if (prev.user_id !== m.user_id) return true;
  const currDateKey = m.created_at ? m.created_at.slice(0, 10) : "";
  if (currDateKey !== prevDateKey) return true;
  const prevTime = prev.created_at ? new Date(prev.created_at).getTime() : 0;
  const currTime = m.created_at ? new Date(m.created_at).getTime() : 0;
  if (currTime - prevTime >= GROUP_TIME_GAP_MS) return true;
  return false;
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
  const firstUnreadRef = useRef<HTMLLIElement>(null);
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

  const firstUnreadId =
    lastReadAt && messages.find((m) => m.created_at && m.created_at > lastReadAt)?.id;
  let lastDateKey = "";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Outer container = scrollable (scrollbar at far right of chat panel) */}
      <div
        ref={scrollRef}
        className="chat-message-scroll flex-1 overflow-y-auto overflow-x-hidden"
      >
        {/* Inner container = centered content column with max-width */}
        <div className="mx-auto w-full max-w-[880px] px-3 pb-20 pt-4 lg:pb-24">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageCircle
                className="mb-4 h-14 w-14 text-zinc-600"
                aria-hidden
              />
              <p className="text-sm text-zinc-500">
                Send the first message to get started.
              </p>
            </div>
          ) : (
        <ul className="space-y-0">
          {messages.map((m, i) => {
            const dateKey = m.created_at ? m.created_at.slice(0, 10) : "";
            const showDate = dateKey !== lastDateKey;
            if (showDate) lastDateKey = dateKey;
            const prev = messages[i - 1];
            const startOfGroup = isStartOfGroup(m, prev, prev?.created_at ? prev.created_at.slice(0, 10) : "");
            const showSender = startOfGroup;
            const isConsecutiveInGroup = prev && !startOfGroup;
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
                  <li className="mt-4 flex w-full items-center gap-3 py-2 first:mt-0" aria-hidden>
                    <span className="h-px flex-1 shrink-0 bg-zinc-700/50" />
                    <span className="shrink-0 rounded-full border border-zinc-700/60 bg-zinc-800/80 px-3 py-1 text-[11px] font-medium tracking-wide text-zinc-500">
                      {getDateLabel(m.created_at)}
                    </span>
                    <span className="h-px flex-1 shrink-0 bg-zinc-700/50" />
                  </li>
                )}
                <li
                  className={isConsecutiveInGroup ? "mt-0.5" : "mt-4"}
                  ref={isFirstUnread ? firstUnreadRef : undefined}
                >
                  {bubble}
                </li>
              </Fragment>
            );
          })}
        </ul>
          )}
        </div>
      </div>
      {showScrollBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700/90 text-zinc-300 shadow-md hover:bg-zinc-600 hover:text-white md:bottom-4 md:right-4"
          title="Jump to bottom"
          aria-label="Jump to bottom"
        >
          <ChevronDown className="h-5 w-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
