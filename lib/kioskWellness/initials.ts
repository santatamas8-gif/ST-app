/** Strip accents and lowercase for initials comparison (e.g. Tamás → tamas). */
export function normalizeInitialsText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/**
 * Expected 2-letter kiosk password from display name.
 * Two or more name parts: first letter of first + first letter of last part (Santa Tamás → st).
 * Single part: first two letters (John → jo).
 */
export function getExpectedPlayerInitials(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "";

  const parts = trimmed.split(/\s+/).filter(Boolean);
  const normalizedParts = parts.map((part) => normalizeInitialsText(part));

  if (parts.length >= 2) {
    const first = normalizedParts[0]?.[0] ?? "";
    const last = normalizedParts[normalizedParts.length - 1]?.[0] ?? "";
    return `${first}${last}`;
  }

  const word = normalizedParts[0] ?? "";
  if (word.length >= 2) return word.slice(0, 2);
  if (word.length === 1) return `${word}${word}`;
  return "";
}

export function verifyPlayerInitials(displayName: string, input: string): boolean {
  const expected = getExpectedPlayerInitials(displayName);
  if (expected.length !== 2) return false;

  const normalizedInput = normalizeInitialsText(input.trim());
  return normalizedInput.length >= 2 && normalizedInput.slice(0, 2) === expected;
}
