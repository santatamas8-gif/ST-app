"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { sendMessage } from "@/app/actions/chat";
import { useReply } from "./ReplyContext";

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

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="flex flex-col gap-2 border-t pt-4"
      style={{ borderColor: "var(--card-border)" }}
    >
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-sm">
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
      {attachmentUrl && (
        <div className="relative inline-block">
          <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-zinc-600 bg-zinc-800">
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
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Write a message…"
        title="Enter to send, Shift+Enter for new line"
        rows={2}
        maxLength={4000}
        className="min-h-[72px] w-full resize-y rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        disabled={loading}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploading}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Add image"}
          </button>
          {body.length >= 3000 && (
            <span
              className={`text-xs ${body.length >= 3800 ? "text-amber-400" : "text-zinc-500"}`}
              aria-live="polite"
            >
              {body.length} / 4000
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={loading || !canSend}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
