"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMessage, toggleLike } from "@/app/actions/chat";
import type { ChatMessageRow } from "@/lib/types";

export function MessageBubbleWithActions({
  message,
  displayName,
  isOwn,
  isAdmin,
  roomId,
  likeCount,
  userLiked,
}: {
  message: ChatMessageRow;
  displayName: string;
  isOwn: boolean;
  isAdmin: boolean;
  roomId: string;
  likeCount: number;
  userLiked: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [copied, setCopied] = useState(false);
  const canDelete = isOwn || isAdmin;

  async function handleCopy() {
    const text = message.body?.trim() || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteMessage(message.id, roomId);
    setDeleting(false);
    if (!result.error) router.refresh();
  }

  async function handleLike() {
    setLiking(true);
    const result = await toggleLike(message.id, roomId);
    setLiking(false);
    if (!result.error) router.refresh();
  }

  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const isImage =
    message.attachment_url &&
    /\.(jpe?g|png|gif|webp)(\?|$)/i.test(message.attachment_url);

  return (
    <li
      className={`flex flex-col gap-0.5 ${isOwn ? "items-end" : "items-start"}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">
          {displayName} · {time}
        </span>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            title="Delete message"
          >
            {deleting ? "…" : "Delete"}
          </button>
        )}
      </div>
      <div
        className={`group max-w-[85%] rounded-lg px-3 py-2 ${
          isOwn ? "bg-emerald-600/30 text-white" : "bg-zinc-800 text-zinc-200"
        }`}
      >
        {message.body ? (
          <p className="whitespace-pre-wrap text-sm">{message.body}</p>
        ) : null}
        {message.attachment_url ? (
          isImage ? (
            <a
              href={message.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block max-h-48 overflow-hidden rounded"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.attachment_url}
                alt="Attachment"
                className="max-h-48 rounded object-contain"
              />
            </a>
          ) : (
            <a
              href={message.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs text-emerald-400 underline"
            >
              Attachment
            </a>
          )
        ) : null}
        <div className="mt-1.5 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          {message.body?.trim() && (
            <button
              type="button"
              onClick={handleCopy}
              className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              title="Copy"
              aria-label="Copy message"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
          <button
            type="button"
            onClick={handleLike}
            disabled={liking}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs disabled:opacity-50 ${
              userLiked ? "text-red-400 hover:bg-red-500/20" : "text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
            }`}
            title={userLiked ? "Unlike" : "Like"}
            aria-label={userLiked ? "Unlike" : "Like"}
          >
            <span className="text-sm">{userLiked ? "❤️" : "🤍"}</span>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
        </div>
      </div>
    </li>
  );
}
