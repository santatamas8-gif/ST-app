"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import type { DailyPlanPrintResult } from "@/lib/gpsPlanner/types";
import { formatPlannerDisplayAbsolute } from "@/lib/gpsPlanner/uiDisplay";

function metricCell(value: number | null, hasDailyTarget: boolean): string {
  if (!hasDailyTarget || value == null) return "—";
  return String(formatPlannerDisplayAbsolute(value));
}

export function DailyPlanPrintView({ data }: { data: DailyPlanPrintResult }) {
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
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <Printer className="h-4 w-4" aria-hidden />
            Print
          </button>
        </div>
      </div>

      <div className="daily-plan-print-root">
        <header className="daily-plan-print-header">
          <h1 className="daily-plan-print-title">Daily Plan</h1>
          <p className="daily-plan-print-meta">
            {data.powerBiWeekId} · {data.mdTag} · {data.date}
          </p>
        </header>

        <div className="daily-plan-print-table-wrap">
          <table className="daily-plan-print-table">
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">TD (m)</th>
                <th scope="col">HSR (m)</th>
                <th scope="col">Sprint (m)</th>
                <th scope="col">Acc (count)</th>
                <th scope="col">Dec (count)</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((row) => (
                <tr key={row.playerId}>
                  <td className="daily-plan-print-player">
                    {row.playerDisplayName}
                    {!row.hasDailyTarget ? (
                      <span className="daily-plan-print-missing">
                        {" "}
                        · No Daily Target
                      </span>
                    ) : null}
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
      </div>

      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        .daily-plan-print-toolbar {
          width: 210mm;
          max-width: calc(100vw - 32px);
          margin: 0 auto 16px;
          padding: 16px 8px 0;
        }

        .daily-plan-print-root {
          width: 210mm;
          max-width: calc(100vw - 32px);
          margin: 0 auto 32px;
          padding: 16px 20px 24px;
          background: #fff;
          color: #111;
          font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
          box-sizing: border-box;
        }

        .daily-plan-print-header {
          margin-bottom: 16px;
          border-bottom: 1px solid #d4d4d8;
          padding-bottom: 10px;
        }

        .daily-plan-print-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .daily-plan-print-meta {
          margin: 4px 0 0;
          font-size: 13px;
          color: #3f3f46;
        }

        .daily-plan-print-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .daily-plan-print-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .daily-plan-print-table th,
        .daily-plan-print-table td {
          border: 1px solid #d4d4d8;
          padding: 8px 10px;
          text-align: left;
          vertical-align: middle;
        }

        .daily-plan-print-table th {
          background: #f4f4f5;
          font-weight: 600;
          white-space: nowrap;
        }

        .daily-plan-print-table td:not(:first-child) {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .daily-plan-print-player {
          font-weight: 600;
        }

        .daily-plan-print-missing {
          font-weight: 500;
          color: #71717a;
          font-size: 11px;
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
          }

          .daily-plan-print-root {
            position: static;
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 0;
            box-shadow: none;
          }

          .daily-plan-print-table-wrap {
            overflow: visible;
          }
        }
      `}</style>
    </>
  );
}
