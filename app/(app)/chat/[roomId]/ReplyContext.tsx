"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ReplyingTo = {
  messageId: string;
  body: string;
  senderName: string;
} | null;

const ReplyContext = createContext<{
  replyingTo: ReplyingTo;
  setReplyingTo: (value: ReplyingTo) => void;
} | null>(null);

export function ReplyProvider({ children }: { children: ReactNode }) {
  const [replyingTo, setReplyingToState] = useState<ReplyingTo>(null);
  const setReplyingTo = useCallback((value: ReplyingTo) => {
    setReplyingToState(value);
  }, []);
  return (
    <ReplyContext.Provider value={{ replyingTo, setReplyingTo }}>
      {children}
    </ReplyContext.Provider>
  );
}

export function useReply() {
  const ctx = useContext(ReplyContext);
  if (!ctx) return { replyingTo: null, setReplyingTo: () => {} };
  return ctx;
}
