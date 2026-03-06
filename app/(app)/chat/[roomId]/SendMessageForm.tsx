"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Plus, Send } from "lucide-react";
import { sendMessage } from "@/app/actions/chat";
import { useReply } from "./ReplyContext";

const DESKTOP_TEXTAREA_MIN_H = 40;
const DESKTOP_TEXTAREA_MAX_H = 120;

export function SendMessageForm({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { replyingTo, setReplyingTo } = useReply();
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = body.trim();
    if (!trimmed && !attachmentUrl) return;
    setLoading(true);
    const result = await sendMessage(
      roomId,
      trimmed,
      attachmentUrl,
      replyingTo?.messageId ?? null
    );
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBody("");
    setAttachmentUrl(null);
    setReplyingTo(null);
    router.refresh();
  }

  async function processFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Only images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5MB or smaller.");
      return;
    }
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.set("roomId", roomId);
    formData.set("file", file);
    try {
      const res = await fetch("/api/chat/upload-attachment", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      setAttachmentUrl(data.url);
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || uploading) return;
    processFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  const canSend = body.trim() || attachmentUrl;

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend && !loading) formRef.current?.requestSubmit();
    }
  }

  // Auto-resize textarea on desktop (single-row bar)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const syncHeight = () => {
      ta.style.height = "auto";
      const h = Math.min(Math.max(ta.scrollHeight, DESKTOP_TEXTAREA_MIN_H), DESKTOP_TEXTAREA_MAX_H);
      ta.style.height = `${h}px`;
    };
    syncHeight();
    const ro = new ResizeObserver(syncHeight);
    ro.observe(ta);
    return () => ro.disconnect();
  }, [body]);

  const textareaCommon =
    "w-full min-w-0 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none disabled:opacity-50 resize-none";
  const textareaDesktop =
    "min-h-[40px] max-h-[120px] py-2 px-0 leading-[1.4] border-0 focus:ring-0 md:placeholder:opacity-80";
  const textareaMobile =
    "min-h-[38px] max-h-[120px] rounded-md border-0 py-2 pl-2 pr-1 leading-[1.35] focus:ring-0 placeholder:align-middle md:border-0 md:min-h-[40px] md:max-h-[120px] md:py-2 md:px-0 md:leading-[1.4] md:focus:ring-0";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="flex flex-col gap-2 border-t pt-2 lg:pt-4"
      style={{ borderColor: "var(--card-border)" }}
    >
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs lg:py-2 lg:text-sm">
          <span className="min-w-0 truncate text-zinc-400">
            Replying to <strong className="text-zinc-300">{replyingTo.senderName}</strong>
            {replyingTo.body && (
              <>: &ldquo;{replyingTo.body.length > 50 ? replyingTo.body.slice(0, 50) + "…" : replyingTo.body}&rdquo;</>
            )}
          </span>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="flex-shrink-0 rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white"
            aria-label="Cancel reply"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={onFileChange}
        disabled={uploading}
      />

      {/* Mobile-only: attachment preview above composer */}
      {attachmentUrl && (
        <div className="relative inline-block md:hidden">
          <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-zinc-600 bg-zinc-800">
            <Image
              src={attachmentUrl}
              alt="Attachment"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <button
            type="button"
            onClick={() => setAttachmentUrl(null)}
            className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white hover:bg-red-600"
          >
            Remove
          </button>
        </div>
      )}

      {/* Composer: mobile = single row [ + | textarea | Send ]; desktop = one row bar [ add image | input | send ] */}
      <div
        className="flex flex-row flex-nowrap items-center gap-1.5 rounded-xl border border-zinc-700/50 bg-zinc-800/70 px-1.5 py-1.5 shadow-sm lg:gap-2 lg:rounded-2xl lg:border-zinc-700/60 lg:bg-zinc-800/90 lg:px-2.5 lg:py-1.5"
        style={{ borderColor: "var(--card-border)" }}
      >
        {/* Left: add image (+); on desktop also thumbnail when attachment present */}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-700/80 hover:text-white disabled:opacity-50 md:h-9 md:w-9 md:rounded-lg"
            aria-label="Add image"
            title="Add image"
          >
            {uploading ? (
              <span className="text-xs">…</span>
            ) : (
              <Plus className="h-5 w-5 md:h-4 md:w-4" />
            )}
          </button>
          {attachmentUrl && (
            <div className="relative hidden flex-shrink-0 md:block">
              <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-zinc-600">
                <Image
                  src={attachmentUrl}
                  alt="Attachment"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <button
                type="button"
                onClick={() => setAttachmentUrl(null)}
                className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Center: textarea (expands); auto-resize kept via existing useEffect */}
        <div className="flex min-w-0 flex-1 items-center self-center">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message…"
            title="Enter to send, Shift+Enter for new line"
            rows={1}
            maxLength={4000}
            className={`${textareaCommon} ${textareaMobile} ${textareaDesktop}`}
            disabled={loading}
            style={{ minHeight: DESKTOP_TEXTAREA_MIN_H }}
          />
        </div>

        {/* Right: char count (desktop) + send */}
        <div className="flex shrink-0 items-center gap-2">
          {body.length >= 3000 && (
            <span
              className={`hidden text-[10px] tabular-nums md:inline ${body.length >= 3800 ? "text-amber-400" : "text-zinc-500"}`}
              aria-live="polite"
            >
              {body.length}/4000
            </span>
          )}
          <button
            type="submit"
            disabled={loading || !canSend}
            className="flex h-8 min-w-[36px] shrink-0 items-center justify-center rounded-md bg-emerald-600 px-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 md:h-9 md:min-w-[36px] md:rounded-lg md:px-3.5"
            aria-label="Send message"
          >
            <Send className="h-4 w-4 md:h-4 md:w-4 lg:hidden" />
            <span className="hidden lg:inline">{loading ? "Sending…" : "Send"}</span>
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
