/** Whether a stored image URL can be loaded in the browser (not a local file path). */
export function isRenderableImageUrl(url: string | null | undefined): boolean {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("file:")) return false;
  if (/^[a-z]:[\\/]/i.test(trimmed)) return false;

  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    trimmed.startsWith("/")
  );
}

export function normalizeImageUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? "").trim();
  return isRenderableImageUrl(trimmed) ? trimmed : null;
}
