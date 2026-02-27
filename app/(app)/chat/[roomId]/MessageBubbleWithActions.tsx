"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Heart, Reply, X } from "lucide-react";
import { deleteMessage, toggleLike } from "@/app/actions/chat";
import { useReply } from "./ReplyContext";
import { LinkPreview, extractFirstUrl } from "./LinkPreview";
import type { ChatMessageRow } from "@/lib/types";

function formatTime(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateStr}, ${timeStr}`;
}

export function MessageBubbleWithActions({
  message,
  displayName,
  isOwn,
  isAdmin,
  roomId,
  likeCount,
  userLiked,
  showSender = true,
  isFirstMessageOfDay = false,
  dateLabel = "",
  replyTo = null,
  actionsOpen = false,
  onToggleActions,
  onCloseActions,
}: {
  message: ChatMessageRow;
  displayName: string;
  isOwn: boolean;
  isAdmin: boolean;
  roomId: string;
  likeCount: number;
  userLiked: boolean;
  showSender?: boolean;
  isFirstMessageOfDay?: boolean;
  dateLabel?: string;
  replyTo?: { body: string; senderName: string } | null;
  actionsOpen?: boolean;
  onToggleActions?: () => void;
  onCloseActions?: () => void;
}) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const canDelete = isOwn || isAdmin;
  const { setReplyingTo } = useReply();

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  useEffect(() => {
    if (!actionsOpen || !onCloseActions) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseActions();
    };
    const closeIfOutside = (e: MouseEvent | TouchEvent) => {
      const target = "touches" in e ? (e as TouchEvent).target : (e as MouseEvent).target;
      if (wrapperRef.current && !wrapperRef.current.contains(target as Node)) onCloseActions();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("touchstart", closeIfOutside, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("touchstart", closeIfOutside);
    };
  }, [actionsOpen, onCloseActions]);

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
    if (liking) return;
    setLiking(true);
    const result = await toggleLike(message.id, roomId);
    setLiking(false);
    if (result.error) {
      console.error("Like failed:", result.error);
    } else {
      router.refresh();
    }
  }

  const label = isOwn ? "You" : displayName;
  const time = formatTime(message.created_at);
  const fullDateTime = formatFullDateTime(message.created_at);
  const showHeaderDateTime = isFirstMessageOfDay && dateLabel && time;
  const isImage =
    message.attachment_url &&
    /\.(jpe?g|png|gif|webp)(\?|$)/i.test(message.attachment_url);

  const hasHeaderContent = showSender || showHeaderDateTime;
  return (
    <li
      className={`group flex flex-col ${hasHeaderContent ? "gap-0.5" : "gap-0"} ${isOwn ? "items-end" : "items-start"}`}
    >
      {hasHeaderContent && (
        <div className="flex min-h-[1.25rem] flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-zinc-500">
            {showSender && label}
            {showSender && showHeaderDateTime && " · "}
            {showHeaderDateTime && `${dateLabel}, ${time}`}
          </span>
        </div>
      )}
      <div
        ref={wrapperRef}
        className={`flex w-fit max-w-[85%] flex-col ${isOwn ? "items-end" : "items-start"}`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => onToggleActions?.()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleActions?.();
            }
          }}
          className={`cursor-pointer rounded-lg px-3 py-2 ${
            isOwn ? "bg-emerald-600/30 text-white" : "bg-zinc-800 text-zinc-200"
          }`}
          title="Click to show options"
          aria-label="Toggle message options"
        >
        {replyTo && (
          <div
            className={`mb-1.5 border-l-2 pl-2 text-xs ${
              isOwn ? "border-white/40 text-white/80" : "border-zinc-500 text-zinc-400"
            }`}
          >
            <span className="font-medium">{replyTo.senderName}</span>
            {replyTo.body && (
              <span className="block truncate">
                {replyTo.body.length > 60 ? replyTo.body.slice(0, 60) + "…" : replyTo.body}
              </span>
            )}
          </div>
        )}
        {message.body ? (
          <p className="whitespace-pre-wrap text-sm">{message.body}</p>
        ) : null}
        {message.body && extractFirstUrl(message.body) && (
          <LinkPreview url={extractFirstUrl(message.body)!} isOwn={isOwn} />
        )}
        {message.attachment_url ? (
          isImage ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxOpen(true);
                }}
                className="mt-1 block max-h-48 overflow-hidden rounded text-left"
                aria-label="Open image"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.attachment_url}
                  alt="Attachment"
                  className="max-h-48 cursor-pointer rounded object-contain hover:opacity-90"
                />
              </button>
              {lightboxOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Image preview"
                  onClick={() => setLightboxOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(false)}
                    className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                    aria-label="Close"
                  >
                    <X className="h-6 w-6" />
                  </button>
                  <a
                    href={message.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-h-[90vh] max-w-[90vw]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={message.attachment_url}
                      alt="Attachment"
                      className="max-h-[90vh] max-w-full rounded object-contain"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </a>
                </div>
              )}
            </>
          ) : (
            <a
              href={message.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs text-emerald-400 underline"
              onClick={(e) => e.stopPropagation()}
            >
              Attachment
            </a>
          )
        ) : null}
        {actionsOpen && fullDateTime && (
          <div className={`mt-1 ${isOwn ? "text-right" : "text-left"}`}>
            <span
              className={`text-[10px] ${isOwn ? "text-white/60" : "text-zinc-500"}`}
              aria-hidden
            >
              Sent: {fullDateTime}
            </span>
          </div>
        )}
        {likeCount > 0 && (
          <div
            className={`mt-1 flex items-center gap-0.5 ${isOwn ? "justify-end" : "justify-start"}`}
            aria-label={`${likeCount} like${likeCount !== 1 ? "s" : ""}`}
          >
            <Heart
              className={`h-3.5 w-3.5 ${userLiked ? "fill-emerald-400 text-emerald-400" : "text-zinc-500"}`}
              aria-hidden
            />
            <span className={`text-[10px] ${userLiked && isOwn ? "text-white/70" : userLiked ? "text-emerald-400" : "text-zinc-500"}`}>
              {likeCount}
            </span>
          </div>
        )}
        </div>
        {actionsOpen && (
          <div
            role="menu"
            className="relative z-10 mt-1.5 flex max-w-[min(100vw-2rem,20rem)] flex-wrap items-center gap-1 rounded-xl border border-zinc-600 bg-zinc-800/95 px-2 py-1.5 shadow-lg backdrop-blur-sm"
            style={{ borderColor: "var(--card-border)" }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {canDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={deleting}
                className="min-h-[44px] min-w-[44px] rounded-lg px-2.5 py-2 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                title="Delete message"
              >
                {deleting ? "…" : "Delete"}
              </button>
            )}
            {message.body?.trim() && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className="min-h-[44px] min-w-[44px] rounded-lg px-2.5 py-2 text-xs text-zinc-300 hover:bg-white/10"
                title="Copy"
                aria-label="Copy message"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
            <form
              action={async () => {
                await handleLike();
              }}
              className="contents"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="submit"
                disabled={liking}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-xs disabled:opacity-50 ${
                  userLiked ? "text-emerald-400 hover:bg-emerald-500/20" : "text-zinc-300 hover:bg-white/10"
                }`}
                title={userLiked ? "Unlike" : "Like"}
                aria-label={userLiked ? "Unlike" : "Like"}
              >
                <Heart
                  className={`h-3.5 w-3.5 pointer-events-none ${userLiked ? "fill-emerald-400 text-emerald-400" : ""}`}
                  aria-hidden
                />
                {likeCount > 0 && <span className="pointer-events-none">{likeCount}</span>}
              </button>
            </form>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setReplyingTo({
                  messageId: message.id,
                  body: message.body?.trim() || "",
                  senderName: label,
                });
                onCloseActions?.();
              }}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-xs text-zinc-300 hover:bg-white/10"
              title="Reply"
              aria-label="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
              <span>Reply</span>
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
