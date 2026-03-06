"use client";

import { SendMessageForm } from "@/app/(app)/chat/[roomId]/SendMessageForm";

export function MessageInput({ roomId }: { roomId: string }) {
  return (
    <div className="sticky bottom-0 z-10 shrink-0 bg-zinc-900/30 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] lg:static lg:bg-transparent lg:p-0 lg:px-4 lg:py-3 lg:pb-3">
      <SendMessageForm roomId={roomId} />
    </div>
  );
}
