import { useEffect, useRef } from "react";

export function useTicker(speed = 30) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let offset = 0;
    let rafId: number;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = now - last;
      last = now;

      offset += (speed * delta) / 1000;

      const first = track.children[0] as HTMLElement;
      const width = first.offsetWidth;

      if (offset >= width) offset -= width;

      track.style.transform = `translateX(-${offset}px)`;

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [speed]);

  return trackRef;
}
