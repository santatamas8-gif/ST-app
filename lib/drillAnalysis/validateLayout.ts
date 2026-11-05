import { occurrenceMatchesSession, parseSessionKey } from "@/lib/drillAnalysis/keys";
import { isFullTrainingDrill } from "@/lib/drillAnalysis/metrics";
import type { DrillOccurrence, LayoutCardInput, SavedDrillCard } from "@/lib/drillAnalysis/types";

export type LayoutSaveCard = {
  id: string | null;
  displayName: string;
  occurrenceKeys: string[];
  imagePath: string | null;
};

export type LayoutValidation =
  | { ok: true; cards: LayoutSaveCard[] }
  | { ok: false; error: string };

export function validateLayoutSave(input: {
  sessionKey: string;
  occurrences: DrillOccurrence[];
  previousCards: SavedDrillCard[];
  cards: LayoutCardInput[];
}): LayoutValidation {
  if (!parseSessionKey(input.sessionKey)) {
    return { ok: false, error: "The session identifier is not valid." };
  }
  const known = new Map(input.occurrences.map((occurrence) => [occurrence.key, occurrence]));
  const previouslySaved = new Set(input.previousCards.flatMap((card) => card.occurrenceKeys));
  const previousById = new Map(input.previousCards.map((card) => [card.id, card]));
  const seen = new Set<string>();
  const usedCardIds = new Set<string>();
  const cards: LayoutSaveCard[] = [];

  for (const card of input.cards) {
    const displayName = card.displayName.trim();
    if (displayName.length > 200) return { ok: false, error: "A display name must be 200 characters or fewer." };
    let id: string | null = null;
    if (card.previousCardId) {
      if (!previousById.has(card.previousCardId)) {
        return { ok: false, error: "The previous card is not part of this session." };
      }
      if (usedCardIds.has(card.previousCardId)) {
        return { ok: false, error: "A saved card can only be updated once." };
      }
      usedCardIds.add(card.previousCardId);
      id = card.previousCardId;
    }
    if (card.occurrenceKeys.length === 0) {
      return { ok: false, error: "Each card needs at least one drill occurrence." };
    }
    for (const key of card.occurrenceKeys) {
      if (seen.has(key)) {
        return { ok: false, error: "A drill occurrence can belong to only one card." };
      }
      seen.add(key);
      if (!occurrenceMatchesSession(key, input.sessionKey)) {
        return { ok: false, error: "A drill occurrence from another session cannot be saved here." };
      }
      const occurrence = known.get(key);
      if (occurrence && isFullTrainingDrill(occurrence.drill)) {
        return { ok: false, error: "Full Training stays in the summary and cannot be placed on a drill card." };
      }
      if (!occurrence && !previouslySaved.has(key)) {
        return { ok: false, error: "An unknown drill occurrence cannot be saved." };
      }
    }
    let imagePath: string | null = null;
    if (card.keepImage) {
      if (!card.previousCardId) return { ok: false, error: "An image can only be kept on an existing card." };
      const previous = previousById.get(card.previousCardId);
      if (!previous) return { ok: false, error: "The previous card is not part of this session." };
      imagePath = previous.imagePath;
    }
    cards.push({ id, displayName, occurrenceKeys: [...card.occurrenceKeys], imagePath });
  }

  return { ok: true, cards };
}

/** Keeps every saved card. Adds one card only when this drill is not saved yet. */
export function layoutForDrillImage(
  previousCards: SavedDrillCard[],
  occurrenceKey: string
): { cardId: string } | { cards: LayoutCardInput[] } {
  const existing = previousCards.find((card) => card.occurrenceKeys.includes(occurrenceKey));
  if (existing) return { cardId: existing.id };
  return {
    cards: [
      ...previousCards.map((card) => ({
        displayName: card.displayName,
        occurrenceKeys: [...card.occurrenceKeys],
        previousCardId: card.id,
        keepImage: card.imagePath !== null,
      })),
      {
        displayName: "",
        occurrenceKeys: [occurrenceKey],
        previousCardId: null,
        keepImage: false,
      },
    ],
  };
}
