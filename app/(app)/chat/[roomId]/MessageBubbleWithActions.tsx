"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Heart, Reply, X, FileText, MoreVertical, Trash2 } from "lucide-react";
import { deleteMessage, toggleLike } from "@/app/actions/chat";
import { useReply } from "./ReplyContext";
import { LinkPreview, extractFirstUrl } from "./LinkPreview";
import { shortenAttachmentName } from "@/lib/chat/attachmentDisplay";
import type { ChatMessageRow } from "@/lib/types";

const LONG_PRESS_MS = 450;

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
  onDeleted,
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
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [liking, setLiking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxConfirmDelete, setLightboxConfirmDelete] = useState(false);
  const canDelete = isOwn || isAdmin;
  const hasAttachment = Boolean(message.attachment_url);
  const { setReplyingTo } = useReply();

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!actionsOpen) {
      setConfirmDelete(false);
      setDeleteError(null);
    }
  }, [actionsOpen]);

  useEffect(() => {
    if (!lightboxOpen) {
      setLightboxConfirmDelete(false);
    }
  }, [lightboxOpen]);

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

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  function startLongPress() {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onToggleActions?.();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(15);
      }
    }, LONG_PRESS_MS);
  }

  function endLongPress() {
    clearLongPressTimer();
  }

  async function performDelete() {
    setDeleteError(null);
    setDeleting(true);
    const result = await deleteMessage(message.id, roomId);
    setDeleting(false);
    if (result.error) {
      setDeleteError(result.error);
      setConfirmDelete(false);
      setLightboxConfirmDelete(false);
      return;
    }
    setConfirmDelete(false);
    setLightboxConfirmDelete(false);
    setLightboxOpen(false);
    onCloseActions?.();
    onDeleted?.();
    router.refresh();
  }

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

  function openAttachment() {
    if (!message.attachment_url) return;
    window.open(message.attachment_url, "_blank", "noopener,noreferrer");
  }

  const label = isOwn ? "You" : displayName;
  const time = formatTime(message.created_at);
  const fullDateTime = formatFullDateTime(message.created_at);
  const showHeaderDateTime = isFirstMessageOfDay && dateLabel && time;
  const isImage =
    message.attachment_url &&
    /\.(jpe?g|png|gif|webp)(\?|$)/i.test(message.attachment_url);
  const isPdf =
    message.attachment_url &&
    /\.pdf(\?|$)/i.test(message.attachment_url);
  const attachmentLabel = message.attachment_name?.trim() || (isPdf ? "PDF document" : "Attachment");
  const pdfDisplayName = isPdf ? shortenAttachmentName(attachmentLabel) : attachmentLabel;
  const replyPreviewBody =
    message.body?.trim() ||
    (hasAttachment ? (isPdf ? pdfDisplayName : isImage ? "Photo" : "Attachment") : "");

  const showTimeInHeader = showHeaderDateTime && !isOwn;
  const hasHeaderContent = showSender || showTimeInHeader;

  const actionBtnClass =
    "min-h-[44px] min-w-[44px] rounded-lg px-2 py-1 text-xs disabled:opacity-50 lg:min-h-[32px] lg:min-w-[32px] lg:rounded-md lg:px-2 lg:py-1 lg:text-[11px]";

  return (
    <div
      className={`group flex flex-col ${hasHeaderContent ? "gap-1" : "gap-0"} ${isOwn ? "items-end" : "items-start"}`}
    >
      {hasHeaderContent && (
        <div className={`flex min-h-[1.25rem] flex-wrap items-baseline gap-x-2 gap-y-0.5 ${isOwn ? "flex-row-reverse" : ""}`}>
          {showSender && (
            <span className="text-xs font-medium text-zinc-300">
              {label}
            </span>
          )}
          {showTimeInHeader && (
            <span className="text-[10px] text-zinc-500 tabular-nums">
              {time}
            </span>
          )}
        </div>
      )}
      <div className={`flex min-w-0 max-w-[92%] flex-col sm:max-w-[min(85%,22rem)] lg:max-w-[min(85%,20rem)] ${isOwn ? "ml-auto items-end" : "items-start"}`}>
        <div
          ref={wrapperRef}
          className={`flex w-full min-w-0 items-end gap-1 ${isOwn ? "flex-row-reverse" : ""}`}
        >
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (longPressTriggeredRef.current) {
              longPressTriggeredRef.current = false;
              return;
            }
            if (!hasAttachment) onToggleActions?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!hasAttachment) onToggleActions?.();
            }
          }}
          onTouchStart={startLongPress}
          onTouchEnd={endLongPress}
          onTouchCancel={endLongPress}
          onContextMenu={(e) => {
            e.preventDefault();
            onToggleActions?.();
          }}
          className={`min-w-0 max-w-full cursor-pointer rounded-2xl border px-3 py-2 shadow-sm lg:px-3.5 lg:py-2.5 ${
            isOwn
              ? "border-emerald-500/20 bg-emerald-500/20 text-white"
              : "border-zinc-700/50 bg-zinc-800/90 text-zinc-200"
          }`}
          title={fullDateTime ? `Sent ${fullDateTime}` : hasAttachment ? "Long-press for options" : "Tap for options"}
          aria-label={hasAttachment ? "Message with attachment. Long-press for options." : "Toggle message options"}
        >
          {replyTo && (
            <div
              className={`mb-2 rounded-lg border-l-2 pl-2.5 text-xs ${
                isOwn ? "border-emerald-400/40 text-white/90" : "border-zinc-500/80 text-zinc-400"
              }`}
            >
              <span className={`font-medium ${isOwn ? "text-white/90" : "text-zinc-300"}`}>{replyTo.senderName}</span>
              {replyTo.body && (
                <span className={`mt-0.5 block truncate ${isOwn ? "text-white/70" : "text-zinc-500"}`}>
                  {replyTo.body.length > 60 ? replyTo.body.slice(0, 60) + "…" : replyTo.body}
                </span>
              )}
            </div>
          )}
          {message.body ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{message.body}</p>
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
                    if (longPressTriggeredRef.current) {
                      longPressTriggeredRef.current = false;
                      return;
                    }
                    setLightboxOpen(true);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    startLongPress();
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    endLongPress();
                  }}
                  onTouchCancel={(e) => {
                    e.stopPropagation();
                    endLongPress();
                  }}
                  className="mt-2 block max-h-48 overflow-hidden rounded-xl text-left"
                  aria-label="Open image"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={message.attachment_url}
                    alt="Attachment"
                    className="max-h-48 max-w-full cursor-pointer rounded-xl object-contain hover:opacity-95"
                  />
                </button>
                {lightboxOpen && (
                  <div
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Image preview"
                    onClick={() => setLightboxOpen(false)}
                  >
                    <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(false)}
                        className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20"
                        aria-label="Close"
                      >
                        <X className="h-6 w-6" />
                      </button>
                      {canDelete && (
                        lightboxConfirmDelete ? (
                          <div className="flex items-center gap-2 rounded-full bg-zinc-900/90 px-3 py-2">
                            <span className="text-xs text-zinc-300">Delete permanently?</span>
                            <button
                              type="button"
                              disabled={deleting}
                              onClick={(e) => {
                                e.stopPropagation();
                                void performDelete();
                              }}
                              className="rounded-md bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                            >
                              {deleting ? "…" : "Delete"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxConfirmDelete(false);
                              }}
                              className="rounded-md px-2 py-1.5 text-xs text-zinc-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxConfirmDelete(true);
                            }}
                            className="flex items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/30"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        )
                      )}
                    </div>
                    <a
                      href={message.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-h-[75vh] max-w-[90vw]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={message.attachment_url}
                        alt="Attachment"
                        className="max-h-[75vh] max-w-full rounded object-contain"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </a>
                  </div>
                )}
              </>
            ) : isPdf ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (longPressTriggeredRef.current) {
                    longPressTriggeredRef.current = false;
                    return;
                  }
                  openAttachment();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  startLongPress();
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  endLongPress();
                }}
                onTouchCancel={(e) => {
                  e.stopPropagation();
                  endLongPress();
                }}
                title={attachmentLabel}
                className={`mt-1.5 flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors ${
                  isOwn
                    ? "border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                    : "border-zinc-600/80 bg-zinc-900/50 hover:bg-zinc-900"
                }`}
              >
                <FileText className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-xs font-medium ${isOwn ? "text-white" : "text-zinc-200"}`}>
                    {pdfDisplayName}
                  </span>
                  <span className={`text-[10px] ${isOwn ? "text-white/70" : "text-zinc-500"}`}>Tap to open</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openAttachment();
                }}
                className="mt-2 inline-block text-left text-xs text-emerald-400 underline decoration-emerald-500/50 hover:decoration-emerald-400"
              >
                Attachment
              </button>
            )
          ) : null}
          {likeCount > 0 && (
            <div
              className={`mt-1.5 flex items-center gap-1 ${isOwn ? "justify-end" : "justify-start"}`}
              aria-label={`${likeCount} like${likeCount !== 1 ? "s" : ""}`}
            >
              <Heart
                className={`h-3.5 w-3.5 ${userLiked ? "fill-emerald-400 text-emerald-400" : "text-zinc-500"}`}
                aria-hidden
              />
              <span className={`text-[10px] ${userLiked && isOwn ? "text-white/60" : userLiked ? "text-emerald-400" : "text-zinc-500"}`}>
                {likeCount}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleActions?.();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-700/60 hover:text-zinc-200 lg:h-9 lg:w-9 lg:opacity-0 lg:group-hover:opacity-100 ${
            actionsOpen ? "bg-zinc-700/60 text-zinc-200 opacity-100" : "opacity-100 lg:opacity-0"
          }`}
          aria-label="Message options"
          aria-expanded={actionsOpen}
          title="Options"
        >
          <MoreVertical className="h-5 w-5" aria-hidden />
        </button>
        </div>

      {actionsOpen && (
        <div
          role="menu"
          className={`relative z-10 mt-1 flex max-w-[min(100vw-2rem,24rem)] flex-wrap items-center gap-1 rounded-xl border border-zinc-700/50 bg-zinc-800/95 px-1.5 py-1.5 shadow-lg lg:mt-0.5 lg:max-w-[min(100vw-2rem,20rem)] lg:rounded-md lg:px-1.5 lg:py-1 ${
            isOwn ? "ml-auto" : ""
          }`}
          style={{ borderColor: "var(--card-border)" }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {time && (
            <span
              className="mr-1 border-r border-zinc-600/80 pr-2 text-[10px] text-zinc-500 tabular-nums lg:pr-1.5"
              aria-hidden
            >
              {time}
            </span>
          )}
          {canDelete && (
            confirmDelete ? (
              <>
                <span className="px-1 text-[11px] text-zinc-400">Delete permanently?</span>
                <button
                  type="button"
                  disabled={deleting}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    void performDelete();
                  }}
                  className={`${actionBtnClass} bg-red-500/20 font-medium text-red-400 hover:bg-red-500/30`}
                >
                  {deleting ? "…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(false);
                  }}
                  className={`${actionBtnClass} text-zinc-400 hover:bg-white/10`}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                disabled={deleting}
                className={`${actionBtnClass} flex items-center gap-1 text-red-400 hover:bg-red-500/15`}
                title="Delete message permanently"
              >
                <Trash2 className="h-3.5 w-3.5 lg:h-3 lg:w-3" aria-hidden />
                Delete
              </button>
            )
          )}
          {deleteError && (
            <span className="w-full px-1 text-[10px] text-red-400" role="alert">
              {deleteError}
            </span>
          )}
          {message.body?.trim() && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className={`${actionBtnClass} text-zinc-400 hover:bg-white/10`}
              title="Copy"
              aria-label="Copy message"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
          <button
            type="button"
            disabled={liking}
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              void handleLike();
            }}
            className={`${actionBtnClass} flex items-center justify-center gap-0.5 ${
              userLiked ? "text-emerald-400 hover:bg-emerald-500/15" : "text-zinc-400 hover:bg-white/10"
            }`}
            title={userLiked ? "Unlike" : "Like"}
            aria-label={userLiked ? "Unlike" : "Like"}
          >
            <Heart
              className={`h-3.5 w-3.5 lg:h-3 lg:w-3 ${userLiked ? "fill-emerald-400 text-emerald-400" : ""}`}
              aria-hidden
            />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              setReplyingTo({
                messageId: message.id,
                body: replyPreviewBody,
                senderName: label,
              });
              onCloseActions?.();
            }}
            className={`${actionBtnClass} flex items-center justify-center gap-0.5 text-zinc-400 hover:bg-white/10`}
            title="Reply"
            aria-label="Reply"
          >
            <Reply className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
            <span>Reply</span>
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
