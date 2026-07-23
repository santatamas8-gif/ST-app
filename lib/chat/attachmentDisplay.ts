/**
 * Short label for chat PDF attachments.
 * Full name stays in the title/download attribute.
 * Mobile: shorter prefix + "..." so the bubble does not overflow.
 */
export function shortenAttachmentName(name: string, maxLen = 24): string {
  const trimmed = name.trim();
  if (!trimmed) return "PDF";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxLen))}...`;
}

/** Prefer original filename; never show generic "PDF document" when a name exists. */
export function resolveAttachmentLabel(
  attachmentName: string | null | undefined,
  isPdf: boolean
): string {
  const name = attachmentName?.trim();
  if (name) return name;
  return isPdf ? "PDF" : "Attachment";
}
