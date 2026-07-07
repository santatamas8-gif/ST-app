"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { ExerciseImage } from "./ExerciseImage";
import { isRenderableImageUrl } from "@/lib/strength/imageUrl";

interface ExerciseImageEditorProps {
  exerciseId: string;
  exerciseName: string;
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
  onError?: (message: string) => void;
}

export function ExerciseImageEditor({
  exerciseId,
  exerciseName,
  imageUrl,
  onImageChange,
  onError,
}: ExerciseImageEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(imageUrl ?? "");

  const hasImage = Boolean(imageUrl && isRenderableImageUrl(imageUrl));

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const form = new FormData();
        form.set("exerciseId", exerciseId);
        form.set("file", file);
        const res = await fetch("/api/admin/strength/upload-exercise-image", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as { image_url?: string; error?: string };
        if (!res.ok || !data.image_url) {
          onError?.(data.error ?? "Upload failed");
          return;
        }
        onImageChange(data.image_url);
        setUrlDraft(data.image_url);
      } catch {
        onError?.("Upload failed");
      } finally {
        setUploading(false);
        setDragOver(false);
      }
    },
    [exerciseId, onError, onImageChange]
  );

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) uploadFile(file);
    else onError?.("Drop an image file (JPEG, PNG, or WebP)");
  }

  async function onDelete() {
    if (!hasImage) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/strength/delete-exercise-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        onError?.(data.error ?? "Delete failed");
        return;
      }
      onImageChange(null);
      setUrlDraft("");
    } catch {
      onError?.("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function onSaveUrl() {
    const trimmed = urlDraft.trim();
    if (trimmed && !isRenderableImageUrl(trimmed)) {
      onError?.("Use a valid web URL (https://…) or upload a file");
      return;
    }
    setUploading(true);
    try {
      const { updateExerciseImage } = await import("@/app/actions/strength");
      const result = await updateExerciseImage(exerciseId, trimmed);
      if (result.error) {
        onError?.(result.error);
        return;
      }
      onImageChange(trimmed || null);
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || deleting;

  return (
    <div className="flex w-full flex-col gap-3 sm:w-44 sm:shrink-0">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition ${
          dragOver
            ? "border-emerald-500 bg-emerald-500/10"
            : "border-zinc-600 hover:border-zinc-500 hover:bg-zinc-800/30"
        } ${busy ? "pointer-events-none opacity-70" : ""}`}
        aria-label={`Upload image for ${exerciseName}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onPickFile}
          disabled={busy}
        />
        <div className="p-2">
          {hasImage ? (
            <ExerciseImage
              src={imageUrl}
              alt={exerciseName}
              className="aspect-square w-full"
            />
          ) : (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg bg-zinc-800/40 px-2 text-center text-zinc-500">
              {busy ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <>
                  <ImagePlus className="h-8 w-8 opacity-60" />
                  <span className="text-xs leading-snug">
                    Drop image or tap to upload
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        {!busy && (
          <div className="absolute bottom-2 right-2 rounded-md bg-zinc-900/90 p-1.5 text-zinc-300 shadow">
            <Upload className="h-4 w-4" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="min-h-[36px] flex-1 rounded-lg border border-zinc-600 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {hasImage ? "Replace" : "Choose file"}
        </button>
        {hasImage && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-red-900/60 px-2 py-1.5 text-xs text-red-400 hover:bg-red-950/40 disabled:opacity-50"
            aria-label="Remove image"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowUrl((v) => !v)}
        className="text-left text-xs text-zinc-500 hover:text-zinc-400"
      >
        {showUrl ? "Hide URL option" : "Or paste image URL"}
      </button>
      {showUrl && (
        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="https://…"
            className="min-h-[36px] w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-white"
          />
          <button
            type="button"
            disabled={busy || urlDraft.trim() === (imageUrl ?? "")}
            onClick={onSaveUrl}
            className="min-h-[36px] rounded-lg bg-zinc-700 px-2 py-1.5 text-xs text-white hover:bg-zinc-600 disabled:opacity-50"
          >
            Save URL
          </button>
        </div>
      )}
    </div>
  );
}
