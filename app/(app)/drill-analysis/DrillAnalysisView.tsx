"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DrillCompare } from "@/app/(app)/drill-analysis/DrillCompare";
import { DrillHistory } from "@/app/(app)/drill-analysis/DrillHistory";
import { ManageDrills } from "@/app/(app)/drill-analysis/ManageDrills";
import { formatDrillMetric, formatDrillNumber, formatDurationMinutes, formatSessionDate, reportHeadings } from "@/lib/drillAnalysis/format";
import { comparePrintMarks } from "@/lib/drillAnalysis/printMarks";
import { DRILL_METRICS } from "@/lib/drillAnalysis/types";
import type { DrillAnalysisPageData, DrillColumn, DrillMetricKey } from "@/lib/drillAnalysis/types";
import type { DrillViewCard } from "@/lib/drillAnalysis/types";

const PRINT_METRIC_LABEL: Record<DrillMetricKey, string> = {
  totalDistance: "TD",
  tempoDistance: "Tempo",
  hsr: "HSR",
  sprintDistance: "Sprint",
  distancePerMin: "m/min",
  accelerations: "Acc",
  decelerations: "Dec",
};

function PrintMetricName({ metric }: { metric: (typeof DRILL_METRICS)[number] }) {
  const unit = metric.unit === "m" && metric.key !== "distancePerMin" ? "(m)" : "";
  return (
    <span className="da-metric">
      <span className="da-metric-name">{PRINT_METRIC_LABEL[metric.key]}</span>
      {unit ? <span className="da-unit">{unit}</span> : null}
    </span>
  );
}

function fullTrainingFigure(value: number | null, metric: (typeof DRILL_METRICS)[number]): string {
  const number = formatDrillNumber(value);
  if (number === "—" || metric.unit !== "m" || metric.key === "distancePerMin") return number;
  return `${number} m`;
}

function pageHref(date: string | null, sessionKey: string | null, player: string | null): string {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (sessionKey) params.set("session", sessionKey);
  if (player) params.set("player", player);
  const query = params.toString();
  return query ? `/drill-analysis?${query}` : "/drill-analysis";
}

function printSeriesHeading(index: number, count: number): string {
  return count <= 1 ? "Value" : `SET ${index + 1}`;
}

function DurationMark({ column }: { column?: DrillColumn }) {
  if (!column || column.missing || column.durationMinutes === null) return null;
  return <span className="da-duration">{formatDurationMinutes(column.durationMinutes)}</span>;
}

