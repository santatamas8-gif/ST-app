/** Short label for chat PDF attachments; full name stays in download/open. */
export function shortenAttachmentName(name: string, maxLen = 24): string {
  const trimmed = name.trim();
  if (!trimmed) return "PDF";
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}...`;
}
