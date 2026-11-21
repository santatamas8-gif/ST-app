"use client";

import { useEffect, useRef, useState } from "react";
import {
  MOVEMENT_PREP_EXERCISES,
  VIDEO_BUTTON_SIZE,
  movementPrepMediaUrl,
  type MovementPrepExercise,
} from "@/lib/movementPrep/media";
import { MOVEMENT_PREP_SHEET_QR } from "@/lib/movementPrep/sheetQr";

const READABLE_WIDTH = 980;
const MIN_WIDTH = 320;
const MAX_WIDTH = 2400;
const PAGE_RATIO = 841.8898 / 595.2756;

export function MovementPrepView() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageWidthRef = useRef(READABLE_WIDTH);
  const [containerWidth, setContainerWidth] = useState(0);
  const [stageWidth, setStageWidth] = useState<number | null>(null);
  const [pageRatio, setPageRatio] = useState(PAGE_RATIO);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [active, setActive] = useState<MovementPrepExercise | null>(null);

  const autoWidth = containerWidth >= READABLE_WIDTH ? containerWidth : READABLE_WIDTH;
  const displayedWidth = stageWidth ?? autoWidth;
  stageWidthRef.current = displayedWidth;

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(() => {
      setContainerWidth(scroller.clientWidth);
    });
    observer.observe(scroller);
    setContainerWidth(scroller.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let startDistance = 0;
    let startWidth = 0;

    const distance = (touches: TouchList) => {
      const first = touches[0];
      const second = touches[1];
      if (!first || !second) return 0;
      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    };
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      startDistance = distance(event.touches);
      startWidth = stageWidthRef.current;
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || startDistance <= 0) return;
      event.preventDefault();
      const next = startWidth * (distance(event.touches) / startDistance);
      setStageWidth(clampWidth(next));
    };
    const onEnd = () => {
      startDistance = 0;
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      setStageWidth(clampWidth(stageWidthRef.current * factor));
    };

    scroller.addEventListener("touchstart", onStart, { passive: true });
    scroller.addEventListener("touchmove", onMove, { passive: false });
    scroller.addEventListener("touchend", onEnd);
    scroller.addEventListener("touchcancel", onEnd);
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      scroller.removeEventListener("touchstart", onStart);
      scroller.removeEventListener("touchmove", onMove);
      scroller.removeEventListener("touchend", onEnd);
      scroller.removeEventListener("touchcancel", onEnd);
      scroller.removeEventListener("wheel", onWheel);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const task: {
      render: { cancel: () => void } | null;
      loading: { destroy: () => Promise<void> } | null;
    } = { render: null, loading: null };

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
      const response = await fetch(movementPrepMediaUrl("sheet"), { cache: "no-store" });
      if (!response.ok) throw new Error("The sheet could not be loaded.");
      const data = new Uint8Array(await response.arrayBuffer());
      if (cancelled) return;
      const loadingTask = pdfjs.getDocument({ data });
      task.loading = loadingTask;
      const pdf = await loadingTask.promise;
      if (cancelled) return;
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      setPageRatio(base.width / base.height);
      const viewport = page.getViewport({ scale: 2.5 });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context || cancelled) return;
      const renderTask = page.render({ canvasContext: context, viewport });
      task.render = renderTask;
      await renderTask.promise;
    })().catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof Error && error.name === "RenderingCancelledException") return;
      setPdfFailed(true);
    });

    return () => {
      cancelled = true;
      task.render?.cancel();
      void task.loading?.destroy().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      stopVideo(videoRef.current);
      setActive(null);
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  const openExercise = (exercise: MovementPrepExercise) => {
    const dialog = dialogRef.current;
    const video = videoRef.current;
    if (!dialog || !video) return;
    stopVideo(video);
    setActive(exercise);
    if (!dialog.open) dialog.showModal();
    if (!exercise.videoId) return;
    video.src = movementPrepMediaUrl(exercise.videoId);
    void video.play();
  };

  const closePlayer = () => {
    stopVideo(videoRef.current);
    dialogRef.current?.close();
    setActive(null);
  };

  return (
    <div className="movement-prep-root mx-auto flex w-full max-w-[1200px] flex-col gap-3">
      <style>{`
        .movement-prep-qr { display: none !important; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body, body > div, main, main > div, main > div > div {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            height: auto !important;
            min-height: 0 !important;
            max-width: none !important;
            overflow: visible !important;
          }
          .movement-prep-screen,
          .no-print,
          aside,
          dialog,
          main > div:not(:has(.movement-prep-root)) {
            display: none !important;
          }
          .movement-prep-root,
          .movement-prep-stage,
          .movement-prep-sheet {
            width: 297mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            overflow: visible !important;
            background: #fff !important;
            border-radius: 0 !important;
          }
          .movement-prep-sheet {
            height: 210mm !important;
            aspect-ratio: auto !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .movement-prep-sheet canvas {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            height: 100% !important;
          }
          .movement-prep-qr {
            display: block !important;
            background: #fff !important;
          }
        }
      `}</style>
      <div className="movement-prep-screen flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Upper Body Stick Mobility</h1>
          <p className="mt-1 text-sm text-zinc-400">Admin sheet. Pinch or use zoom to read it on a phone.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-900 px-4 text-sm font-medium text-white"
            onClick={() => window.print()}
          >
            Print
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-900 text-lg text-white"
            onClick={() => setStageWidth(clampWidth(displayedWidth / 1.2))}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-900 px-3 text-sm font-medium text-white"
            onClick={() => {
              setStageWidth(Math.max(containerWidth, MIN_WIDTH));
              if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
            }}
          >
            Fit
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-900 text-lg text-white"
            onClick={() => setStageWidth(clampWidth(displayedWidth * 1.2))}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="movement-prep-stage overflow-auto rounded-xl bg-zinc-800/60">
        <div
          className="movement-prep-sheet relative mx-auto bg-white"
          style={{ width: displayedWidth, aspectRatio: pageRatio }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          {pdfFailed ? (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-zinc-700">
              The sheet could not be loaded.
            </p>
          ) : null}
          {MOVEMENT_PREP_SHEET_QR.map((code) => (
            <svg
              key={code.id}
              className="movement-prep-qr pointer-events-none absolute bg-white"
              viewBox={code.viewBox}
              style={{
                left: `${code.x * 100}%`,
                top: `${code.y * 100}%`,
                width: "15mm",
                height: "15mm",
              }}
              aria-hidden
            >
              <path d={code.path} fill="#000" />
            </svg>
          ))}
          {MOVEMENT_PREP_EXERCISES.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              className={`movement-prep-screen absolute z-10 flex items-center justify-end bg-transparent p-0 font-medium leading-none touch-manipulation ${
                exercise.videoId ? "text-white" : "text-zinc-400"
              }`}
              style={{
                left: `${exercise.button.x * 100}%`,
                top: `${exercise.button.y * 100}%`,
                width: `${VIDEO_BUTTON_SIZE.w * 100}%`,
                height: `${VIDEO_BUTTON_SIZE.h * 100}%`,
                transform: "translate(-50%, -50%)",
                fontSize: Math.max(8, displayedWidth * 0.008),
              }}
              aria-label={`Video: ${exercise.label}`}
              onClick={() => openExercise(exercise)}
            >
              ▶ Video
            </button>
          ))}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="movement-prep-screen m-auto w-fit max-w-[calc(100%-1.5rem)] rounded-xl border-0 bg-black p-2.5 text-white shadow-2xl backdrop:bg-black/75"
        aria-label={active ? `Video: ${active.label}` : "Video"}
        onClick={(event) => {
          if (event.target === dialogRef.current) closePlayer();
        }}
      >
        <div className="relative w-[min(46rem,calc(100vw-2rem))] pt-7">
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{active?.label ?? "Video"}</p>
            <button type="button" className="shrink-0 text-sm text-zinc-300" onClick={closePlayer}>
              Close
            </button>
          </div>
          {active && !active.videoId ? (
            <p className="px-1 py-6 text-sm text-zinc-300">No video is available for this exercise yet.</p>
          ) : null}
          <div
            className={
              active && !active.videoId
                ? "hidden"
                : "relative aspect-video w-full overflow-hidden rounded-lg"
            }
          >
            <video
              ref={videoRef}
              className="absolute left-1/2 top-0 h-full w-auto -translate-x-1/2"
              controls
              playsInline
              preload="auto"
            />
          </div>
        </div>
      </dialog>
    </div>
  );
}

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

function stopVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  video.pause();
  video.removeAttribute("src");
  video.load();
}
