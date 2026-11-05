"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ManageDrills } from "@/app/(app)/drill-analysis/ManageDrills";
import { formatDrillMetric, formatDrillNumber, formatSessionDate, reportHeadings } from "@/lib/drillAnalysis/format";
import { DRILL_METRICS } from "@/lib/drillAnalysis/types";
import type { DrillAnalysisPageData, DrillMetricKey } from "@/lib/drillAnalysis/types";
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

function DrillTable({ card, columnLabels }: { card: DrillViewCard; columnLabels?: string[] }) {
  const labels = columnLabels ?? card.columns.map((column) => column.label);
  const showNames = labels.some((label) => label.trim().length > 0);
  const separateSets = card.columns.length > 1;
  return (
    <div className="da-table-scroll min-w-0 overflow-x-auto">
      <table className={`w-full min-w-[280px] border-collapse text-left text-sm ${separateSets ? "da-split-sets" : ""}`}>
        <thead>
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
            <tr className="da-screen-only">
              <th className="da-col-head border border-zinc-300 px-2 py-2 font-semibold">
                <span className="da-screen-only">Metric</span>
              </th>
              {card.columns.map((column, index) => (
                <th key={column.occurrenceKey} className="da-col-head da-value-head border border-zinc-300 px-2 py-2 font-semibold">
                  <div>{labels[index]}</div>
                </th>
              ))}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {DRILL_METRICS.map((metric) => (
            <tr key={metric.key}>
              <th className="border border-zinc-300 px-2 py-2 font-medium text-zinc-900">
                <span className="da-screen-only">{metric.label}</span>
                <span className="da-print-only"><PrintMetricName metric={metric} /></span>
              </th>
              {card.columns.map((column) => (
                <td key={column.occurrenceKey} className="da-num border border-zinc-300 px-2 py-2 tabular-nums text-zinc-900">
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
        <label className="da-screen-only flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm text-zinc-700">
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
    <div className="space-y-2">
      <button
        type="button"
        className="block w-full"
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
            className="max-h-72 w-full object-contain"
            onLoad={() => onImageState(card.id, "ready")}
            onError={() => {
              setFailed(true);
              onImageState(card.id, "error");
            }}
          />
        )}
      </button>
      <label className="da-screen-only inline-flex h-11 cursor-pointer items-center rounded-lg border border-zinc-300 px-3 text-sm text-zinc-800">
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

export function DrillAnalysisView({ data, logoUrl }: { data: DrillAnalysisPageData; logoUrl?: string | null }) {
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
  const model = data.model;
  const sessions = data.sessions.filter((session) => session.date === data.selectedDate);

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
    const imageCards = model.cards.filter((card) => card.hasImage);
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

  return (
    <div className={`da-sheet space-y-4 ${pending ? "da-pending" : ""}`}>
      <style>{`
        .da-print-only { display: none; }
        .da-print-head { display: none; }
        .da-print-title { display: none; }
        .da-collapsed .da-card-body { display: none; }
        .da-col-head { background: #f4f6f8; color: #0f2744; }
        .da-unit { color: #64748b; font-weight: 500; font-size: 0.82em; }
        .da-print-footer { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 7mm; }
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
          .da-sheet header { position: relative !important; display: block !important; min-height: 9mm !important; margin: 0 0 1.6mm !important; padding: 1.2mm 0 1.2mm !important; border: 0 !important; border-bottom: 0.4mm solid #0f766e !important; text-align: center !important; }
          .da-sheet header h1 { display: none !important; }
          .da-sheet header .da-logo { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 9mm !important; height: 9mm !important; max-width: 9mm !important; max-height: 9mm !important; object-fit: contain !important; }
          .da-sheet header p { margin: 0 !important; font-size: 14pt !important; font-weight: 700 !important; line-height: 1.15 !important; letter-spacing: 0.01em !important; color: #0f2744 !important; text-align: center !important; }
          .da-results { display: flex !important; flex: 1 1 auto !important; flex-direction: column !important; gap: 1.8mm !important; height: auto !important; min-height: 0 !important; }
          .da-print-footer { display: flex !important; justify-content: flex-end !important; align-items: flex-end !important; gap: 2mm !important; margin: 1.4mm 0 0 !important; }
          .da-print-footer .da-logo { display: none !important; }
          .da-print-brand { display: flex !important; flex-direction: column !important; align-items: flex-end !important; gap: 0.35mm !important; }
          .da-print-footer span { font-size: 9pt !important; font-weight: 700 !important; line-height: 1 !important; color: #0f2744 !important; }
          .da-print-footer .da-print-email { font-size: 7.5pt !important; font-weight: 400 !important; line-height: 1 !important; color: #94a3b8 !important; }
          .da-results > * { margin-top: 0 !important; }
          .da-ft-print { display: block !important; margin: 0 0 1.6mm !important; padding: 0.5mm 0 !important; background: #ffffff !important; border: 0 !important; }
          .da-ft-kicker { display: block !important; margin: 0 0 1.2mm !important; padding: 0 !important; border: 0 !important; font-size: 10.5pt !important; font-weight: 700 !important; line-height: 1.1 !important; color: #18181b !important; background: #ffffff !important; }
          .da-ft-fields { display: grid !important; grid-template-columns: repeat(7, minmax(0, 1fr)) !important; gap: 0 !important; border: 0 !important; border-radius: 2mm !important; overflow: hidden !important; background: #e6e6e6 !important; }
          .da-ft-field { display: block !important; margin: 0 !important; padding: 1.5mm 0.65mm 1.3mm !important; border: 0 !important; background: transparent !important; text-align: center !important; color: #18181b !important; }
          .da-ft-field span, .da-ft-field strong { background: transparent !important; color: #18181b !important; }
          .da-ft-field span { display: block !important; font-size: 9pt !important; font-weight: 500 !important; line-height: 1.1 !important; color: #18181b !important; }
          .da-ft-field strong { display: block !important; margin-top: 0.45mm !important; font-size: 17pt !important; font-weight: 700 !important; line-height: 1.05 !important; color: #18181b !important; }
          .da-full-training { margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; }
          .da-blank-note { margin: 0 !important; font-size: 7.5pt !important; line-height: 1.15 !important; }
          .da-card-list {
            display: grid !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: repeat(var(--da-rows, 1), minmax(0, 1fr)) !important;
            gap: 2mm !important;
            align-items: stretch !important;
          }
          .da-card {
            break-inside: avoid;
            page-break-inside: avoid;
            display: flex !important;
            flex-direction: column !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 1.5mm !important;
            border: 0.25mm solid #d5dbe3 !important;
            border-radius: 0 !important;
            background: #ffffff !important;
          }
          .da-screen-title { display: block !important; margin: 0 0 0.7mm !important; }
          .da-print-card-head { display: flex !important; align-items: baseline !important; gap: 1.6mm !important; margin: 0 0 1.1mm !important; padding: 0 !important; border: 0 !important; }
          .da-drill-name { font-size: 13pt !important; line-height: 1.1 !important; font-weight: 700 !important; color: #11243B !important; }
          .da-print-card-head p { margin: 0 !important; font-size: 8pt !important; font-weight: 400 !important; color: #475569 !important; }
          .da-collapsed .da-card-body,
          .da-card-body {
            display: grid !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            grid-template-columns: minmax(0, 43%) minmax(0, 1fr) !important;
            gap: 2mm !important;
            align-items: stretch !important;
          }
          .da-card-body > :first-child { position: relative !important; width: auto !important; height: 100% !important; min-height: 0 !important; max-height: none !important; display: flex !important; align-items: center !important; justify-content: center !important; }
          .da-missing-image { margin: 0 !important; font-size: 8pt !important; line-height: 1.1 !important; font-weight: 500 !important; color: #94a3b8 !important; text-align: center !important; }
          .da-card-body button { margin: 0 !important; padding: 0 !important; border: 0 !important; background: transparent !important; }
          .da-card-body .min-h-32 { min-height: 0 !important; border: 0 !important; background: transparent !important; padding: 0 !important; }
          .da-print-head { display: table-row !important; }
          .da-table-scroll { overflow: visible !important; }
          .da-sheet table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; border-collapse: collapse !important; border-bottom: 0.25mm solid #c5ced8 !important; background: transparent !important; }
          .da-sheet table.da-split-sets { border-collapse: collapse !important; border-spacing: 0 !important; }
          .da-sheet th, .da-sheet td {
            padding: 0.7mm 1.1mm !important;
            font-size: 10.5pt !important;
            line-height: 1.15 !important;
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
          .da-sheet td { font-size: 12pt !important; font-weight: 700 !important; text-align: right !important; white-space: nowrap !important; font-variant-numeric: tabular-nums !important; color: #18181b !important; }
          .da-sheet .da-card img {
            position: absolute !important;
            inset: 0 !important;
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
            object-position: center center !important;
          }
          tr, thead { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="da-screen-only flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-zinc-900">Date</span>
          <input
            type="date"
            value={data.selectedDate ?? ""}
            onChange={(event) => navigate(event.target.value, null, data.selectedPlayer)}
            className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900"
          />
        </label>
        <label className="min-w-48 text-sm">
          <span className="mb-1 block font-medium text-zinc-900">Session</span>
          <select
            value={data.selectedSessionKey ?? ""}
            onChange={(event) => navigate(data.selectedDate, event.target.value, data.selectedPlayer)}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900"
          >
            {sessions.map((session) => (
              <option key={session.key} value={session.key}>
                {session.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-48 text-sm">
          <span className="mb-1 block font-medium text-zinc-900">Player</span>
          <select
            value={data.selectedPlayer ?? ""}
            onChange={(event) => navigate(data.selectedDate, data.selectedSessionKey, event.target.value || null)}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900"
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
        <button
          type="button"
          className="h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900"
          onClick={() => setManageOpen((open) => !open)}
        >
          Manage drills
        </button>
        <button
          type="button"
          className="h-11 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 disabled:opacity-60"
          disabled={pending || !model || Boolean(data.sourceError) || Boolean(data.playerError)}
          onClick={printSheet}
        >
          Print / Save PDF
        </button>
      </div>
      {printMessage ? <p className="da-screen-only text-sm text-zinc-700">{printMessage}</p> : null}
      {data.layoutError ? <p className="da-screen-only text-sm text-zinc-700">{data.layoutError}</p> : null}
      {pending ? <p className="da-screen-only text-sm text-zinc-700">Loading the selected session…</p> : null}

      <header className="flex items-center gap-3 border-b border-teal-700/40 pb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="ST-AMS" className="da-logo h-12 w-12 object-contain" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0f2744]">ST-AMS / Drill Analysis</h1>
          {model ? (
            <p className="text-sm text-[#1e3a4c]">
              {formatSessionDate(model.session.date)} · {model.sessionLabel}
              <span className="mx-2">·</span>
              {model.playerLabel}
            </p>
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
        <div className="da-results space-y-4">
          <section className="da-full-training rounded-xl border border-zinc-300 bg-white p-4">
            <div className="da-screen-only">
            <h2 className="text-lg font-semibold text-zinc-900">Full Training</h2>
            {model.fullTraining.status === "missing" ? (
              <p className="mt-2 text-sm text-zinc-700">No Full Training row for this session.</p>
            ) : null}
            {model.fullTraining.status === "repeated" ? (
              <p className="mt-2 text-sm text-zinc-700">
                More than one Full Training occurrence was found. They are shown separately and are not added together.
              </p>
            ) : null}
            <div className="mt-3">
              <DrillTable
                card={{
                  id: "full-training",
                  displayName: "Full Training",
                  persisted: false,
                  hasImage: false,
                  missingCount: 0,
                  columns: model.fullTraining.columns.length === 1
                    ? [{ ...model.fullTraining.columns[0], label: "Value" }]
                    : model.fullTraining.columns.length > 0
                      ? model.fullTraining.columns
                      : [
                        {
                          label: "Value",
                          occurrenceKey: "full-training-empty",
                          timeLabel: "No source row",
                          uncertain: false,
                          missing: false,
                          hasPlayerConflict: false,
                          metrics: {
                            totalDistance: null,
                            tempoDistance: null,
                            hsr: null,
                            sprintDistance: null,
                            distancePerMin: null,
                            accelerations: null,
                            decelerations: null,
                          },
                        },
                      ],
                }}
              />
            </div>
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
            className="da-card-list flex flex-col gap-4"
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
                  className={`da-card rounded-xl border border-zinc-300 bg-white p-4 ${isCollapsed ? "da-collapsed" : ""}`}
                  style={{ ["--da-cols" as string]: String(card.columns.length) }}
                >
                  <div className="da-screen-title mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="da-screen-only">
                      {headings.title ? <h2 className="text-lg font-semibold text-[#0f2744]">{headings.title}</h2> : null}
                      {card.missingCount > 0 ? (
                        <p className="mt-1 text-sm text-zinc-700">
                          A saved drill occurrence is no longer in the source. It was not linked to another drill with the same name.
                        </p>
                      ) : null}
                      {card.columns.some((column) => column.hasPlayerConflict) ? (
                        <p className="mt-1 text-sm text-zinc-700">
                          Repeated player rows for this drill disagreed, so those values are blank.
                        </p>
                      ) : null}
                    </div>
                    {headings.title || card.missingCount > 0 || card.columns.some((column) => column.hasPlayerConflict) ? (
                      <div className="da-print-only da-print-card-head">
                        {headings.title ? <span className="da-drill-name">{headings.title}</span> : null}
                        {card.missingCount > 0 ? (
                          <p>A saved drill occurrence is no longer in the source. It was not linked to another drill with the same name.</p>
                        ) : null}
                        {card.columns.some((column) => column.hasPlayerConflict) ? (
                          <p>Repeated player rows for this drill disagreed, so those values are blank.</p>
                        ) : null}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="da-screen-only h-11 rounded-lg border border-zinc-300 px-3 text-sm"
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsed((current) => ({ ...current, [card.id]: !current[card.id] }))}
                    >
                      {isCollapsed ? "Expand" : "Collapse"}
                    </button>
                  </div>
                  <div className="da-card-body grid gap-4 lg:grid-cols-[minmax(180px,280px)_minmax(0,1fr)] lg:items-start">
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
  );
}
