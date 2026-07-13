"use client";

import { useState, useEffect } from "react";

const previewCache: Record<string, { title?: string; image?: string; description?: string }> = {};

export function LinkPreview({
  url,
  isOwn,
}: {
  url: string;
  isOwn: boolean;
}) {
  const [meta, setMeta] = useState<{ title?: string; image?: string; description?: string } | null>(
    () => previewCache[url] ?? null
  );
  const [loading, setLoading] = useState(() => !previewCache[url]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (previewCache[url]) {
      setMeta(previewCache[url]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        previewCache[url] = data;
        setMeta(data);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading || failed || (!meta?.title && !meta?.image)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1.5 block overflow-hidden rounded-lg border ${
        isOwn ? "border-white/20 bg-black/20" : "border-zinc-600 bg-zinc-800/80"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {meta.image && (
        <div className="relative h-32 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta.image}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="p-2">
        {meta.title && (
          <span className={`block truncate text-xs font-medium ${isOwn ? "text-white/90" : "text-zinc-200"}`}>
            {meta.title}
          </span>
        )}
        {meta.description && !meta.title && (
          <span className={`block truncate text-xs ${isOwn ? "text-white/70" : "text-zinc-400"}`}>
            {meta.description.slice(0, 100)}
            {meta.description.length > 100 ? "…" : ""}
          </span>
        )}
      </div>
    </a>
  );
}

export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  return match ? match[0] : null;
}
