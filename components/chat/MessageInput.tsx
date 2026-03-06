"use client";

import { SendMessageForm } from "@/app/(app)/chat/[roomId]/SendMessageForm";

export function MessageInput({ roomId }: { roomId: string }) {
  return (
    <div className="shrink-0 p-3 lg:px-4 lg:py-3">
      <SendMessageForm roomId={roomId} />
    </div>
  );
}
