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
    } catch {
      onError?.("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const busy = uploading || deleting;

  return (
    <div className="flex w-full flex-col gap-2.5 sm:w-44 sm:shrink-0 md:w-full">
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
        className={`relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition ${
          dragOver
            ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_24px_-8px_rgba(16,185,129,0.45)]"
            : "border-zinc-600/80 bg-zinc-950/40 hover:border-zinc-500 hover:bg-zinc-900/50"
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
        <div className="p-1.5 sm:p-2">
          {hasImage ? (
            <ExerciseImage
              src={imageUrl}
              alt={exerciseName}
              className="aspect-[4/3] w-full md:aspect-square"
            />
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg bg-zinc-900/60 px-3 text-center text-zinc-500 md:aspect-square">
              {busy ? (
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400/80" />
              ) : (
                <>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-800/50">
                    <ImagePlus className="h-5 w-5 opacity-70" />
                  </div>
                  <span className="max-w-[10rem] text-xs leading-snug text-zinc-400">
                    Drop image or tap to upload
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        {!busy && (
          <div className="absolute bottom-2.5 right-2.5 rounded-lg border border-zinc-700/60 bg-zinc-950/90 p-1.5 text-zinc-300 shadow-md backdrop-blur-sm">
            <Upload className="h-3.5 w-3.5" aria-hidden />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="min-h-[40px] flex-1 rounded-xl border border-zinc-600/80 bg-zinc-900/60 px-2.5 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/80 disabled:opacity-50"
        >
          {hasImage ? "Replace" : "Choose file"}
        </button>
        {hasImage && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-red-900/50 bg-red-950/25 px-2.5 py-2 text-red-400 transition hover:border-red-700/60 hover:bg-red-950/45 disabled:opacity-50"
            aria-label="Remove image"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
