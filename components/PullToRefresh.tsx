"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 70;
const MOBILE_MAX_WIDTH = 768;

/**
 * On mobile, when user pulls down at the top of the page, refreshes the route.
 * Renders a small indicator when pulling; only active on viewport width <= MOBILE_MAX_WIDTH.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pulling, setPulling] = useState(false);
  const [pullY, setPullY] = useState(0);
  const startY = useRef(0);
  const isAtTop = useRef(true);
  const isMobile = useRef(false);
  const currentPullY = useRef(0);

  useEffect(() => {
    const checkMobile = () => {
      isMobile.current = typeof window !== "undefined" && window.innerWidth <= MOBILE_MAX_WIDTH;
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const handleTouchStart = (e: TouchEvent) => {
      if (!isMobile.current) return;
      startY.current = e.touches[0].clientY;
      isAtTop.current = typeof window !== "undefined" && window.scrollY <= 8;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isMobile.current || !isAtTop.current) return;
      const y = e.touches[0].clientY;
      const delta = y - startY.current;
      if (delta > 0) {
        currentPullY.current = Math.min(delta, PULL_THRESHOLD * 1.2);
        setPulling(true);
        setPullY(currentPullY.current);
      }
    };

    const handleTouchEnd = () => {
      const y = currentPullY.current;
      currentPullY.current = 0;
      setPulling(false);
      setPullY(0);
      if (y >= PULL_THRESHOLD) {
        router.refresh();
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("resize", checkMobile);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [router]);

  return (
    <>
      {pulling && pullY > 10 && (
        <div
          className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-center bg-transparent pt-2 md:hidden"
          aria-live="polite"
          aria-label="Pull to refresh"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800/90 text-zinc-400 shadow-lg"
            style={{ opacity: Math.min(1, pullY / PULL_THRESHOLD) }}
          >
            {pullY >= PULL_THRESHOLD ? (
              <span className="text-xs font-medium">Release</span>
            ) : (
              <span className="text-lg">↓</span>
            )}
          </div>
        </div>
      )}
      {children}
    </>
  );
}
