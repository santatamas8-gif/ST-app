"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getBodyPartLabel } from "@/lib/bodyMapParts";

export type BodyPartsState = Record<string, { soreness: number; pain: number }>;

const VIEWBOX = "0 0 595.276 841.89";
// Front = elölről (FrontBody), Back = hátulról (BackBody) – ne cseréljük fel
const SVG_FRONT = "/body-map-front.svg";
const SVG_BACK = "/body-map-back.svg";
const SKIP_IDS = new Set(["Face and Skin", "Body"]);
const PART_STROKE = "#a1a1aa";
const PART_STROKE_WIDTH = 0.8;
const PANEL_BG = "#27272a";
const BODY_FILL = "#52525b";
const BODY_STROKE = "#71717a";

/** Opacity 0.28 (1) → 0.88 (10); color intensifies with scale */
function getColor(mode: "soreness" | "pain", value: number): string {
  if (value <= 0) return "transparent";
  const v = Math.min(10, Math.max(1, value));
  const t = (v - 1) / 9;
  const opacity = 0.28 + t * 0.6;
  if (mode === "soreness") {
    const r = Math.round(245 - t * 20);
    const g = Math.round(158 - t * 90);
    const b = Math.round(11 + t * 30);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  const r = Math.round(239 - t * 54);
  const g = Math.round(68 - t * 40);
  const b = Math.round(68 - t * 40);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

interface ParsedPart {
  id: string;
  title: string;
  paths: string[];
}

interface ParsedSvg {
  viewBox: string;
  background: { d: string } | null;
  parts: ParsedPart[];
}

function parseSvg(svgText: string, _view: "front" | "back"): ParsedSvg {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  const viewBox = svg?.getAttribute("viewBox") ?? VIEWBOX;

  let background: { d: string } | null = null;
  const partMap = new Map<string, ParsedPart>();

  doc.querySelectorAll("path.area").forEach((el) => {
    const path = el as SVGPathElement;
    const id = path.getAttribute("id")?.trim();
    const d = path.getAttribute("d");
    if (!id || !d) return;

    if (SKIP_IDS.has(id)) {
      background = { d };
      return;
    }

    const title = path.getAttribute("title")?.trim() ?? id;
    const existing = partMap.get(id);
    if (existing) {
      existing.paths.push(d);
    } else {
      partMap.set(id, { id, title, paths: [d] });
    }
  });

  return {
    viewBox,
    background,
    parts: Array.from(partMap.values()),
  };
}

function BodyFigure({
  parsed,
  view,
  value,
  mode,
  onPartClick,
  zoom,
  pan,
  onZoomPanChange,
}: {
  parsed: ParsedSvg | null;
  view: "front" | "back";
  value: BodyPartsState;
  mode: "soreness" | "pain";
  onPartClick: (partId: string) => void;
  zoom: number;
  pan: { x: number; y: number };
  onZoomPanChange: (zoom: number, pan: { x: number; y: number }) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const lastTouchRef = React.useRef<{ x: number; y: number } | null>(null);
  const lastPinchRef = React.useRef<{ distance: number; zoom: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        lastPinchRef.current = { distance: d, zoom };
        lastTouchRef.current = null;
      } else if (e.touches.length === 1) {
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        lastPinchRef.current = null;
      }
    },
    [zoom]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && lastPinchRef.current) {
        e.preventDefault();
        const d = Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY);
        const ratio = d / lastPinchRef.current.distance;
        const newZoom = Math.min(3, Math.max(1, lastPinchRef.current.zoom * ratio));
        onZoomPanChange(newZoom, pan);
      } else if (e.touches.length === 1 && lastTouchRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastTouchRef.current.x;
        const dy = e.touches[0].clientY - lastTouchRef.current.y;
        lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        onZoomPanChange(zoom, { x: pan.x + dx, y: pan.y + dy });
      }
    },
    [zoom, pan, onZoomPanChange]
  );

  const handleTouchEnd = useCallback(() => {
    lastTouchRef.current = null;
    lastPinchRef.current = null;
  }, []);

  if (!parsed) {
    return (
      <div
        className="flex min-h-[400px] items-center justify-center rounded-xl border border-zinc-600 text-zinc-400"
        style={{ maxWidth: 320, backgroundColor: PANEL_BG }}
      >
        Loading…
      </div>
    );
  }

  const { viewBox, background, parts } = parsed;

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden rounded-xl border border-zinc-600"
      style={{ maxWidth: 320, backgroundColor: PANEL_BG, touchAction: "none" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="origin-center transition-transform duration-100"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          minHeight: 400,
        }}
      >
      <svg viewBox={viewBox} className="h-auto w-full" style={{ minHeight: 400 }} aria-hidden>
        {/* Background outline (body silhouette on dark panel) */}
        {background && (
          <path
            d={background.d}
            fill={BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={0.6}
            style={{ pointerEvents: "none" }}
          />
        )}
        {/* Clickable parts */}
        {parts.map((part) => {
          const s = value[part.id]?.soreness ?? 0;
          const p = value[part.id]?.pain ?? 0;
          const fillS = s > 0 ? getColor("soreness", s) : "transparent";
          const fillP = p > 0 ? getColor("pain", p) : "transparent";
          const fill =
            s > 0 && p > 0
              ? `url(#grad-${part.id})`
              : s > 0
                ? fillS
                : p > 0
                  ? fillP
                  : "transparent";
          const hasValue = s > 0 || p > 0;

          return (
            <g key={part.id}>
              {s > 0 && p > 0 && (
                <defs>
                  <linearGradient id={`grad-${part.id}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={getColor("soreness", s)} />
                    <stop offset="100%" stopColor={getColor("pain", p)} />
                  </linearGradient>
                </defs>
              )}
              {part.paths.map((d, i) => (
                <path
                  key={`${part.id}-${i}`}
                  d={d}
                  fill={fill}
                  stroke={PART_STROKE}
                  strokeWidth={PART_STROKE_WIDTH}
                  className="cursor-pointer transition-all duration-150 hover:opacity-90"
                  onClick={() => onPartClick(part.id)}
                />
              ))}
              {hasValue && (() => {
                const firstD = part.paths[0];
                const match = firstD.match(/M\s*([\d.-]+)\s*[, ]\s*([\d.-]+)/);
                const cx = match ? parseFloat(match[1]) : 297;
                const cy = match ? parseFloat(match[2]) : 420;
                const label = getBodyPartLabel(part.id);
                return (
                  <g className="pointer-events-none">
                    <text
                      x={cx}
                      y={cy - 8}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white font-bold drop-shadow-md"
                      style={{ fontSize: 12 }}
                    >
                      {Math.max(s, p)}
                    </text>
                    <text
                      x={cx}
                      y={cy + 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white drop-shadow-md"
                      style={{ fontSize: 8 }}
                    >
                      {label.length > 20 ? label.slice(0, 18) + "…" : label}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}
      </svg>
      </div>
      <div className="absolute bottom-2 right-2 flex flex-col gap-1 rounded-lg bg-zinc-800/90 p-1 shadow-lg">
        <button
          type="button"
          onClick={() => onZoomPanChange(Math.min(3, zoom + 0.25), pan)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-lg font-bold text-zinc-200 hover:bg-zinc-600 active:bg-zinc-500"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onZoomPanChange(Math.max(1, zoom - 0.25), pan)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-lg font-bold text-zinc-200 hover:bg-zinc-600 active:bg-zinc-500"
          aria-label="Zoom out"
        >
          −
        </button>
        {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
          <button
            type="button"
            onClick={() => onZoomPanChange(1, { x: 0, y: 0 })}
            className="flex h-8 items-center justify-center rounded-md text-xs text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200"
            aria-label="Reset zoom"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

interface BodyMapProps {
  value: BodyPartsState;
  onChange: (next: BodyPartsState) => void;
}

export function BodyMap({ value, onChange }: BodyMapProps) {
  const [mode, setMode] = useState<"soreness" | "pain">("soreness");
  const [currentView, setCurrentView] = useState<"front" | "back">("front");
  const [searchQuery, setSearchQuery] = useState("");
  const [parsedFront, setParsedFront] = useState<ParsedSvg | null>(null);
  const [parsedBack, setParsedBack] = useState<ParsedSvg | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const handleZoomPanChange = useCallback((newZoom: number, newPan: { x: number; y: number }) => {
    setZoom(newZoom);
    setPan(newPan);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(SVG_FRONT)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setParsedFront(parseSvg(text, "front"));
      })
      .catch(() => {
        if (!cancelled) setParsedFront({ viewBox: VIEWBOX, background: null, parts: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(SVG_BACK)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setParsedBack(parseSvg(text, "back"));
      })
      .catch(() => {
        if (!cancelled) setParsedBack({ viewBox: VIEWBOX, background: null, parts: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const parsed = currentView === "front" ? parsedFront : parsedBack;
  const partIds = parsed?.parts.map((p) => p.id) ?? [];
  const allPartIds = [
    ...new Set([
      ...(parsedFront?.parts ?? []).map((p) => p.id),
      ...(parsedBack?.parts ?? []).map((p) => p.id),
    ]),
  ];

  const searchLower = searchQuery.trim().toLowerCase();
  const searchMatches =
    searchLower.length > 0
      ? allPartIds.filter((id) => getBodyPartLabel(id).toLowerCase().includes(searchLower))
      : [];
  const showSearchDropdown = searchQuery.trim().length > 0 && searchMatches.length > 0;

  const handlePartClick = useCallback(
    (partId: string) => {
      const current = value[partId] ?? { soreness: 0, pain: 0 };
      const nextVal = Math.min(10, (current[mode] ?? 0) + 1);
      onChange({
        ...value,
        [partId]: { ...current, [mode]: nextVal },
      });
    },
    [value, onChange, mode]
  );

  const clearPart = useCallback(
    (partId: string) => {
      const next = { ...value };
      delete next[partId];
      onChange(next);
    },
    [value, onChange]
  );

  const entries = Object.entries(value).filter(
    ([, v]) => (v.soreness ?? 0) > 0 || (v.pain ?? 0) > 0
  );

  const handleSearchSelect = useCallback(
    (partId: string) => {
      handlePartClick(partId);
      setSearchQuery("");
    },
    [handlePartClick]
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Tap a body part to add {mode}. Each tap increases the level (1–10).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-zinc-500">Mode:</span>
        <button
          type="button"
          onClick={() => setMode("soreness")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === "soreness"
              ? "bg-amber-600 text-white"
              : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
          }`}
        >
          Soreness
        </button>
        <button
          type="button"
          onClick={() => setMode("pain")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            mode === "pain"
              ? "bg-red-600 text-white"
              : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
          }`}
        >
          Pain
        </button>
        <span className="ml-2 text-xs text-zinc-500">|</span>
        <span className="text-xs font-medium text-zinc-500">View:</span>
        <button
          type="button"
          onClick={() => { setCurrentView("front"); setZoom(1); setPan({ x: 0, y: 0 }); }}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold uppercase tracking-wide transition ${
            currentView === "front"
              ? "bg-emerald-500 text-white"
              : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
          }`}
        >
          FRONT
        </button>
        <button
          type="button"
          onClick={() => { setCurrentView("back"); setZoom(1); setPan({ x: 0, y: 0 }); }}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold uppercase tracking-wide transition ${
            currentView === "back"
              ? "bg-emerald-500 text-white"
              : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
          }`}
        >
          BACK
        </button>
      </div>

      <p className="text-xs text-zinc-500 sm:hidden">
        Pinch to zoom, drag to pan. Use +/− to zoom in on body parts.
      </p>

      <div className="mx-auto">
        <BodyFigure
          parsed={parsed}
          view={currentView}
          value={value}
          mode={mode}
          onPartClick={handlePartClick}
          zoom={zoom}
          pan={pan}
          onZoomPanChange={handleZoomPanChange}
        />
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2">
          <span className="text-zinc-500" aria-hidden>
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tap to search body..."
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
            aria-label="Search body parts"
          />
        </div>
        {showSearchDropdown && (
          <ul
            className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-lg"
            role="listbox"
          >
            {searchMatches.slice(0, 12).map((partId) => (
              <li key={partId} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700"
                  onClick={() => handleSearchSelect(partId)}
                >
                  {getBodyPartLabel(partId)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entries.length > 0 && (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/60 p-3">
          <p className="mb-2 text-xs font-medium text-zinc-400">Selected areas</p>
          <ul className="space-y-1.5 text-sm">
            {entries.map(([partId, v]) => (
              <li key={partId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-zinc-300">{getBodyPartLabel(partId)}</span>
                <span className="flex items-center gap-2">
                  {v.soreness > 0 && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-400">
                      Soreness {v.soreness}
                    </span>
                  )}
                  {v.pain > 0 && (
                    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                      Pain {v.pain}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => clearPart(partId)}
                    className="text-zinc-500 hover:text-red-400"
                    aria-label={`Clear ${partId}`}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
