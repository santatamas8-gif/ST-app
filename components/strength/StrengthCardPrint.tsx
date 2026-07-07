"use client";

import type { PlayerStrengthCard } from "@/lib/strength/types";
import { groupCardItemsByExercise } from "@/lib/strength/cardLayout";
import { ExerciseImage } from "./ExerciseImage";
import { StrengthCardHeader } from "./StrengthCardHeader";
import { StrengthSetTable } from "./StrengthSetTable";

interface StrengthCardPrintProps {
  cards: PlayerStrengthCard[];
  teamLogoUrl?: string | null;
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

function PrintPlayerPage({
  card,
  teamLogoUrl,
}: {
  card: PlayerStrengthCard;
  teamLogoUrl?: string | null;
}) {
  const groups = groupCardItemsByExercise(card.items, 8, card.exerciseImages);
  const sessionLine = card.session.session_type
    ? `${card.session.title} · ${card.session.session_type}`
    : card.session.title;

  return (
    <section className="print-page" aria-label={`Strength card for ${card.player_name}`}>
      <StrengthCardHeader
        playerName={card.player_name}
        playerAvatarUrl={card.player_avatar_url}
        teamLogoUrl={teamLogoUrl}
        date={card.session.date}
        sessionLine={sessionLine}
        variant="print"
      />

      <div className="print-exercise-grid">
        {groups.map((g) => (
          <PrintExerciseBlock
            key={g.key}
            name={g.name}
            imageUrl={g.imageUrl}
            sets={g.sets}
          />
        ))}
      </div>
    </section>
  );
}

export function StrengthCardPrint({ cards, teamLogoUrl }: StrengthCardPrintProps) {
  return (
    <div className="print-cards-root">
      <style jsx global>{`
        @page {
          size: A4;
          margin: 8mm;
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
          width: 194mm;
          height: 281mm;
          min-height: 281mm;
          max-height: 281mm;
          margin: 0 auto 24px;
          padding: 6mm 0 2mm;
          box-sizing: border-box;
          background: #fff;
          color: #111;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.12);
          page-break-inside: avoid;
          break-inside: avoid-page;
        }

        .print-page:last-child {
          margin-bottom: 0;
        }

        .print-card-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: end;
          gap: 4mm;
          margin-bottom: 4mm;
          padding-bottom: 4mm;
          border-bottom: 1.5px solid #ccc;
          flex-shrink: 0;
        }

        .print-team-logo-wrap {
          display: flex;
          justify-content: flex-start;
          align-items: flex-end;
          align-self: end;
        }

        .print-team-logo {
          height: 20mm;
          width: auto;
          max-width: 58mm;
          object-fit: contain;
          object-position: left bottom;
        }

        .print-card-header-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 3mm;
        }

        .print-card-header-spacer {
          min-width: 0;
        }

        .print-header-text {
          min-width: 0;
        }

        .print-player-name {
          font-size: 20pt;
          font-weight: 700;
          margin: 0 0 1.5mm;
          line-height: 1.15;
          color: #000;
        }

        .print-date {
          font-size: 11pt;
          margin: 0;
          color: #222;
        }

        .print-exercise-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(4, auto);
          grid-auto-flow: column;
          align-items: start;
          gap: 4mm;
          flex: 1;
          width: 100%;
          margin-top: 3mm;
        }

        .print-exercise-block {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          break-inside: avoid;
          page-break-inside: avoid;
          padding-bottom: 3mm;
          border-bottom: 1px solid #ddd;
          min-width: 0;
        }

        .print-exercise-grid .print-exercise-block:nth-child(4),
        .print-exercise-grid .print-exercise-block:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .print-exercise-name {
          font-size: 9pt;
          font-weight: 700;
          margin: 0 0 1.2mm;
          line-height: 1.15;
          color: #000;
        }

        .print-exercise-body {
          display: flex;
          align-items: flex-start;
          gap: 2mm;
          flex: 1;
          min-width: 0;
        }

        .print-exercise-image {
          flex-shrink: 0;
          width: 48mm;
        }

        .print-exercise-image-inner {
          width: 48mm !important;
          height: 32mm !important;
          aspect-ratio: 3 / 2;
        }

        .print-exercise-table {
          flex: 1;
          min-width: 0;
        }

        .player-avatar-print {
          height: 26mm !important;
          width: 26mm !important;
          font-size: 12pt !important;
          border: none !important;
          background: transparent !important;
        }

        .player-avatar-print img {
          border-radius: 50%;
        }

        .strength-set-table-print {
          width: 100%;
          max-width: 100%;
          border-collapse: collapse;
          font-size: 8.5pt;
          line-height: 1.15;
          table-layout: fixed;
        }

        .strength-set-table-print th,
        .strength-set-table-print td {
          text-align: left;
          padding: 1px 2px;
          color: #111;
          vertical-align: middle;
          white-space: nowrap;
          border-bottom: 1px solid #d4d4d4;
        }

        .strength-set-table-print th:not(:last-child),
        .strength-set-table-print td:not(:last-child) {
          border-right: 1px solid #e8e8e8;
        }

        .strength-set-table-print th {
          font-weight: 700;
          font-size: 7pt;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          color: #333;
          border-bottom: 1.5px solid #888;
          padding-bottom: 1.5px;
          background: #f5f5f5;
        }

        .strength-set-table-print tbody tr:last-child td {
          border-bottom: none;
        }

        .strength-set-table-print .print-col-pct {
          width: 28%;
        }

        .strength-set-table-print .print-col-weight {
          font-weight: 700;
          width: 48%;
        }

        .strength-set-table-print .print-col-reps {
          width: 24%;
          text-align: center;
        }

        .strength-set-table-print th:last-child {
          text-align: center;
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
            width: 100% !important;
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
            position: static;
            width: 100%;
            min-height: auto;
            margin: 0 auto;
            padding: 0;
            background: #fff;
            box-shadow: none;
          }

          .strength-print-shell {
            padding: 0;
            background: #fff;
          }

          .print-page {
            width: 194mm;
            height: 281mm;
            min-height: 281mm;
            max-height: 281mm;
            margin: 0 auto;
            padding: 0;
            page-break-before: always;
            break-before: page;
            page-break-after: always;
            break-after: page;
            box-shadow: none;
            overflow: hidden;
          }

          .print-page:first-child {
            page-break-before: auto;
            break-before: auto;
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
        <PrintPlayerPage key={card.id} card={card} teamLogoUrl={teamLogoUrl} />
      ))}
    </div>
  );
}
