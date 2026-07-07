"use client";

import { useEffect } from "react";
import { setLastRead } from "@/app/actions/chat";

export function MarkRoomRead({ roomId }: { roomId: string }) {
  useEffect(() => {
    void setLastRead(roomId);
  }, [roomId]);
  return null;
}
