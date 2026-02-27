"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setLastRead } from "@/app/actions/chat";

export function MarkRoomRead({ roomId }: { roomId: string }) {
  const router = useRouter();
  useEffect(() => {
    setLastRead(roomId).then(() => {
      router.refresh();
    });
  }, [roomId, router]);
  return null;
}
