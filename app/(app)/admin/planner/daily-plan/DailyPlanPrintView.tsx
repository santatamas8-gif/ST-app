"use client";

import Link from "next/link";
import type {
  DailyPlanPctSummary,
  DailyPlanPrintResult,
  DailyPlanSharedPct,
  DailyPlanTeamAverage,
} from "@/lib/gpsPlanner/types";
import { formatPlannerDisplayAbsolute } from "@/lib/gpsPlanner/uiDisplay";

/** Soft burgundy accent — quieter than bright ego red. */
const PRINT_BURGUNDY = "#4a1820";

function metricCell(value: number | null, hasDailyTarget: boolean): string {
  if (!hasDailyTarget || value == null) return "—";
  return formatPlannerDisplayAbsolute(value).toLocaleString("en-US");
}

function formatSharedPct(value: DailyPlanSharedPct): string {
  if (value == null) return "—";
  if (value === "Mixed") return "Mixed";
  return `${value}%`;
}

function formatAverage(value: number | null): string {
  if (value == null) return "—";
  return formatPlannerDisplayAbsolute(value).toLocaleString("en-US");
}

/** Display-only: "4" / "W4" → "Week 4". */
function formatWeekMeta(powerBiWeekId: string): string {
  const n = powerBiWeekId.trim().replace(/^W/i, "");
  return `Week ${n}`;
}

/** Display-only: compact MD label (e.g. "MD-5"). */
function formatMatchdayMeta(mdTag: string): string {
  const t = mdTag.trim();
  if (/^MD/i.test(t)) return `MD${t.slice(2)}`;
  return `MD${t}`;
}

/** Display-only calendar date. */
function formatPlanDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return isoDate;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

const PCT_ROWS: {
  key: keyof DailyPlanPctSummary;
  label: string;
}[] = [
  { key: "td", label: "TD" },
  { key: "hsr", label: "HSR" },
  { key: "sprint", label: "Sprint" },
  { key: "acc", label: "Acc" },
  { key: "dec", label: "Dec" },
];

const AVG_ROWS: {
  key: keyof DailyPlanTeamAverage;
  label: string;
}[] = [
  { key: "totalDistance", label: "Total Distance" },
  { key: "hsr", label: "HSR Distance" },
  { key: "sprint", label: "Sprint Distance" },
  { key: "accelerations", label: "Accelerations" },
  { key: "decelerations", label: "Decelerations" },
];

