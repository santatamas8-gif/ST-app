const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";

/** Extract storage object path from a public chat-attachments URL. */
export function chatAttachmentPathFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const marker = `/${CHAT_ATTACHMENTS_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0]?.trim();
  return path || null;
}

export { CHAT_ATTACHMENTS_BUCKET };
