"use client";

import { ChatMessageList } from "@/app/(app)/chat/[roomId]/ChatMessageList";
import type { ChatMessageRow } from "@/lib/types";

export type MessageListProps = {
  messages: ChatMessageRow[];
  displayNameByUserId: Record<string, string>;
  currentUserId: string;
  isAdmin: boolean;
  roomId: string;
  likesByMessage: Record<string, { count: number; userLiked: boolean }>;
  lastReadAt: string | null;
};

export function MessageList(props: MessageListProps) {
  return <ChatMessageList {...props} />;
}