function DrillTable({ card, columnLabels }: { card: DrillViewCard; columnLabels?: string[] }) {
  const labels = columnLabels ?? card.columns.map((column) => column.label);
  const showNames = labels.some((label) => label.trim().length > 0);
  const separateSets = card.columns.length > 1;
  return (
    <div className="da-table-scroll min-w-0 overflow-x-auto">
      <table className={`w-full border-collapse text-left text-[15px] ${separateSets ? "min-w-max da-split-sets" : ""}`}>
        <thead>
          {separateSets ? (
            <tr className="da-print-head da-duration-head">
              <th className="da-col-head da-metric-head" />
              {card.columns.map((column) => (
                <th key={`duration-${column.occurrenceKey}`} className="da-col-head da-value-head">
                  <DurationMark column={column} />
                </th>
              ))}
            </tr>
          ) : null}
          <tr className="da-print-head">
            <th className="da-col-head da-metric-head">Metric</th>
            {card.columns.map((column, index) => (
              <th
                key={`print-${column.occurrenceKey}`}
                className={`da-col-head da-value-head${card.columns.length === 1 ? " da-value-edge" : ""}`}
              >
                {printSeriesHeading(index, card.columns.length)}
              </th>
            ))}
          </tr>
          {showNames ? (
            <tr className="da-screen-only bg-[#f4f7f8] text-sm text-[#11243B]">
              <th className="border-b border-[#e7e5e4] px-2 py-1.5 text-left font-semibold">Metric</th>
              {card.columns.map((column, index) => (
                <th key={column.occurrenceKey} className="da-value-head border-b border-l border-[#e7e5e4] px-2 py-1.5 text-right font-semibold">
                  <div>
                    {labels[index]}
                    {separateSets ? <DurationMark column={column} /> : null}
                  </div>
                </th>
              ))}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {DRILL_METRICS.map((metric) => (
            <tr key={metric.key} className="odd:bg-white even:bg-[#f7f7f8]">
              <th className="border-b border-[#e7e5e4] px-2 py-1.5 text-left text-[15px] font-medium text-zinc-800">
                <span className="da-screen-only">{metric.label}</span>
                <span className="da-print-only"><PrintMetricName metric={metric} /></span>
              </th>
              {card.columns.map((column, index) => (
                <td key={column.occurrenceKey} className={`da-num border-b border-[#e7e5e4] px-2 py-1.5 text-right text-[15px] font-bold tabular-nums text-zinc-900 ${index > 0 ? "border-l" : ""}`}>
                  <span className="da-screen-only">{formatDrillMetric(column.metrics[metric.key], metric.unit)}</span>
                  <span className="da-print-only">{formatDrillNumber(column.metrics[metric.key])}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardImage({
  card,
  sessionKey,
  onZoom,
  onImageState,
}: {
  card: DrillViewCard;
  sessionKey: string;
  onZoom: (src: string, alt: string) => void;
  onImageState: (id: string, state: "loading" | "ready" | "error") => void;
}) {
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const router = useRouter();

  async function upload(file: File) {
    setUploadMessage(null);
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    if (card.persisted) {
      body.set("cardId", card.id);
    } else {
      body.set("sessionKey", sessionKey);
      body.set("occurrenceKey", card.columns.find((column) => !column.missing)?.occurrenceKey ?? "");
    }
    const response = await fetch("/api/drill-analysis/upload", { method: "POST", body });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setUploading(false);
    if (!response.ok) {
      setUploadMessage(payload?.error ?? "Image upload failed.");
      return;
    }
    setUploadMessage("Image saved.");
    router.refresh();
  }

  if (!card.hasImage) {
    return (
      <div className="space-y-2">
        <label className="da-screen-only flex h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-center text-sm text-zinc-600 lg:h-[190px]">
          <span>{uploading ? "Uploading…" : "Upload image"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </label>
        <p className="da-print-only da-missing-image">No image</p>
        {uploadMessage ? <p className="da-screen-only text-sm text-zinc-700">{uploadMessage}</p> : null}
      </div>
    );
  }

  const src = `/api/drill-analysis/image?cardId=${card.id}`;
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        className="flex h-36 w-full items-center justify-center bg-[#f4f6f8] lg:h-[190px]"
        onClick={() => {
          if (!failed) onZoom(src, card.displayName);
        }}
      >
        {failed ? (
          <span className="block py-8 text-sm text-red-700">Image failed to load</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
            <img
            src={src}
            alt={card.displayName}
            className="h-full w-full object-contain object-center"
            onLoad={() => onImageState(card.id, "ready")}
            onError={() => {
              setFailed(true);
              onImageState(card.id, "error");
            }}
          />
        )}
      </button>
      <label className="da-screen-only inline-flex h-7 cursor-pointer items-center rounded-md border border-zinc-300 px-2 text-xs text-zinc-700">
        {uploading ? "Uploading…" : "Replace image"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {uploadMessage ? <p className="da-screen-only text-sm text-zinc-700">{uploadMessage}</p> : null}
    </div>
  );
}

export function DrillAnalysisView({
  data,
  logoUrl,
  playerPhotos = {},
}: {
  data: DrillAnalysisPageData;
  logoUrl?: string | null;
  playerPhotos?: Record<string, string>;
}) {
  const logoSrc = logoUrl?.trim() || "/icon.svg";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [manageOpen, setManageOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [imageState, setImageState] = useState<Record<string, "loading" | "ready" | "error">>({});
  const onImageState = useCallback((id: string, state: "loading" | "ready" | "error") => {
    setImageState((current) => {
      if ((current[id] === "ready" || current[id] === "error") && state === "loading") return current;
      return { ...current, [id]: state };
    });
  }, []);
  const [printMessage, setPrintMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"daily" | "history">("daily");
  const [historyMounted, setHistoryMounted] = useState(false);
  const [compareOn, setCompareOn] = useState(false);
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const model = data.model;
  const sessions = data.sessions.filter((session) => session.date === data.selectedDate);
  const compareNames = model?.players ?? [];

  useEffect(() => {
    if (!compareOn) return;
    const names = model?.players ?? [];
    setPlayerA((current) => (current && names.includes(current) ? current : names[0] ?? ""));
    setPlayerB((current) => {
      if (current && names.includes(current)) return current;
      return names.find((name) => name !== names[0]) ?? "";
    });
  }, [compareOn, model]);

  function enableCompare() {
    const names = model?.players ?? [];
    const nextA =
      playerA && names.includes(playerA)
        ? playerA
        : data.selectedPlayer && names.includes(data.selectedPlayer)
          ? data.selectedPlayer
          : names[0] ?? "";
    const nextB =
      playerB && names.includes(playerB) && playerB !== nextA
        ? playerB
        : names.find((name) => name !== nextA) ?? "";
    setPlayerA(nextA);
    setPlayerB(nextB);
    setCompareOn(true);
  }

  function navigate(date: string | null, sessionKey: string | null, player: string | null) {
    setPrintMessage(null);
    startTransition(() => {
      router.push(pageHref(date, sessionKey, player));
    });
  }

  function printSheet() {
    if (pending || !model || data.sourceError || data.playerError) {
      setPrintMessage("Wait until this date, session, and player have finished loading.");
      return;
    }
    const imageCards = compareOn ? [] : model.cards.filter((card) => card.hasImage);
    if (imageCards.some((card) => imageState[card.id] !== "ready" && imageState[card.id] !== "error")) {
      setPrintMessage("Wait for the drawings to finish loading.");
      return;
    }
    if (imageCards.some((card) => imageState[card.id] === "error")) {
      setPrintMessage("A drawing failed to load. The sheet marks that image.");
    } else {
      setPrintMessage(null);
    }
    window.print();
  }

  const comparePair = Boolean(compareOn && playerA && playerB && playerA !== playerB);
  const compareMarks = comparePair ? comparePrintMarks(playerA, playerB) : null;

  return (
    <div className={`da-sheet space-y-4 ${pending ? "da-pending" : ""} ${tab === "history" ? "da-tab-history" : ""} ${compareOn ? "da-comparing" : ""}`}>
      <style>{`
        .da-print-only { display: none; }
        .da-print-head { display: none; }
        .da-print-title { display: none; }
        .da-collapsed .da-card-body { display: none; }
        .da-col-head { background: #f4f6f8; color: #0f2744; }
        .da-unit { color: #64748b; font-weight: 500; font-size: 0.82em; }
        .da-duration { margin-left: 0.4rem; color: #71717a; font-weight: 500; font-size: 0.78em; }
        .da-print-footer { display: none; }
        .da-compare-print-names { display: none; }
        .da-compare-print-duration { display: none; }
        .da-compare-view { display: none; }
        .da-comparing .da-compare-view { display: block; }
        .da-comparing .da-results { display: none; }
        .da-daily-panel { display: block; }
        @media screen {
          .da-comparing .da-compare-screen-sep,
          .da-comparing .da-compare-player-label { display: none; }
          div.da-sheet.da-comparing.space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
          div.da-comparing .da-daily-panel.space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
          .da-cs-a { color: #0f766e; font-weight: 700; }
          .da-cs-b { color: #1d4ed8; font-weight: 700; }
          .da-cs-mins { color: #64748b; font-weight: 500; }
          .da-sheet:not(.da-comparing):not(.da-tab-history) {
            display: flex;
            flex-flow: row wrap;
            align-items: center;
            column-gap: 1rem;
            row-gap: 0.75rem;
          }
          .da-sheet:not(.da-comparing):not(.da-tab-history).space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 0; }
          .da-sheet:not(.da-comparing):not(.da-tab-history) > .da-daily-panel { display: contents; }
          .da-sheet:not(.da-comparing):not(.da-tab-history) .da-daily-panel.space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 0; }
          .da-sheet:not(.da-comparing):not(.da-tab-history) > .da-daily-panel > header {
            order: 1;
            flex: 1 1 16rem;
            min-width: 0;
            max-width: 100%;
            margin: 0;
            border: 0;
            padding: 0;
          }
          .da-daily-head {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            column-gap: 0.75rem;
            row-gap: 0.25rem;
          }
          .da-daily-head h1 { min-width: 0; margin: 0; }
          .da-sheet:not(.da-comparing):not(.da-tab-history) > .da-history-tabs {
            order: 2;
            flex: 0 1 auto;
            max-width: 100%;
            margin: 0 0 0 auto;
          }
          .da-sheet:not(.da-comparing):not(.da-tab-history) > .da-daily-panel > .da-daily-controls {
            order: 3;
            flex: 1 0 100%;
            min-width: 0;
            max-width: 100%;
          }
          .da-sheet:not(.da-comparing):not(.da-tab-history) > .da-daily-panel > :not(header):not(.da-daily-controls) {
            order: 4;
            flex: 1 0 100%;
            min-width: 0;
            max-width: 100%;
          }
        }
        .da-history-panel { display: none; }
        .da-tab-history .da-daily-panel { display: none; }
        .da-tab-history .da-history-panel { display: block; }
        @media print {
          @page { size: A4 landscape; margin: 7mm; }
          .da-daily-panel { display: contents !important; }
          .da-history-panel, .da-history-tabs { display: none !important; }
          html, body, body * { background: #ffffff !important; color: #18181b !important; box-shadow: none !important; }
          html, body, main { overflow: visible !important; height: auto !important; max-height: none !important; scrollbar-width: none !important; }
          ::-webkit-scrollbar, ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-track { display: none !important; width: 0 !important; height: 0 !important; }
          main, main .overflow-x-hidden { padding: 0 !important; margin: 0 !important; }
          a[aria-label="Back to dashboard"], nextjs-portal { display: none !important; }
          .da-print-root { margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #18181b !important; }
          .da-screen-only { display: none !important; }
          .da-print-only { display: block !important; }
          .da-print-title, .da-pending-note { display: none !important; }
          .da-sheet { display: flex !important; flex-direction: column !important; height: 190mm !important; overflow: hidden !important; background: #ffffff !important; color: #18181b !important; }
          .da-pending .da-results { display: none !important; }
          .da-sheet header { position: relative !important; display: block !important; min-height: 8mm !important; margin: 0 0 1mm !important; padding: 0.8mm 0 0.8mm !important; border: 0 !important; border-bottom: 0.4mm solid #0f766e !important; text-align: center !important; }
          .da-sheet header h1 { display: none !important; }
          .da-sheet header .da-logo { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 9mm !important; height: 9mm !important; max-width: 9mm !important; max-height: 9mm !important; object-fit: contain !important; }
          .da-sheet header p { margin: 0 !important; font-size: 14pt !important; font-weight: 700 !important; line-height: 1.15 !important; letter-spacing: 0.01em !important; color: #0f2744 !important; text-align: center !important; }
          .da-sheet:not(.da-comparing) .da-player-face { display: flex !important; flex: 0 0 auto !important; justify-content: center !important; align-items: center !important; height: 12mm !important; margin: 0 !important; padding: 0 !important; background: transparent !important; }
          .da-sheet:not(.da-comparing) .da-player-face img { display: block !important; width: 12mm !important; height: 12mm !important; max-width: 12mm !important; max-height: 12mm !important; object-fit: cover !important; object-position: center center !important; border-radius: 50% !important; background: #f4f6f8 !important; }
          .da-results { display: flex !important; flex: 1 1 0 !important; flex-direction: column !important; gap: 2mm !important; height: auto !important; min-height: 0 !important; overflow: hidden !important; }
          .da-print-footer { display: flex !important; flex: 0 0 auto !important; justify-content: flex-end !important; align-items: flex-end !important; gap: 2mm !important; margin: 1mm 0 0 !important; }
          .da-print-footer .da-logo { display: none !important; }
          .da-print-brand { display: flex !important; flex-direction: column !important; align-items: flex-end !important; gap: 0.35mm !important; }
          .da-print-footer span { font-size: 9pt !important; font-weight: 700 !important; line-height: 1 !important; color: #0f2744 !important; }
          .da-print-footer .da-print-email { font-size: 7.5pt !important; font-weight: 400 !important; line-height: 1 !important; color: #94a3b8 !important; }
          .da-results > * { margin-top: 0 !important; }
          .da-ft-print { display: block !important; margin: 0 0 1.6mm !important; padding: 0.5mm 0 !important; background: #ffffff !important; border: 0 !important; }
          .da-ft-kicker { display: block !important; margin: 0 0 1.2mm !important; padding: 0 !important; border: 0 !important; font-size: 10.5pt !important; font-weight: 700 !important; line-height: 1.1 !important; color: #18181b !important; background: #ffffff !important; }
          .da-ft-kicker .da-duration, .da-print-card-head .da-duration { display: inline !important; margin-left: 1.6mm !important; color: #94a3b8 !important; background: transparent !important; font-size: 8pt !important; font-weight: 500 !important; line-height: 1 !important; }
          .da-sheet thead tr.da-duration-head th { background: transparent !important; color: #94a3b8 !important; font-size: 7.5pt !important; font-weight: 500 !important; letter-spacing: 0 !important; padding: 0 1.1mm 0.3mm !important; border: 0 !important; border-left: 0 !important; }
          .da-sheet thead tr.da-duration-head .da-duration { display: inline !important; margin: 0 !important; color: #94a3b8 !important; background: transparent !important; font-size: 7.5pt !important; font-weight: 500 !important; line-height: 1 !important; }
          .da-ft-fields { display: grid !important; grid-template-columns: repeat(7, minmax(0, 1fr)) !important; gap: 0 !important; border: 0 !important; border-radius: 2mm !important; overflow: hidden !important; background: #f2f2f2 !important; }
          .da-ft-field { display: block !important; margin: 0 !important; padding: 1.15mm 0.65mm 1mm !important; border: 0 !important; background: transparent !important; text-align: center !important; color: #18181b !important; }
          .da-ft-field span, .da-ft-field strong { background: transparent !important; color: #18181b !important; }
          .da-ft-field span { display: block !important; font-size: 8.5pt !important; font-weight: 500 !important; line-height: 1.1 !important; color: #18181b !important; }
          .da-ft-field strong { display: block !important; margin-top: 0.35mm !important; font-size: 15pt !important; font-weight: 700 !important; line-height: 1.05 !important; color: #18181b !important; }
          .da-full-training { margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; }
          .da-blank-note { margin: 0 !important; font-size: 7.5pt !important; line-height: 1.15 !important; }
          .da-card-list {
            display: grid !important;
            flex: 1 1 0 !important;
            min-height: 0 !important;
            overflow: hidden !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: repeat(var(--da-rows, 1), minmax(0, 1fr)) !important;
            gap: 3.6mm !important;
            align-items: stretch !important;
          }
          .da-card {
            break-inside: avoid;
            page-break-inside: avoid;
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 1mm 1.2mm 1mm 0.4mm !important;
            overflow: hidden !important;
            border: 0.25mm solid #d5dbe3 !important;
            border-radius: 0 !important;
            background: #ffffff !important;
          }
          .da-screen-title { display: block !important; margin: 0 0 0.4mm !important; flex: 0 0 auto !important; }
          .da-print-card-head { display: flex !important; align-items: baseline !important; gap: 1.6mm !important; margin: 0 0 0.5mm !important; padding: 0 !important; border: 0 !important; }
          .da-drill-name { font-size: 13pt !important; line-height: 1.1 !important; font-weight: 700 !important; color: #11243B !important; }
          .da-print-card-head p { margin: 0 !important; font-size: 8pt !important; font-weight: 400 !important; color: #475569 !important; }
          .da-collapsed .da-card-body,
          .da-card-body {
            display: grid !important;
            flex: 1 1 auto !important;
            height: 100% !important;
            min-height: 0 !important;
            overflow: hidden !important;
            grid-template-columns: minmax(0, 46%) minmax(0, 1fr) !important;
            gap: 1.5mm !important;
            align-items: stretch !important;
          }
          .da-card-body > :last-child { height: 100% !important; min-height: 0 !important; display: flex !important; flex-direction: column !important; }
          .da-card-body > :first-child { position: relative !important; width: 100% !important; height: 100% !important; min-height: 0 !important; max-height: 100% !important; display: flex !important; align-items: center !important; justify-content: flex-start !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; }
          .da-card-body > :first-child button { position: relative !important; width: 100% !important; height: 100% !important; min-height: 0 !important; max-height: 100% !important; display: flex !important; align-items: center !important; justify-content: flex-start !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; }
          .da-missing-image { margin: 0 !important; font-size: 8pt !important; line-height: 1.1 !important; font-weight: 500 !important; color: #94a3b8 !important; text-align: center !important; }
          .da-card-body button { margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; }
          .da-card-body .min-h-32 { min-height: 0 !important; border: 0 !important; background: transparent !important; padding: 0 !important; }
          .da-print-head { display: table-row !important; }
          .da-table-scroll { overflow: hidden !important; flex: 1 1 auto !important; height: 100% !important; min-height: 0 !important; }
          .da-sheet table { width: 100% !important; height: 100% !important; min-width: 0 !important; table-layout: fixed !important; border-collapse: collapse !important; border-bottom: 0.25mm solid #c5ced8 !important; background: transparent !important; }
          .da-sheet tbody tr { height: 14.2% !important; }
          .da-sheet table.da-split-sets { border-collapse: collapse !important; border-spacing: 0 !important; }
          .da-sheet th, .da-sheet td {
            padding: 0.7mm 1mm !important;
            font-size: 10.5pt !important;
            line-height: 1.1 !important;
            color: #18181b !important;
            background: #ffffff !important;
            border: 0 !important;
            box-shadow: none !important;
          }
          .da-sheet thead th {
            background: #18181b !important;
            color: #ffffff !important;
            font-size: 8.5pt !important;
            font-weight: 700 !important;
            letter-spacing: 0.01em !important;
            white-space: nowrap !important;
          }
          .da-sheet .da-metric-head { text-align: left !important; }
          .da-sheet .da-value-head { text-align: center !important; }
          .da-sheet .da-value-edge { text-align: right !important; }
          .da-sheet .da-value-head + .da-value-head,
          .da-sheet td.da-num + td.da-num { border-left: 0.15mm solid #e5e5e5 !important; }
          .da-sheet tbody tr:nth-child(odd) > th,
          .da-sheet tbody tr:nth-child(odd) > td,
          .da-sheet tbody tr:nth-child(odd) > th *,
          .da-sheet tbody tr:nth-child(odd) > td * { background: #ffffff !important; }
          .da-sheet tbody tr:nth-child(even) > th,
          .da-sheet tbody tr:nth-child(even) > td,
          .da-sheet tbody tr:nth-child(even) > th *,
          .da-sheet tbody tr:nth-child(even) > td * { background: #F0F0F0 !important; }
          .da-sheet thead th:first-child, .da-sheet tbody th { width: 24mm !important; min-width: 24mm !important; max-width: 24mm !important; }
          .da-sheet tbody th { white-space: nowrap !important; overflow: hidden !important; text-align: left !important; font-size: 9.5pt !important; font-weight: 400 !important; vertical-align: middle !important; color: #18181b !important; }
          .da-sheet tbody th .da-print-only { display: block !important; }
          .da-sheet .da-metric { display: inline-flex !important; flex-direction: row !important; align-items: baseline !important; gap: 0.6mm !important; white-space: nowrap !important; max-width: 100% !important; }
          .da-sheet .da-metric-name { display: inline !important; font-weight: 400 !important; }
          .da-sheet .da-unit { display: inline !important; margin: 0 !important; color: #18181b !important; font-weight: 400 !important; font-size: 8.5pt !important; line-height: 1 !important; }
          .da-sheet td { font-size: 12pt !important; font-weight: 700 !important; text-align: right !important; white-space: nowrap !important; font-variant-numeric: tabular-nums !important; color: #18181b !important; vertical-align: middle !important; }
          .da-sheet table.da-split-sets .da-value-head,
          .da-sheet table.da-split-sets td.da-num { text-align: center !important; }
          .da-sheet .da-card img {
            position: static !important;
            inset: auto !important;
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
            object-position: left center !important;
          }
          .da-sheet:not(.da-comparing) .da-card {
            padding: 0 !important;
            border: 0.25mm solid #d5dee6 !important;
          }
          .da-sheet:not(.da-comparing) .da-screen-title { margin: 0 !important; }
          .da-sheet:not(.da-comparing) .da-card-body { padding: 1mm 1.2mm 1mm 0.4mm !important; }
          .da-sheet:not(.da-comparing) .da-print-card-head {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) auto !important;
            align-items: start !important;
            column-gap: 2mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            background: #e7eef3 !important;
            border: 0 !important;
            border-bottom: 0.2mm solid #d5dee6 !important;
            overflow: visible !important;
          }
          .da-sheet:not(.da-comparing) .da-print-card-head .da-drill-name {
            grid-column: 1 !important;
            min-width: 0 !important;
            font-size: 10.5pt !important;
            font-weight: 700 !important;
            line-height: 1.2 !important;
            color: #11243B !important;
            white-space: normal !important;
            overflow: visible !important;
            background: transparent !important;
          }
          .da-sheet:not(.da-comparing) .da-print-card-head .da-duration {
            grid-column: 2 !important;
            margin: 0 !important;
            color: #64748b !important;
            background: transparent !important;
            font-size: 9pt !important;
            font-weight: 500 !important;
            line-height: 1.2 !important;
            white-space: nowrap !important;
            text-align: right !important;
          }
          .da-sheet:not(.da-comparing) .da-print-card-head p { grid-column: 1 / -1 !important; background: transparent !important; }
          .da-sheet:not(.da-comparing) thead tr:not(.da-duration-head) th,
          .da-sheet:not(.da-comparing) thead tr:not(.da-duration-head) th * {
            background: #f4f7f8 !important;
            color: #11243B !important;
            font-weight: 600 !important;
          }
          tr, thead { break-inside: avoid; page-break-inside: avoid; }
          .da-compare-print-names { display: none !important; }
          .da-comparing.da-sheet { display: flex !important; flex-direction: column !important; height: 194mm !important; max-height: none !important; overflow: visible !important; }
          .da-comparing .da-results { display: none !important; }
          .da-comparing .da-compare-view { display: flex !important; flex: 0 0 auto !important; flex-direction: column !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .da-comparing .da-compare-sheet { display: flex !important; flex: 0 0 auto !important; flex-direction: column !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
          .da-comparing .da-daily-panel.space-y-4 > :not([hidden]) ~ :not([hidden]):not(.da-print-footer) { margin-top: 0 !important; }
          .da-comparing .da-daily-panel.space-y-4 > .da-print-footer { margin-top: auto !important; padding-top: 3mm !important; }
          .da-comparing .da-print-footer .da-print-email { font-size: 8pt !important; font-weight: 400 !important; line-height: 1.25 !important; color: #3f3f46 !important; overflow: visible !important; }
          .da-comparing .da-compare-player-label { display: none !important; }
          .da-comparing .da-compare-print-names { display: inline !important; }
          .da-comparing .da-compare-print-head,
          .da-comparing .da-compare-grid { display: none !important; }
          .da-comparing .da-print-footer { margin-top: auto !important; }
          .da-comparing .da-cr-face { display: inline-block !important; width: 8mm !important; height: 8mm !important; margin: 0 1.2mm 0 2mm !important; object-fit: contain !important; object-position: center center !important; vertical-align: middle !important; background: #f4f4f5 !important; }
          .da-comparing .da-cr { display: flex !important; flex: 0 0 auto !important; flex-direction: column !important; margin-top: 0 !important; color: #11243B !important; }
          .da-comparing .da-cr-ft { margin: 0 0 1mm !important; }
          .da-comparing .da-cr-ft h2 { margin: 0 0 1.2mm !important; font-size: 11pt !important; font-weight: 700 !important; line-height: 1.15 !important; color: #11243B !important; text-align: left !important; }
          .da-comparing .da-cr-note { margin: 0 0 1mm !important; font-size: 8pt !important; line-height: 1.2 !important; color: #3f3f46 !important; }
          .da-comparing .da-cr table { width: 100% !important; height: auto !important; min-width: 0 !important; table-layout: auto !important; border-collapse: collapse !important; border: 0 !important; background: transparent !important; }
          .da-comparing .da-cr tr { height: auto !important; }
          .da-comparing .da-cr th,
          .da-comparing .da-cr td,
          .da-comparing .da-cr thead th:first-child,
          .da-comparing .da-cr tbody th { width: auto !important; min-width: 0 !important; max-width: none !important; height: auto !important; overflow: visible !important; padding: 1.05mm 1.35mm !important; border: 0 !important; border-bottom: 0.15mm solid #e7e5e4 !important; background: #ffffff !important; color: #18181b !important; font-size: 10pt !important; font-weight: 700 !important; line-height: 1.2 !important; text-align: right !important; vertical-align: middle !important; white-space: nowrap !important; }
          .da-comparing .da-cr th:first-child,
          .da-comparing .da-cr td:first-child { text-align: left !important; font-weight: 600 !important; }
          .da-comparing .da-cr-ft table,
          .da-comparing .da-cr-card table { table-layout: fixed !important; width: 100% !important; }
          .da-comparing .da-cr-ft thead th:first-child,
          .da-comparing .da-cr-ft tbody th:first-child { width: 64mm !important; max-width: none !important; overflow: visible !important; }
          .da-comparing .da-cr-ft td { font-size: 13pt !important; font-weight: 700 !important; line-height: 1.1 !important; padding: 1.15mm 1.5mm !important; }
          .da-comparing .da-cr-ft tbody th { font-size: 10pt !important; }
          .da-comparing .da-cr-card tbody td { font-size: 10pt !important; font-weight: 700 !important; }
          .da-comparing .da-cr-card tbody th { font-size: 9pt !important; font-weight: 600 !important; }
          .da-comparing .da-cr thead th { font-size: 8pt !important; font-weight: 600 !important; color: #11243B !important; background: #f4f7f8 !important; white-space: normal !important; padding: 0.9mm 1.3mm !important; }
          .da-comparing .da-cr tbody tr:nth-child(even) th,
          .da-comparing .da-cr tbody tr:nth-child(even) td { background: #f7f7f8 !important; }
          .da-comparing .da-cr .da-cr-u { margin-left: 0.8mm !important; font-size: 7.5pt !important; font-weight: 500 !important; color: #64748b !important; }
          .da-comparing .da-cr .da-cr-a,
          .da-comparing .da-cr th.da-cr-a { color: #0f766e !important; }
          .da-comparing .da-cr .da-cr-b,
          .da-comparing .da-cr th.da-cr-b { color: #1d4ed8 !important; }
          .da-comparing .da-cr th.da-cr-mins { font-size: 8pt !important; font-weight: 500 !important; color: #52525b !important; }
          .da-comparing .da-cr h2 .da-cr-mins,
          .da-comparing .da-cr thead th .da-cr-mins { font-weight: 500 !important; color: #94a3b8 !important; background: transparent !important; }
          .da-comparing .da-cr h2 .da-cr-mins { font-size: 8.5pt !important; }
          .da-comparing .da-cr h2 .da-cr-a,
          .da-comparing .da-cr h2 .da-cr-b,
          .da-comparing .da-cr thead th .da-cr-a,
          .da-comparing .da-cr thead th .da-cr-b { background: transparent !important; }
          .da-comparing .da-cr th.da-cr-split,
          .da-comparing .da-cr td.da-cr-split { border-left: 0.45mm solid #c5d0da !important; padding-left: 2.4mm !important; }
          .da-comparing .da-cr-drills { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 4mm !important; align-items: start !important; flex: 0 0 auto !important; }
          .da-comparing .da-cr-card { display: flex !important; flex-direction: column !important; min-width: 0 !important; border: 0.25mm solid #d5dee6 !important; background: #ffffff !important; break-inside: avoid; page-break-inside: avoid; }
          .da-comparing .da-cr-card h2 { margin: 0 !important; padding: 1.5mm 2.2mm !important; font-size: 10.5pt !important; font-weight: 700 !important; line-height: 1.15 !important; color: #11243B !important; text-align: left !important; background: #e7eef3 !important; border-bottom: 0.2mm solid #d5dee6 !important; }
          .da-comparing .da-cr-body { display: grid !important; grid-template-columns: 32% minmax(0, 1fr) !important; column-gap: 2.5mm !important; align-items: center !important; flex: 0 0 auto !important; min-height: 0 !important; padding: 1.4mm !important; }
          .da-comparing .da-cr-frame { position: relative !important; width: 100% !important; height: 54mm !important; min-height: 54mm !important; max-height: 54mm !important; align-self: center !important; background: #f4f6f8 !important; }
          .da-comparing .da-cr-frame img { position: absolute !important; inset: 1.2mm !important; width: calc(100% - 2.4mm) !important; height: calc(100% - 2.4mm) !important; max-width: none !important; max-height: none !important; object-fit: contain !important; object-position: center center !important; background: transparent !important; }
          .da-comparing .da-cr-card table { align-self: stretch !important; height: auto !important; }
        }
      `}</style>

      <div className="da-history-tabs da-screen-only flex gap-2 overflow-x-auto">
        <div className="flex shrink-0 gap-2" role="tablist" aria-label="Drill Analysis">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "daily"}
          className={`h-11 shrink-0 rounded-lg px-4 font-medium ${compareOn ? "text-sm" : "text-base"} ${tab === "daily" ? "bg-[#11243B] text-white" : "border border-zinc-300 bg-white text-zinc-900"}`}
          onClick={() => setTab("daily")}
        >
          Daily Analysis
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          data-da-tab="history"
          className={`h-11 shrink-0 rounded-lg px-4 font-medium ${compareOn ? "text-sm" : "text-base"} ${tab === "history" ? "bg-[#11243B] text-white" : "border border-zinc-300 bg-white text-zinc-900"}`}
          onClick={() => {
            setHistoryMounted(true);
            setTab("history");
          }}
        >
          Drill History
        </button>
        </div>
        <div id="da-plan-toolbar-slot" className="flex shrink-0 gap-2" />
      </div>
      <div className="da-daily-panel space-y-4">
      <div className={`da-daily-controls da-screen-only flex max-w-full flex-wrap items-end ${compareOn ? "gap-x-2 gap-y-1.5" : "justify-between gap-x-4 gap-y-2"}`}>
        <div className={compareOn ? "contents" : "flex min-w-0 flex-1 basis-full flex-wrap items-end gap-x-3 gap-y-2 md:basis-auto"}>
        <label className={compareOn ? "text-sm" : "min-w-[10.5rem] flex-1 sm:flex-none"}>
          <span className={`mb-1 block font-medium ${compareOn ? "text-zinc-900" : "text-sm text-zinc-700"}`}>Date</span>
          <input
            type="date"
            value={data.selectedDate ?? ""}
            onChange={(event) => navigate(event.target.value, null, data.selectedPlayer)}
            className={`h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 ${compareOn ? "" : "w-full text-base"}`}
          />
        </label>
        <label className={compareOn ? "min-w-48 text-sm" : "min-w-[11rem] flex-1 sm:max-w-xs"}>
          <span className={`mb-1 block font-medium ${compareOn ? "text-zinc-900" : "text-sm text-zinc-700"}`}>Session</span>
          <select
            value={data.selectedSessionKey ?? ""}
            onChange={(event) => navigate(data.selectedDate, event.target.value, data.selectedPlayer)}
            className={`h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 ${compareOn ? "" : "text-base"}`}
          >
            {sessions.map((session) => (
              <option key={session.key} value={session.key}>
                {session.label}
              </option>
            ))}
          </select>
        </label>
        <label className={compareOn ? "min-w-48 text-sm" : "min-w-[11rem] flex-1 sm:max-w-xs"}>
          <span className={`mb-1 block font-medium ${compareOn ? "text-zinc-900" : "text-sm text-zinc-700"}`}>Player</span>
          <select
            value={data.selectedPlayer ?? ""}
            onChange={(event) => navigate(data.selectedDate, data.selectedSessionKey, event.target.value || null)}
            className={`h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 ${compareOn ? "" : "text-base"}`}
          >
            <option value="">Team average</option>
            {data.selectedPlayer && !(model?.players ?? []).includes(data.selectedPlayer) ? (
              <option value={data.selectedPlayer}>{data.selectedPlayer}</option>
            ) : null}
            {(model?.players ?? []).map((player) => (
              <option key={player} value={player}>
                {player}
              </option>
            ))}
          </select>
        </label>
        </div>
        <div className={compareOn ? "contents" : "flex flex-wrap items-center gap-2"}>
        <button
          type="button"
          aria-pressed={compareOn}
          className={`h-11 rounded-lg px-4 font-medium ${compareOn ? "bg-[#11243B] text-sm text-white" : "border border-zinc-300 bg-white text-base text-zinc-900"}`}
          onClick={() => {
            if (compareOn) setCompareOn(false);
            else enableCompare();
          }}
        >
          Compare players
        </button>
        {compareOn ? (
          <>
            <label className="min-w-40 text-sm">
              <span className="mb-1 block font-medium text-zinc-900">Player A</span>
              <select
                value={playerA}
                onChange={(event) => setPlayerA(event.target.value)}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900"
              >
                {compareNames.map((player) => (
                  <option key={player} value={player} disabled={player === playerB}>
                    {player}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-40 text-sm">
              <span className="mb-1 block font-medium text-zinc-900">Player B</span>
              <select
                value={playerB}
                onChange={(event) => setPlayerB(event.target.value)}
                className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900"
              >
                {compareNames.map((player) => (
                  <option key={player} value={player} disabled={player === playerA}>
                    {player}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        <button
          type="button"
          className={`h-11 rounded-lg border border-zinc-300 bg-white px-4 font-medium text-zinc-900 ${compareOn ? "text-sm" : "text-base"}`}
          onClick={() => setManageOpen((open) => !open)}
        >
          Manage drills
        </button>
        <button
          type="button"
          className={`h-11 rounded-lg border border-zinc-300 bg-white px-4 font-medium text-zinc-900 disabled:opacity-60 ${compareOn ? "text-sm" : "text-base"}`}
          disabled={pending || !model || Boolean(data.sourceError) || Boolean(data.playerError) || (compareOn && (!playerA || !playerB || playerA === playerB))}
          onClick={printSheet}
        >
          Print / Save PDF
        </button>
        </div>
      </div>
      {printMessage ? <p className="da-screen-only text-sm text-zinc-700">{printMessage}</p> : null}
      {data.layoutError ? <p className="da-screen-only text-sm text-zinc-700">{data.layoutError}</p> : null}
      {pending ? <p className="da-screen-only text-sm text-zinc-700">Loading the selected session…</p> : null}

      <header className={compareOn ? "flex items-center gap-2 border-b border-teal-700/40 pb-2" : "da-daily-head"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="ST-AMS" className={`da-logo h-10 w-10 object-contain ${compareOn ? "" : "shrink-0"}`} />
        <div className={compareOn ? "min-w-0" : "contents"}>
          <h1 className={`font-semibold tracking-tight text-[#0f2744] ${compareOn ? "text-xl" : "text-[26px] leading-tight"}`}>
            {compareOn ? "ST-AMS / Compare players" : "ST-AMS / Drill Analysis"}
          </h1>
          {model ? (
            <p className={compareOn ? "text-sm text-[#1e3a4c]" : "da-print-only"}>
              {formatSessionDate(model.session.date)} · {model.sessionLabel}
              <span className={compareOn ? "da-compare-screen-sep mx-2" : "mx-2"}>·</span>
              <span className={compareOn ? "da-compare-player-label" : ""}>{model.playerLabel}</span>
              {comparePair ? (
                <span className="da-compare-print-names">
                  {playerPhotos[playerA] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={playerPhotos[playerA]} alt="" className="da-cr-face" />
                  ) : null}
                  {playerA}
                  <span className="da-cr-dot"> · </span>
                  {playerPhotos[playerB] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={playerPhotos[playerB]} alt="" className="da-cr-face" />
                  ) : null}
                  {playerB}
                </span>
              ) : null}
            </p>
          ) : null}
          {compareMarks ? (
            <div className="da-screen-only mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {[
                { name: playerA, photo: playerPhotos[playerA] ?? null, mark: compareMarks[0], tone: "da-cs-a" },
                { name: playerB, photo: playerPhotos[playerB] ?? null, mark: compareMarks[1], tone: "da-cs-b" },
              ].map((player) => (
                <span key={player.name} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                  {player.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={player.photo} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="h-7 w-7 shrink-0 rounded-full bg-zinc-200" />
                  )}
                  <span className={`${player.tone} text-sm`}>{player.mark}</span>
                  <span className="truncate text-sm font-semibold text-[#11243B]">{player.name}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <p className="da-pending-note hidden text-sm">Wait for the selected player to finish loading before printing.</p>

      {data.sourceError ? <p className="text-sm text-zinc-800">{data.sourceError}</p> : null}
      {data.playerError ? <p className="text-sm text-zinc-800">{data.playerError}</p> : null}

      {model && manageOpen ? (
        <div className="da-screen-only">
          <ManageDrills
            sessionKey={model.sessionKey}
            occurrences={model.editorOccurrences}
            savedCards={model.editorCards}
          />
        </div>
      ) : null}

      {model ? (
        <div className="da-results min-w-0 space-y-3">
          {!compareOn && data.selectedPlayer && playerPhotos[data.selectedPlayer] ? (
            <div className="da-player-face flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={playerPhotos[data.selectedPlayer]} alt="" className="h-14 w-14 rounded-full object-cover" />
            </div>
          ) : null}
          <section className="da-full-training min-w-0 max-w-full rounded-md border border-[#d5dee6] bg-white px-3 py-2.5">
            <div className="da-screen-only">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-[#11243B]">Full Training</h2>
              {model.fullTraining.columns.length === 1 ? <DurationMark column={model.fullTraining.columns[0]} /> : null}
            </div>
            {model.fullTraining.status === "missing" ? (
              <p className="mt-1 text-sm text-zinc-700">No Full Training row for this session.</p>
            ) : null}
            {model.fullTraining.status === "repeated" ? (
              <p className="mt-1 text-sm text-zinc-700">
                More than one Full Training occurrence was found. They are shown separately and are not added together.
              </p>
            ) : null}
            {model.fullTraining.columns.map((column) => (
              <div key={column.occurrenceKey} className="mt-1">
                {model.fullTraining.columns.length > 1 ? (
                  <p className="mb-1 text-sm font-medium text-zinc-700">
                    {column.label}
                    <DurationMark column={column} />
                  </p>
                ) : null}
                <div className="min-w-0 overflow-x-auto">
                  <div className="grid min-w-[40rem] grid-cols-7 lg:min-w-0">
                    {DRILL_METRICS.map((metric) => (
                      <div key={metric.key} className="px-1 py-1 text-center">
                        <div className="text-sm font-medium leading-tight text-zinc-600">{PRINT_METRIC_LABEL[metric.key]}</div>
                        <div className="mt-1 text-[22px] font-bold leading-none tabular-nums text-zinc-900">
                          {fullTrainingFigure(column.metrics[metric.key], metric)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            </div>
            <div className="da-print-only da-ft-print">
              {model.fullTraining.columns.length === 0 ? (
                <div className="da-ft-kicker">Full Training</div>
              ) : (
                model.fullTraining.columns.map((column) => (
                  <div key={column.occurrenceKey}>
                    <div className="da-ft-kicker">
                      Full Training
                      {model.fullTraining.columns.length > 1 ? ` · ${column.label}` : ""}
                      <DurationMark column={column} />
                    </div>
                    <div className="da-ft-fields">
                      {DRILL_METRICS.map((metric) => (
                        <div key={metric.key} className="da-ft-field">
                          <span>{PRINT_METRIC_LABEL[metric.key]}</span>
                          <strong>{fullTrainingFigure(column.metrics[metric.key], metric)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {model.fullTraining.status === "repeated" ? (
                <p className="da-print-card-head">Shown separately, not added together.</p>
              ) : null}
            </div>
          </section>

          {model.excludedBlankDrillRows > 0 ? (
            <p className="da-blank-note text-sm text-zinc-700">
              {model.excludedBlankDrillRows} source rows have a blank drill name. They are counted here and are not shown as cards.
            </p>
          ) : null}

          <div
            className="da-card-list grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2"
            style={{ ["--da-rows" as string]: String(Math.max(1, Math.ceil(model.cards.length / 2))) }}
          >
            {model.cards.map((card) => {
              const isCollapsed = Boolean(collapsed[card.id]);
              const headings = reportHeadings(
                card.displayName,
                card.columns.map((column) => column.label)
              );
              return (
                <article
                  key={card.id}
                  className={`da-card min-w-0 max-w-full overflow-hidden rounded-md border border-[#d5dee6] bg-white ${isCollapsed ? "da-collapsed" : ""}`}
                  style={{ ["--da-cols" as string]: String(card.columns.length) }}
                >
                  <div className="da-screen-title">
                    <div className="da-screen-only grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 bg-[#e7eef3] px-2.5 py-1.5">
                      <h2 className="min-w-0 break-words text-[15px] font-bold leading-snug text-[#11243B]">{headings.title}</h2>
                      <div className="flex items-center gap-1.5">
                        {card.columns.length === 1 ? <DurationMark column={card.columns[0]} /> : null}
                        <button
                          type="button"
                          className="h-7 shrink-0 rounded px-1.5 text-xs font-medium text-zinc-500"
                          aria-expanded={!isCollapsed}
                          onClick={() => setCollapsed((current) => ({ ...current, [card.id]: !current[card.id] }))}
                        >
                          {isCollapsed ? "Expand" : "Collapse"}
                        </button>
                      </div>
                    </div>
                    {card.missingCount > 0 ? (
                      <p className="da-screen-only px-2.5 pt-1 text-sm text-zinc-700">
                        A saved drill occurrence is no longer in the source. It was not linked to another drill with the same name.
                      </p>
                    ) : null}
                    {card.columns.some((column) => column.hasPlayerConflict) ? (
                      <p className="da-screen-only px-2.5 pt-1 text-sm text-zinc-700">
                        Repeated player rows for this drill disagreed, so those values are blank.
                      </p>
                    ) : null}
                    {headings.title || card.missingCount > 0 || card.columns.some((column) => column.hasPlayerConflict) ? (
                      <div className="da-print-only da-print-card-head">
                        {headings.title ? <span className="da-drill-name">{headings.title}</span> : null}
                        {headings.title && card.columns.length === 1 ? <DurationMark column={card.columns[0]} /> : null}
                        {card.missingCount > 0 ? (
                          <p>A saved drill occurrence is no longer in the source. It was not linked to another drill with the same name.</p>
                        ) : null}
                        {card.columns.some((column) => column.hasPlayerConflict) ? (
                          <p>Repeated player rows for this drill disagreed, so those values are blank.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="da-card-body grid min-w-0 grid-cols-1 items-start gap-2 p-2 lg:grid-cols-[38%_minmax(0,1fr)] lg:gap-3">
                    <CardImage
                      key={`${card.id}:${card.hasImage ? "image" : "empty"}`}
                      card={card}
                      sessionKey={model.sessionKey}
                      onZoom={(src, alt) => setZoom({ src, alt })}
                      onImageState={onImageState}
                    />
                    <DrillTable card={card} columnLabels={headings.columnLabels} />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {model && compareOn ? (
        <div className="da-compare-view da-screen-only min-w-0">
          <DrillCompare model={model} playerA={playerA} playerB={playerB} photos={playerPhotos} ready={!pending} />
        </div>
      ) : null}

      <footer className="da-print-footer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" className="da-logo" />
        <div className="da-print-brand">
          <span>ST-AMS / Drill Analysis</span>
          <span className="da-print-email">santatamas8@gmail.com</span>
        </div>
      </footer>

      {zoom ? (
        <div
          className="da-screen-only fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoom(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom.src} alt={zoom.alt} className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
      </div>
      {historyMounted ? (
        <div className="da-history-panel">
          <DrillHistory />
        </div>
      ) : null}
    </div>
  );
}
