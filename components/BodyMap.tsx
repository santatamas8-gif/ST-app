"use client";

import React, { useCallback, useEffect, useState } from "react";
import { List } from "lucide-react";
import { getBodyPartLabel } from "@/lib/bodyMapParts";

export type BodyPartsState = Record<string, { soreness: number; pain: number }>;

const VIEWBOX = "0 0 595.276 841.89";
// Front = elölről (FrontBody), Back = hátulról (BackBody) – ne cseréljük fel
const SVG_FRONT = "/body-map-front.svg";
const SVG_BACK = "/body-map-back.svg";
const SKIP_IDS = new Set(["Face and Skin", "Body"]);
const PART_STROKE = "#a1a1aa";
const PART_STROKE_WIDTH = 0.8;
/** Transparent stroke width for larger touch hit area (viewBox units); mobile only */
const TOUCH_HIT_STROKE = 18;
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
  className,
  touchFriendly = false,
  defaultZoom = 1,
}: {
  parsed: ParsedSvg | null;
  view: "front" | "back";
  value: BodyPartsState;
  mode: "soreness" | "pain";
  onPartClick: (partId: string) => void;
  zoom: number;
  pan: { x: number; y: number };
  onZoomPanChange: (zoom: number, pan: { x: number; y: number }) => void;
  className?: string;
  /** When true, render transparent stroke overlays for larger touch hit areas (mobile). */
  touchFriendly?: boolean;
  /** Zoom level used for "reset/fit" (e.g. 1.3 on mobile). */
  defaultZoom?: number;
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
        className={`flex min-h-[400px] items-center justify-center rounded-xl border border-zinc-600 text-zinc-400 ${className ?? ""}`}
        style={{ backgroundColor: PANEL_BG }}
      >
        Loading…
      </div>
    );
  }

  const { viewBox, background, parts } = parsed;

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-xl border border-zinc-600 ${className ?? ""}`}
      style={{ backgroundColor: PANEL_BG, touchAction: "none" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        className="origin-center h-full min-h-[260px] min-w-full w-full transition-transform duration-100 md:min-h-[400px]"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
      <svg viewBox={viewBox} className="h-full w-full min-h-[260px] min-w-full md:h-auto md:min-h-[400px]" preserveAspectRatio="xMidYMid meet" aria-hidden>
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
                <g key={`${part.id}-${i}`}>
                  <path
                    d={d}
                    fill={fill}
                    stroke={PART_STROKE}
                    strokeWidth={PART_STROKE_WIDTH}
                    className="cursor-pointer transition-all duration-150 hover:opacity-90"
                    onClick={() => onPartClick(part.id)}
                  />
                  {touchFriendly && (
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={TOUCH_HIT_STROKE}
                      className="cursor-pointer"
                      onClick={() => onPartClick(part.id)}
                      aria-hidden
                    />
                  )}
                </g>
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
      <div className="absolute bottom-2 right-2 flex flex-col gap-1 rounded-lg bg-zinc-800/90 p-1.5 shadow-lg">
        <button
          type="button"
          onClick={() => onZoomPanChange(Math.min(3, zoom + 0.25), pan)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-zinc-200 hover:bg-zinc-600 active:bg-zinc-500"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onZoomPanChange(Math.max(1, zoom - 0.25), pan)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg font-bold text-zinc-200 hover:bg-zinc-600 active:bg-zinc-500"
          aria-label="Zoom out"
        >
          −
        </button>
        {(zoom !== defaultZoom || pan.x !== 0 || pan.y !== 0) && (
          <button
            type="button"
            onClick={() => onZoomPanChange(defaultZoom, { x: 0, y: 0 })}
            className="flex h-8 items-center justify-center rounded-lg text-xs text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200"
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
  /** When true (e.g. mobile), only fetch/render the current view's SVG to avoid layout issues. */
  singleView?: boolean;
  /** When true (e.g. mobile), larger touch hit areas via transparent stroke overlays. */
  touchFriendly?: boolean;
  /** Initial/default zoom (e.g. 1.25 on mobile for a larger body). Fit button resets to this. */
  defaultZoom?: number;
}

export function BodyMap({ value, onChange, singleView = false, touchFriendly = false, defaultZoom = 1 }: BodyMapProps) {
  const [mode, setMode] = useState<"soreness" | "pain">("soreness");
  const [currentView, setCurrentView] = useState<"front" | "back">("front");
  const [searchQuery, setSearchQuery] = useState("");
  const [parsedFront, setParsedFront] = useState<ParsedSvg | null>(null);
  const [parsedBack, setParsedBack] = useState<ParsedSvg | null>(null);
  const [zoom, setZoom] = useState(defaultZoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const handleZoomPanChange = useCallback((newZoom: number, newPan: { x: number; y: number }) => {
    setZoom(newZoom);
    setPan(newPan);
  }, []);

  const handleFit = useCallback(() => {
    setZoom(defaultZoom);
    setPan({ x: 0, y: 0 });
  }, [defaultZoom]);

  useEffect(() => {
    if (singleView && currentView !== "front") return;
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
  }, [singleView, currentView]);

  useEffect(() => {
    if (singleView && currentView !== "back") return;
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
  }, [singleView, currentView]);

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
    <div className="flex min-h-0 min-w-[260px] flex-1 flex-col overflow-visible space-y-3 w-full md:flex-initial md:overflow-visible">
      <div className="flex shrink-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-2 md:gap-y-2">
        <div className="flex items-center gap-2">
          <span className="w-[3rem] shrink-0 text-xs font-medium text-zinc-500">Mode:</span>
          <button
            type="button"
            onClick={() => setMode("soreness")}
            className={`min-w-[5.5rem] rounded-lg px-2 py-1 text-xs font-medium transition md:min-w-[6rem] md:px-3 md:py-1.5 md:text-sm ${
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
            className={`min-w-[5.5rem] rounded-lg px-2 py-1 text-xs font-medium transition md:min-w-[6rem] md:px-3 md:py-1.5 md:text-sm ${
              mode === "pain"
                ? "bg-red-600 text-white"
                : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
            }`}
          >
            Pain
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-zinc-500 md:inline" aria-hidden>|</span>
          <span className="w-[3rem] shrink-0 text-xs font-medium text-zinc-500">View:</span>
          <button
            type="button"
            onClick={() => { setCurrentView("front"); setZoom(defaultZoom); setPan({ x: 0, y: 0 }); }}
            className={`min-w-[5.5rem] rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-wide transition md:min-w-[6rem] md:px-3 md:py-1.5 md:text-sm ${
              currentView === "front"
                ? "bg-emerald-500 text-white"
                : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
            }`}
          >
            FRONT
          </button>
          <button
            type="button"
            onClick={() => { setCurrentView("back"); setZoom(defaultZoom); setPan({ x: 0, y: 0 }); }}
            className={`min-w-[5.5rem] rounded-lg px-2 py-1 text-xs font-semibold uppercase tracking-wide transition md:min-w-[6rem] md:px-3 md:py-1.5 md:text-sm ${
              currentView === "back"
                ? "bg-emerald-500 text-white"
                : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
            }`}
          >
            BACK
          </button>
        </div>
      </div>

      {/* Body map keret – a test ábra */}
      <div className="mx-auto h-[74vh] min-h-[450px] w-full min-w-[260px] shrink-0 overflow-hidden md:h-auto md:min-h-0 md:max-w-[320px] md:flex-none">
        <BodyFigure
          parsed={parsed}
          view={currentView}
          value={value}
          mode={mode}
          onPartClick={handlePartClick}
          zoom={zoom}
          pan={pan}
          onZoomPanChange={handleZoomPanChange}
          className="h-full min-h-0 min-w-full w-full max-w-full md:max-w-[320px] md:h-auto"
          touchFriendly={touchFriendly}
          defaultZoom={defaultZoom}
        />
      </div>

      <div className="relative mt-3 shrink-0 min-w-0">
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2">
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

      {/* Külön keret: kijelölt body parts (soreness + pain) – bodymap keret alatt */}
      <div className="mt-4 flex max-h-[38vh] min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border-2 border-zinc-600 bg-zinc-800/80 p-3 shadow-inner">
        <p className="mb-2 flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white">
          <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Selected body parts
        </p>
        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden text-sm">
          {entries.length === 0 ? (
            <li className="py-2 text-zinc-500">Tap body parts above to add them here.</li>
          ) : (
            entries.map(([partId, v]) => (
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
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

/** Converts wellness body_parts (s/p) to BodyMap value (soreness/pain) */
function toBodyPartsState(bodyParts: Record<string, { s: number; p: number }> | null): BodyPartsState {
  if (!bodyParts) return {};
  const out: BodyPartsState = {};
  Object.entries(bodyParts).forEach(([id, v]) => {
    out[id] = { soreness: v.s ?? 0, pain: v.p ?? 0 };
  });
  return out;
}

const VIEWONLY_SIZE = { default: 280, large: 420 } as const;

/** Read-only body map: shows front + back with highlighted areas, no click/zoom. */
export function BodyMapViewOnly({
  bodyParts,
  className,
  mode,
  hideLabels = false,
  size = "default",
}: {
  bodyParts: Record<string, { s: number; p: number }> | null;
  className?: string;
  /** When set, only color by this (soreness or pain); otherwise both with gradient. */
  mode?: "soreness" | "pain";
  /** When true, no numbers/labels on the figure, only colors. */
  hideLabels?: boolean;
  /** "large" for staff/admin view, "default" for modal. */
  size?: "default" | "large";
}) {
  const [parsedFront, setParsedFront] = useState<ParsedSvg | null>(null);
  const [parsedBack, setParsedBack] = useState<ParsedSvg | null>(null);
  const value = toBodyPartsState(bodyParts);

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

  const noData = !bodyParts || Object.keys(bodyParts).length === 0;

  return (
    <div className={className}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-center">
        {/* Front */}
        <div className="flex flex-col items-center">
          <span className="mb-1 text-xs font-medium text-zinc-500">Front</span>
          {!parsedFront ? (
            <div
              className="flex items-center justify-center rounded-xl border border-zinc-600 text-zinc-400"
              style={{ backgroundColor: PANEL_BG, minHeight: VIEWONLY_SIZE[size], width: VIEWONLY_SIZE[size] }}
            >
              Loading…
            </div>
          ) : (
            <ReadOnlyFigure
              parsed={parsedFront}
              value={value}
              gradientPrefix="viewonly-front"
              mode={mode}
              hideLabels={hideLabels}
              sizePx={VIEWONLY_SIZE[size]}
            />
          )}
        </div>
        {/* Back */}
        <div className="flex flex-col items-center">
          <span className="mb-1 text-xs font-medium text-zinc-500">Back</span>
          {!parsedBack ? (
            <div
              className="flex items-center justify-center rounded-xl border border-zinc-600 text-zinc-400"
              style={{ backgroundColor: PANEL_BG, minHeight: VIEWONLY_SIZE[size], width: VIEWONLY_SIZE[size] }}
            >
              Loading…
            </div>
          ) : (
            <ReadOnlyFigure
              parsed={parsedBack}
              value={value}
              gradientPrefix="viewonly-back"
              mode={mode}
              hideLabels={hideLabels}
              sizePx={VIEWONLY_SIZE[size]}
            />
          )}
        </div>
      </div>
      {noData && (
        <p className="mt-2 text-center text-xs text-zinc-500">No body parts recorded for this entry.</p>
      )}
    </div>
  );
}

function ReadOnlyFigure({
  parsed,
  value,
  gradientPrefix,
  mode,
  hideLabels = false,
  sizePx = 280,
}: {
  parsed: ParsedSvg;
  value: BodyPartsState;
  gradientPrefix: string;
  mode?: "soreness" | "pain";
  hideLabels?: boolean;
  sizePx?: number;
}) {
  const { viewBox, background, parts } = parsed;
  return (
    <div
      className="overflow-hidden rounded-xl border border-zinc-600"
      style={{ maxWidth: sizePx, width: sizePx, backgroundColor: PANEL_BG }}
    >
      <svg viewBox={viewBox} className="h-auto w-full" style={{ minHeight: sizePx }} aria-hidden>
        {background && (
          <path
            d={background.d}
            fill={BODY_FILL}
            stroke={BODY_STROKE}
            strokeWidth={0.6}
            style={{ pointerEvents: "none" }}
          />
        )}
        {parts.map((part) => {
          const s = value[part.id]?.soreness ?? 0;
          const p = value[part.id]?.pain ?? 0;
          const useS = mode === "pain" ? 0 : s;
          const useP = mode === "soreness" ? 0 : p;
          const fillS = useS > 0 ? getColor("soreness", useS) : "transparent";
          const fillP = useP > 0 ? getColor("pain", useP) : "transparent";
          const fill =
            useS > 0 && useP > 0
              ? `url(#${gradientPrefix}-grad-${part.id})`
              : useS > 0
                ? fillS
                : useP > 0
                  ? fillP
                  : "transparent";
          const hasValue = (mode == null ? s > 0 || p > 0 : mode === "soreness" ? s > 0 : p > 0);

          return (
            <g key={part.id}>
              {useS > 0 && useP > 0 && (
                <defs>
                  <linearGradient id={`${gradientPrefix}-grad-${part.id}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={getColor("soreness", useS)} />
                    <stop offset="100%" stopColor={getColor("pain", useP)} />
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
                  style={{ pointerEvents: "none" }}
                />
              ))}
              {!hideLabels && hasValue && (() => {
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
                      style={{ fontSize: 11 }}
                    >
                      {Math.max(s, p)}
                    </text>
                    <text
                      x={cx}
                      y={cy + 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-white drop-shadow-md"
                      style={{ fontSize: 7 }}
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
  );
}
