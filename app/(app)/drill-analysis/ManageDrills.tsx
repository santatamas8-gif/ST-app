"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDrillAnalysisLayout } from "@/app/actions/drillAnalysis";
import type { EditorCard, EditorOccurrence } from "@/lib/drillAnalysis/types";

type DraftCard = {
  localId: string;
  previousCardId: string | null;
  displayName: string;
  occurrenceKeys: string[];
  keepImage: boolean;
  hasImage: boolean;
};

function draftsFromSaved(cards: EditorCard[]): DraftCard[] {
  return cards.map((card) => ({
    localId: card.id,
    previousCardId: card.id,
    displayName: card.displayName,
    occurrenceKeys: [...card.occurrenceKeys],
    keepImage: card.hasImage,
    hasImage: card.hasImage,
  }));
}

export function ManageDrills({
  sessionKey,
  occurrences,
  savedCards,
}: {
  sessionKey: string;
  occurrences: EditorOccurrence[];
  savedCards: EditorCard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const savedVersion = `${sessionKey}|${savedCards
    .map((card) => `${card.id}:${card.displayName}:${card.hasImage}:${card.occurrenceKeys.join(",")}`)
    .join("|")}`;
  const [draftSource, setDraftSource] = useState(savedVersion);
  const [drafts, setDrafts] = useState<DraftCard[]>(() => draftsFromSaved(savedCards));
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  if (savedVersion !== draftSource) {
    setDraftSource(savedVersion);
    setDrafts(draftsFromSaved(savedCards));
    setDirty(false);
    setMessage(null);
  }

  const byKey = useMemo(() => new Map(occurrences.map((occurrence) => [occurrence.key, occurrence])), [occurrences]);
  const assigned = new Set(drafts.flatMap((card) => card.occurrenceKeys));
  const available = occurrences.filter((occurrence) => !assigned.has(occurrence.key));

  function update(localId: string, change: (card: DraftCard) => DraftCard) {
    setDrafts((current) => current.map((card) => (card.localId === localId ? change(card) : card)));
    setDirty(true);
  }

  function moveToCard(fromId: string, key: string, toId: string) {
    if (!toId || fromId === toId) return;
    setDrafts((current) =>
      current.map((card) => {
        if (card.localId === fromId) {
          return { ...card, occurrenceKeys: card.occurrenceKeys.filter((item) => item !== key) };
        }
        if (card.localId === toId && !card.occurrenceKeys.includes(key)) {
          return { ...card, occurrenceKeys: [...card.occurrenceKeys, key] };
        }
        return card;
      })
    );
    setDirty(true);
  }

  function moveSet(localId: string, index: number, direction: -1 | 1) {
    update(localId, (card) => {
      const keys = [...card.occurrenceKeys];
      const target = index + direction;
      if (target < 0 || target >= keys.length) return card;
      const [item] = keys.splice(index, 1);
      keys.splice(target, 0, item);
      return { ...card, occurrenceKeys: keys };
    });
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveDrillAnalysisLayout({
        sessionKey,
        cards: drafts.map((card) => ({
          displayName: card.displayName,
          occurrenceKeys: card.occurrenceKeys,
          previousCardId: card.previousCardId,
          keepImage: card.keepImage && card.hasImage,
        })),
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setDirty(false);
      setMessage("Drill layout saved.");
      router.refresh();
    });
  }

  return (
    <section className="da-screen-only space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Manage drills</h2>
          <p className="text-sm text-zinc-600">
            Choose any number of occurrences for each card. Column order is the order you save. The report keeps the original session order. One occurrence belongs to only one card in this session.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900"
            onClick={() => {
              setDrafts((current) => [
                ...current,
                {
                  localId: `new:${crypto.randomUUID()}`,
                  previousCardId: null,
                  displayName: "",
                  occurrenceKeys: [],
                  keepImage: false,
                  hasImage: false,
                },
              ]);
              setDirty(true);
            }}
          >
            New card
          </button>
          <button
            type="button"
            disabled={pending}
            className="h-11 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-60"
            onClick={save}
          >
            {pending ? "Saving…" : "Save layout"}
          </button>
        </div>
      </div>
      {message ? <p className="text-sm text-zinc-800">{message}</p> : null}
      {dirty ? <p className="text-sm text-zinc-600">Unsaved layout changes.</p> : null}

      <div className="space-y-3">
        {drafts.map((card) => (
          <article key={card.localId} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-sm">
                <span className="mb-1 block text-zinc-700">Display name (optional)</span>
                <input
                  value={card.displayName}
                  onChange={(event) => update(card.localId, (current) => ({ ...current, displayName: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-zinc-300 px-3 text-zinc-900"
                />
              </label>
              <button
                type="button"
                className="h-11 rounded-lg border border-red-300 px-3 text-sm text-red-700"
                onClick={() => {
                  setDrafts((current) => current.filter((item) => item.localId !== card.localId));
                  setDirty(true);
                }}
              >
                Delete card
              </button>
            </div>
            <ol className="space-y-2">
              {card.occurrenceKeys.map((key, index) => {
                const occurrence = byKey.get(key);
                return (
                  <li key={key} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                    <span className="font-medium text-zinc-900">SET {index + 1}</span>
                    <span className="min-w-0 flex-1 text-zinc-800">
                      {occurrence ? `${occurrence.drill} · ${occurrence.timeLabel}` : "Missing source occurrence"}
                    </span>
                    <button type="button" className="h-10 rounded-lg border border-zinc-300 bg-white px-3" onClick={() => moveSet(card.localId, index, -1)}>
                      Up
                    </button>
                    <button type="button" className="h-10 rounded-lg border border-zinc-300 bg-white px-3" onClick={() => moveSet(card.localId, index, 1)}>
                      Down
                    </button>
                    <button
                      type="button"
                      className="h-10 rounded-lg border border-zinc-300 bg-white px-3"
                      onClick={() =>
                        update(card.localId, (current) => ({
                          ...current,
                          occurrenceKeys: current.occurrenceKeys.filter((item) => item !== key),
                        }))
                      }
                    >
                      Remove
                    </button>
                    {drafts.length > 1 ? (
                      <select
                        aria-label={`Move SET ${index + 1} to another card`}
                        className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2 sm:w-auto"
                        value=""
                        onChange={(event) => moveToCard(card.localId, key, event.target.value)}
                      >
                        <option value="">Move to card</option>
                        {drafts.flatMap((other, otherIndex) =>
                          other.localId === card.localId
                            ? []
                            : [
                                <option key={other.localId} value={other.localId}>
                                  {other.displayName.trim() || `Card ${otherIndex + 1}`}
                                </option>,
                              ]
                        )}
                      </select>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-700">Add occurrence</span>
              <select
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3"
                value=""
                onChange={(event) => {
                  const key = event.target.value;
                  if (!key) return;
                  update(card.localId, (current) => ({ ...current, occurrenceKeys: [...current.occurrenceKeys, key] }));
                }}
              >
                <option value="">Select a drill occurrence</option>
                {available.map((occurrence) => (
                  <option key={occurrence.key} value={occurrence.key}>
                    {occurrence.drill} · {occurrence.timeLabel}
                  </option>
                ))}
              </select>
            </label>
          </article>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-900">Not grouped</h3>
        {available.length === 0 ? (
          <p className="text-sm text-zinc-600">Every drill occurrence is on a card.</p>
        ) : (
          <ul className="space-y-1 text-sm text-zinc-800">
            {available.map((occurrence) => (
              <li key={occurrence.key}>
                {occurrence.drill} · {occurrence.timeLabel}
                {occurrence.timeUncertain ? " · start time is not a single value" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
