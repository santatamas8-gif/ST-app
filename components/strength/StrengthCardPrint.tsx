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

const BRAND_RED = "#c41230";

function PrintExerciseBlock({
  order,
  name,
  imageUrl,
  sets,
  repsOnlyPullUp,
}: {
  order: number;
  name: string;
  imageUrl: string | null;
  repsOnlyPullUp: boolean;
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
      <div className="print-exercise-heading">
        <span className="print-exercise-badge">{String(order).padStart(2, "0")}</span>
        <h2 className="print-exercise-name">{name}</h2>
      </div>
      <div className="print-exercise-rule" aria-hidden />
      <div className="print-exercise-content">
        <div className="print-exercise-image-row">
          <ExerciseImage
            src={imageUrl}
            alt={name}
            variant="print"
            className="print-exercise-image-inner"
          />
        </div>
        <div className="print-exercise-divider" aria-hidden />
        <div className="print-exercise-table">
          <StrengthSetTable sets={sets} variant="print" repsOnlyPullUp={repsOnlyPullUp} />
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
      <div className="print-page-corner print-page-corner--left" aria-hidden />
      <div className="print-page-corner print-page-corner--right" aria-hidden />

      <div className="print-page-body">
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
              order={g.exerciseOrder}
              name={g.name}
              imageUrl={g.imageUrl}
              repsOnlyPullUp={g.repsOnlyPullUp}
              sets={g.sets}
            />
          ))}
        </div>

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
          font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
        }

        .print-page {
          position: relative;
          width: 194mm;
          height: 281mm;
          min-height: 281mm;
          max-height: 281mm;
          margin: 0 auto 24px;
          padding: 5mm 4mm 4mm;
          box-sizing: border-box;
          background: #fff;
          color: #111;
          box-shadow: 0 2px 16px rgba(0, 0, 0, 0.12);
          page-break-inside: avoid;
          break-inside: avoid-page;
          overflow: hidden;
        }

        .print-page:last-child {
          margin-bottom: 0;
        }

        .print-page-corner {
          position: absolute;
          top: 0;
          width: 36mm;
          height: 36mm;
          pointer-events: none;
          opacity: 0.35;
          background: repeating-linear-gradient(
            -45deg,
            #d9d9d9,
            #d9d9d9 1.5px,
            transparent 1.5px,
            transparent 7px
          );
        }

        .print-page-corner--left {
          left: 0;
        }

        .print-page-corner--right {
          right: 0;
          transform: scaleX(-1);
        }

        .print-page-body {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
        }

        .print-card-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: start;
          gap: 3mm;
          margin-bottom: 3mm;
          padding-bottom: 0;
          border-bottom: none;
          flex-shrink: 0;
        }

        .print-team-logo-wrap {
          display: flex;
          justify-content: flex-start;
          align-items: flex-start;
          padding-top: 1mm;
        }

        .print-team-logo {
          height: 18mm;
          width: auto;
          max-width: 52mm;
          object-fit: contain;
          object-position: left top;
        }

        .print-card-header-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 2.5mm;
        }

        .print-card-header-spacer {
          min-width: 0;
        }

        .print-player-name {
          font-size: 22pt;
          font-weight: 700;
          margin: 0;
          line-height: 1.1;
          color: #000;
          letter-spacing: -0.01em;
        }

        .print-date {
          font-size: 11pt;
          margin: 0;
          color: #333;
          font-weight: 500;
        }

        .print-exercise-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: repeat(4, 1fr);
          grid-auto-flow: column;
          align-items: stretch;
          gap: 3mm;
          flex: 1;
          width: 100%;
          min-height: 0;
        }

        .print-exercise-block {
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          break-inside: avoid;
          page-break-inside: avoid;
          min-width: 0;
          min-height: 0;
          padding: 2.5mm;
          border: 1px solid #e2e2e2;
          border-radius: 2mm;
          background: #fff;
        }

        .print-exercise-heading {
          display: flex;
          align-items: center;
          gap: 2mm;
          min-width: 0;
        }

        .print-exercise-badge {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 7mm;
          height: 7mm;
          padding: 0 1.5mm;
          background: ${BRAND_RED};
          color: #fff;
          font-size: 8pt;
          font-weight: 800;
          line-height: 1;
        }

        .print-exercise-name {
          font-size: 7pt;
          font-weight: 800;
          margin: 0;
          line-height: 1.12;
          color: #000;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          white-space: normal;
          word-break: break-word;
          min-width: 0;
          flex: 1;
        }

        .print-exercise-rule {
          height: 2px;
          background: ${BRAND_RED};
          margin: 1.5mm 0 2mm;
          flex-shrink: 0;
        }

        .print-exercise-content {
          display: grid;
          grid-template-columns: 48% 1px 1fr;
          align-items: stretch;
          flex: 1;
          min-height: 0;
        }

        .print-exercise-image-row {
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 2.5mm 0 0;
        }

        .print-exercise-divider {
          width: 1px;
          background: #d0d0d0;
          align-self: stretch;
          justify-self: center;
        }

        .print-exercise-image-inner {
          position: relative;
          width: 100% !important;
          height: 100% !important;
          min-height: 34mm !important;
          padding: 0 !important;
          box-sizing: border-box;
          border: none !important;
          border-radius: 0 !important;
          background: transparent !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .print-exercise-image-inner img {
          display: block;
          width: 100% !important;
          height: 100% !important;
          max-height: 36mm !important;
          object-fit: contain !important;
          object-position: center !important;
        }

        .print-exercise-table {
          min-width: 0;
          min-height: 34mm;
          height: 100%;
          padding: 1mm 0 1mm 10px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }

        .print-exercise-table .strength-set-table-print {
          align-self: center;
          width: 100%;
        }

        .player-avatar-print:not(.player-avatar-print--rect) {
          height: 30mm !important;
          width: 30mm !important;
          font-size: 12pt !important;
          border: 2px solid #ececec !important;
          border-radius: 50% !important;
          background: #fafafa !important;
        }

        .player-avatar-print:not(.player-avatar-print--rect) img {
          object-fit: cover !important;
          object-position: 50% 14% !important;
          border-radius: 50% !important;
        }

        .strength-set-table-print {
          width: 100%;
          max-width: 100%;
          border-collapse: separate;
          border-spacing: 0 2.2mm;
          font-size: 7.5pt;
          line-height: 1.45;
          table-layout: fixed;
        }

        .strength-set-table-print th,
        .strength-set-table-print td {
          text-align: center;
          padding: 1.8mm 2px;
          color: #111;
          vertical-align: middle;
          border-bottom: 1.5px solid ${BRAND_RED};
          font-weight: 700;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .strength-set-table-print td {
          white-space: nowrap;
        }

        .strength-set-table-print th {
          font-size: 6.5pt;
          text-transform: uppercase;
          letter-spacing: 0;
          color: #222;
          border-bottom: 2px solid ${BRAND_RED};
          padding-top: 1.5mm;
          padding-bottom: 2.8mm;
          background: #f0f0f0;
          white-space: normal;
          line-height: 1.25;
          word-break: break-word;
        }

        .strength-set-table-print tbody tr td {
          padding-top: 2.2mm;
          padding-bottom: 2.2mm;
        }

        .strength-set-table-print tbody tr:last-child td {
          border-bottom: none;
        }

        .strength-set-table-print th.print-col-pct,
        .strength-set-table-print .print-col-pct {
          width: 24%;
        }

        .strength-set-table-print th.print-col-weight,
        .strength-set-table-print .print-col-weight {
          width: 44%;
        }

        .strength-set-table-print th.print-col-reps,
        .strength-set-table-print .print-col-reps {
          width: 32%;
        }

        .strength-set-table-print--reps-only .print-col-weight {
          width: 62%;
        }

        .strength-set-table-print--reps-only .print-col-reps {
          width: 38%;
        }

        .print-card-footer {
          flex-shrink: 0;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 4mm;
          margin-top: 3mm;
          padding-top: 3mm;
          border-top: 1px solid #e0e0e0;
        }

        .print-footer-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          min-width: 0;
        }

        .print-footer-col--notes {
          border-left: 1px solid #e8e8e8;
          border-right: 1px solid #e8e8e8;
          padding: 0 3mm;
        }

        .print-footer-col--coach {
          justify-content: flex-end;
        }

        .print-footer-icon {
          width: 9mm;
          height: 9mm;
          margin-bottom: 1mm;
        }

        .print-footer-svg {
          width: 100%;
          height: 100%;
        }

        .print-footer-label {
          margin: 0 0 1.5mm;
          font-size: 8pt;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #111;
        }

        .print-footer-label--coach {
          margin-top: 10mm;
        }

        .print-footer-text {
          margin: 0;
          font-size: 7.5pt;
          font-weight: 600;
          color: #333;
          line-height: 1.3;
        }

        .print-footer-dots {
          width: 100%;
          max-width: 42mm;
          height: 4mm;
          margin-top: 1.5mm;
          border-bottom: 1.5px dotted #bdbdbd;
        }

        .print-footer-dots--wide {
          max-width: 50mm;
          margin-top: 3mm;
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
            padding: 5mm 4mm 4mm;
            page-break-before: always;
            break-before: page;
            page-break-after: always;
            break-after: page;
            box-shadow: none;
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
