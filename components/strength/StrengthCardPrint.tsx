"use client";

import type { PlayerStrengthCard } from "@/lib/strength/types";
import { groupCardItemsByExercise } from "@/lib/strength/cardLayout";
import { ExerciseImage } from "./ExerciseImage";
import { PlayerAvatar } from "./PlayerAvatar";
import { StrengthSetTable } from "./StrengthSetTable";

interface StrengthCardPrintProps {
  cards: PlayerStrengthCard[];
}

function PrintExerciseBlock({
  name,
  imageUrl,
  sets,
}: {
  name: string;
  imageUrl: string | null;
  sets: {
    id?: string;
    set_number: number;
    percentage: number;
    reps: number;
    display_weight: string;
  }[];
}) {
  return (
    <article className="print-exercise-block">
      <h2 className="print-exercise-name">{name}</h2>
      <div className="print-exercise-body">
        <div className="print-exercise-image">
          <ExerciseImage
            src={imageUrl}
            alt={name}
            variant="print"
            className="print-exercise-image-inner"
          />
        </div>
        <div className="print-exercise-table">
          <StrengthSetTable sets={sets} variant="print" />
        </div>
      </div>
    </article>
  );
}

function PrintPlayerPage({ card }: { card: PlayerStrengthCard }) {
  const groups = groupCardItemsByExercise(card.items, 8, card.exerciseImages);
  const left = groups.slice(0, 4);
  const right = groups.slice(4, 8);
  const sessionLine = card.session.session_type
    ? `${card.session.title} · ${card.session.session_type}`
    : card.session.title;

  return (
    <section className="print-page" aria-label={`Strength card for ${card.player_name}`}>
      <header className="print-header">
        <PlayerAvatar
          name={card.player_name}
          avatarUrl={card.player_avatar_url}
          variant="print"
        />
        <div className="print-header-text">
          <h1 className="print-player-name">{card.player_name}</h1>
          <p className="print-date">{card.session.date}</p>
          <p className="print-session">{sessionLine}</p>
        </div>
      </header>

      <div className="print-columns">
        <div className="print-column">
          {left.map((g) => (
            <PrintExerciseBlock
              key={g.key}
              name={g.name}
              imageUrl={g.imageUrl}
              sets={g.sets}
            />
          ))}
        </div>
        <div className="print-column">
          {right.map((g) => (
            <PrintExerciseBlock
              key={g.key}
              name={g.name}
              imageUrl={g.imageUrl}
              sets={g.sets}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function StrengthCardPrint({ cards }: StrengthCardPrintProps) {
  return (
    <div className="print-cards-root">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 10mm;
        }

        /* Screen preview: centered full A4 sheets */
        .strength-print-shell {
          width: 100%;
          background: #e5e5e5;
          padding: 24px 0 48px;
        }

        .strength-print-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 210mm;
          max-width: calc(100vw - 32px);
          margin: 0 auto 20px;
          padding: 0 8px;
        }

        .print-cards-root {
          width: 100%;
          margin: 0 auto;
          background: transparent;
          color: #111;
        }

        .print-page {
          width: 190mm;
          min-height: 277mm;
          margin: 0 auto 24px;
          padding: 0;
          box-sizing: border-box;
          background: #fff;
          color: #111;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.12);
        }

        .print-page:last-child {
          margin-bottom: 0;
        }

        .print-header {
          display: flex;
          align-items: center;
          gap: 6mm;
          margin-bottom: 8mm;
          padding-bottom: 5mm;
          border-bottom: 1.5px solid #ccc;
          flex-shrink: 0;
        }

        .print-header-text {
          flex: 1;
          min-width: 0;
        }

        .print-player-name {
          font-size: 20pt;
          font-weight: 700;
          margin: 0 0 2mm;
          line-height: 1.15;
          color: #000;
        }

        .print-date {
          font-size: 12pt;
          margin: 0 0 1.5mm;
          color: #222;
        }

        .print-session {
          font-size: 11pt;
          margin: 0;
          color: #444;
        }

        .print-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5mm 7mm;
          flex: 1;
          align-content: start;
          width: 100%;
        }

        .print-column {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 5mm;
        }

        .print-exercise-block {
          break-inside: avoid;
          page-break-inside: avoid;
          padding-bottom: 4mm;
          border-bottom: 1px solid #ddd;
        }

        .print-column .print-exercise-block:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .print-exercise-name {
          font-size: 11pt;
          font-weight: 700;
          margin: 0 0 3mm;
          line-height: 1.2;
          color: #000;
        }

        .print-exercise-body {
          display: flex;
          align-items: flex-start;
          gap: 4mm;
        }

        .print-exercise-image {
          flex-shrink: 0;
          width: 26mm;
        }

        .print-exercise-image-inner {
          width: 26mm !important;
          height: 26mm !important;
          aspect-ratio: 1 / 1;
        }

        .print-exercise-table {
          flex: 1;
          min-width: 0;
        }

        .player-avatar-print {
          height: 22mm !important;
          width: 22mm !important;
          font-size: 11pt !important;
        }

        .strength-set-table-print {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
          line-height: 1.35;
        }

        .strength-set-table-print th,
        .strength-set-table-print td {
          text-align: left;
          padding: 1.5px 6px 1.5px 0;
          color: #111;
          vertical-align: top;
        }

        .strength-set-table-print th {
          font-weight: 700;
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #333;
          border-bottom: 1.5px solid #999;
          padding-bottom: 3px;
        }

        .strength-set-table-print td:nth-child(2) {
          font-weight: 700;
        }

        @media print {
          html,
          body {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Reset app shell padding / width constraints from dashboard layout */
          main,
          main *:not(.print-cards-root):not(.print-cards-root *) {
            max-width: none !important;
          }

          main > div,
          main > div > div {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            width: auto !important;
            min-height: 0 !important;
            background: #fff !important;
          }

          body * {
            visibility: hidden;
          }

          .print-cards-root,
          .print-cards-root * {
            visibility: visible;
          }

          .print-cards-root {
            position: fixed;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 0;
            background: #fff;
            box-shadow: none;
          }

          .strength-print-shell {
            padding: 0;
            background: #fff;
          }

          .print-page {
            width: 190mm;
            min-height: 277mm;
            max-height: 277mm;
            margin: 0 auto;
            padding: 0;
            page-break-after: always;
            break-after: page;
            box-shadow: none;
            overflow: hidden;
          }

          .print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {cards.map((card) => (
        <PrintPlayerPage key={card.id} card={card} />
      ))}
    </div>
  );
}