export function DailyPlanPrintView({
  data,
  logoUrl,
}: {
  data: DailyPlanPrintResult;
  logoUrl: string | null;
}) {
  const logoSrc = (logoUrl ?? "").trim() || "/icon.svg";

  return (
    <>
      <div className="daily-plan-print-toolbar no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/planner"
            className="text-sm text-zinc-600 hover:text-zinc-900"
          >
            ← Back to planner
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[44px] items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Print
          </button>
        </div>
      </div>

      <div className="daily-plan-print-root">
        <header className="daily-plan-print-header">
          <div className="daily-plan-print-header-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              alt="ST-AMS"
              className="daily-plan-print-logo"
            />
          </div>
          <div className="daily-plan-print-header-center">
            <h1 className="daily-plan-print-title">Daily Plan</h1>
            <p className="daily-plan-print-meta">
              {formatWeekMeta(data.powerBiWeekId)} ·{" "}
              {formatMatchdayMeta(data.mdTag)} · {formatPlanDate(data.date)}
            </p>
          </div>
        </header>

        {/* Player table LEFT; 3 summary boxes RIGHT (Weekly%|Daily% pair, Team Average under). */}
        <div
          className="daily-plan-print-body"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(240px, 32%)",
            gap: "10px",
            alignItems: "start",
            width: "100%",
          }}
        >
          <div className="daily-plan-print-table-wrap" style={{ minWidth: 0 }}>
            <table className="daily-plan-print-table">
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">TD</th>
                  <th scope="col">HSR</th>
                  <th scope="col">Sprint</th>
                  <th scope="col">Acc</th>
                  <th scope="col">Dec</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((row) => (
                  <tr key={row.playerId}>
                    <td className="daily-plan-print-player">
                      {row.playerDisplayName}
                    </td>
                    <td>{metricCell(row.totalDistance, row.hasDailyTarget)}</td>
                    <td>{metricCell(row.hsr, row.hasDailyTarget)}</td>
                    <td>{metricCell(row.sprint, row.hasDailyTarget)}</td>
                    <td>
                      {metricCell(row.accelerations, row.hasDailyTarget)}
                    </td>
                    <td>
                      {metricCell(row.decelerations, row.hasDailyTarget)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside
            className="daily-plan-print-aside"
            aria-label="Plan summaries"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              minWidth: 0,
            }}
          >
            <div
              className="daily-plan-print-pct-pair"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                alignItems: "stretch",
                width: "100%",
              }}
            >
              <section className="daily-plan-print-summary">
                <h2 className="daily-plan-print-summary-title">Weekly %</h2>
                <dl className="daily-plan-print-pct-list">
                  {PCT_ROWS.map((row) => (
                    <div key={`w-${row.key}`} className="daily-plan-print-pct-row">
                      <dt>{row.label}</dt>
                      <dd>{formatSharedPct(data.weeklyPct[row.key])}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="daily-plan-print-summary">
                <h2 className="daily-plan-print-summary-title">Daily %</h2>
                <dl className="daily-plan-print-pct-list">
                  {PCT_ROWS.map((row) => (
                    <div key={`d-${row.key}`} className="daily-plan-print-pct-row">
                      <dt>{row.label}</dt>
                      <dd>{formatSharedPct(data.dailyPct[row.key])}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>

            <section className="daily-plan-print-avg">
              <h2 className="daily-plan-print-avg-title">Daily Team Average</h2>
              <div className="daily-plan-print-avg-list">
                {AVG_ROWS.map((row) => (
                  <div key={row.key} className="daily-plan-print-avg-card">
                    <span className="daily-plan-print-avg-label">
                      {row.label}
                    </span>
                    <span className="daily-plan-print-avg-value">
                      {formatAverage(data.teamAverage[row.key])}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
        <p className="daily-plan-print-attribution">
          <em className="daily-plan-print-attribution-brand">
            Power BI calculations
          </em>{" "}
          <em className="daily-plan-print-attribution-by">by Santa Tamas</em>
        </p>
      </div>

      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 8mm;
        }

        .daily-plan-print-toolbar {
          width: 297mm;
          max-width: calc(100vw - 24px);
          margin: 0 auto 12px;
          padding: 16px 8px 0;
        }

        .daily-plan-print-shell {
          background: #e4e4e7;
          min-height: 100%;
        }

        .daily-plan-print-root {
          position: relative;
          width: 297mm;
          max-width: calc(100vw - 24px);
          margin: 0 auto 32px;
          padding: 10px 14px 12px;
          background: #fff;
          color: #111;
          font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        }

        .daily-plan-print-header {
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid #ececf0;
          min-height: 44px;
        }

        .daily-plan-print-header-left {
          position: absolute;
          left: 0;
          top: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          max-width: 88px;
        }

        .daily-plan-print-logo {
          height: 24px;
          width: auto;
          max-width: 64px;
          object-fit: contain;
        }

        .daily-plan-print-header-center {
          text-align: center;
          padding: 0 72px;
        }

        .daily-plan-print-title {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: ${PRINT_BURGUNDY};
        }

        .daily-plan-print-meta {
          margin: 2px 0 0;
          font-size: 10px;
          color: #52525b;
          font-weight: 500;
        }

        .daily-plan-print-attribution {
          margin: 8px 0 0;
          text-align: right;
          font-size: 8px;
          font-style: italic;
          font-weight: 400;
          font-family: Georgia, "Times New Roman", Times, serif;
          white-space: nowrap;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .daily-plan-print-attribution em,
        .daily-plan-print-attribution-brand,
        .daily-plan-print-attribution-by {
          font-style: italic;
          font-weight: 400;
          font-family: Georgia, "Times New Roman", Times, serif;
        }

        .daily-plan-print-attribution-brand {
          color: ${PRINT_BURGUNDY};
        }

        .daily-plan-print-attribution-by {
          color: #71717a;
        }

        .daily-plan-print-body {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(240px, 32%) !important;
          gap: 10px !important;
          align-items: start !important;
          width: 100% !important;
        }

        .daily-plan-print-pct-pair {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          align-items: stretch;
        }

        .daily-plan-print-table-wrap {
          width: 100%;
          overflow-x: auto;
          min-width: 0;
        }

        .daily-plan-print-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
        }

        .daily-plan-print-table thead {
          display: table-header-group;
        }

        .daily-plan-print-table tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .daily-plan-print-table th,
        .daily-plan-print-table td {
          border: 1px solid #ececf0;
          padding: 2px 5px;
          text-align: left;
          vertical-align: middle;
        }

        .daily-plan-print-table th {
          background: ${PRINT_BURGUNDY};
          color: #fff;
          font-weight: 600;
          font-size: 9px;
          white-space: nowrap;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .daily-plan-print-table th:not(:first-child),
        .daily-plan-print-table td:not(:first-child) {
          text-align: center;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .daily-plan-print-table td:not(:first-child) {
          font-weight: 550;
          color: #27272a;
        }

        .daily-plan-print-player {
          font-weight: 600;
          font-size: 9px;
          color: #27272a;
        }

        .daily-plan-print-aside {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }

        .daily-plan-print-summary {
          border: 1px solid #ececf0;
          background: #fff;
          padding: 5px 6px 4px;
          min-width: 0;
          opacity: 0.92;
        }

        .daily-plan-print-summary-title {
          margin: 0 0 4px;
          font-size: 9px;
          font-weight: 650;
          color: #5c3038;
          letter-spacing: 0.02em;
        }

        .daily-plan-print-pct-list {
          margin: 0;
        }

        .daily-plan-print-pct-row {
          display: flex;
          justify-content: space-between;
          gap: 4px;
          padding: 1px 0;
          border-bottom: 1px solid #f4f4f5;
          font-size: 8.5px;
        }

        .daily-plan-print-pct-row:last-child {
          border-bottom: none;
        }

        .daily-plan-print-pct-row dt {
          margin: 0;
          color: #71717a;
          font-weight: 500;
        }

        .daily-plan-print-pct-row dd {
          margin: 0;
          color: #3f3f46;
          font-weight: 650;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .daily-plan-print-avg {
          border: 1px solid #ececf0;
          background: #fff;
          padding: 5px 6px 6px;
        }

        .daily-plan-print-avg-title {
          margin: 0 0 4px;
          font-size: 9px;
          font-weight: 700;
          color: ${PRINT_BURGUNDY};
          letter-spacing: 0.02em;
        }

        .daily-plan-print-avg-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .daily-plan-print-avg-card {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 6px;
          border: 1px solid #f0f0f3;
          padding: 3px 5px;
          background: #fafafa;
        }

        .daily-plan-print-avg-label {
          font-size: 8px;
          color: #71717a;
          font-weight: 500;
        }

        .daily-plan-print-avg-value {
          font-size: 10px;
          font-weight: 700;
          color: #27272a;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        /* Screen preview must match print sheet layout (same component, same CSS). */
        .daily-plan-print-title,
        .daily-plan-print-avg-title {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .daily-plan-print-table th {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }

          body * {
            visibility: hidden;
          }

          .daily-plan-print-root,
          .daily-plan-print-root * {
            visibility: visible;
          }

          .no-print {
            display: none !important;
            visibility: hidden !important;
          }

          main,
          main > div,
          main > div > div {
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            background: #fff !important;
          }

          .daily-plan-print-shell {
            padding: 0;
            background: #fff;
            min-height: 0;
          }

          .daily-plan-print-root {
            position: relative;
            width: 100%;
            min-height: 0 !important;
            height: auto !important;
            max-width: none;
            margin: 0;
            padding: 0;
            box-shadow: none;
          }

          .daily-plan-print-body {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(240px, 32%) !important;
            gap: 8px !important;
            align-items: start !important;
          }

          .daily-plan-print-pct-pair {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 6px !important;
          }

          .daily-plan-print-attribution {
            position: fixed !important;
            right: 8mm !important;
            bottom: 6mm !important;
            top: auto !important;
            left: auto !important;
            margin: 0 !important;
            z-index: 2;
          }

          .daily-plan-print-attribution-brand {
            color: ${PRINT_BURGUNDY} !important;
            font-style: italic !important;
          }

          .daily-plan-print-attribution-by {
            color: #71717a !important;
            font-style: italic !important;
          }

          .daily-plan-print-table-wrap {
            overflow: visible;
          }

          .daily-plan-print-table th,
          .daily-plan-print-table td {
            border-color: #ececf0 !important;
          }

          .daily-plan-print-table th {
            background: ${PRINT_BURGUNDY} !important;
            color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .daily-plan-print-title,
          .daily-plan-print-avg-title {
            color: ${PRINT_BURGUNDY} !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .daily-plan-print-summary-title {
            color: #5c3038 !important;
          }
        }
      `}</style>
    </>
  );
}
