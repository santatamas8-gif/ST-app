type NameParts = {
  first: string;
  middle: string;
  last: string;
};

function nameParts(name: string): NameParts {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return { first: "", middle: "", last: "" };
  if (words.length === 1) return { first: words[0]!, middle: "", last: "" };
  return {
    first: words[0]!,
    middle: words.slice(1, -1).join(""),
    last: words[words.length - 1]!,
  };
}

function clip(value: string, count: number): string {
  return value.slice(0, Math.max(0, count)).toUpperCase();
}

/** Two-letter monogram: first and last word. A single word uses its first two letters. */
function standardMark(parts: NameParts): string {
  if (!parts.first && !parts.last) return "—";
  if (!parts.last) return clip(parts.first, Math.min(2, parts.first.length));
  return clip(parts.first, 1) + clip(parts.last, 1);
}

function render(parts: NameParts, firstTake: number, lastTake: number, middleTake: number): string {
  return clip(parts.first, firstTake) + clip(parts.middle, middleTake) + clip(parts.last, lastTake) || "—";
}

/**
 * Print labels for the two selected players. The mark follows the name, not the column.
 * Identical monograms grow, using the surname first, until the two labels differ.
 */
export function comparePrintMarks(playerA: string, playerB: string): readonly [string, string] {
  const left = nameParts(playerA);
  const right = nameParts(playerB);
  const plainLeft = standardMark(left);
  const plainRight = standardMark(right);
  if (plainLeft !== plainRight) return [plainLeft, plainRight];

  const hasLast = Boolean(left.last || right.last);
  let firstTake = hasLast ? 1 : Math.max(plainLeft.length, plainRight.length, 1);
  let lastTake = hasLast ? 1 : 0;
  let middleTake = 0;
  let markA = render(left, firstTake, lastTake, middleTake);
  let markB = render(right, firstTake, lastTake, middleTake);
  const guard =
    left.first.length +
    right.first.length +
    left.middle.length +
    right.middle.length +
    left.last.length +
    right.last.length +
    3;
  for (let step = 0; markA === markB && step < guard; step += 1) {
    if (left.last.slice(lastTake) !== right.last.slice(lastTake)) lastTake += 1;
    else if (left.first.slice(firstTake) !== right.first.slice(firstTake)) firstTake += 1;
    else if (left.middle.slice(middleTake) !== right.middle.slice(middleTake)) middleTake += 1;
    else break;
    markA = render(left, firstTake, lastTake, middleTake);
    markB = render(right, firstTake, lastTake, middleTake);
  }
  return [markA, markB];
}
