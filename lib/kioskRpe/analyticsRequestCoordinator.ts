import {
  analyticsRangeCacheKey,
  freezeAnalyticsRangeResult,
  type AnalyticsRangeResult,
} from "@/lib/kioskRpe/analyticsData";

export type AnalyticsCacheEntry =
  | { status: "loading" }
  | { status: "success"; data: AnalyticsRangeResult }
  | { status: "error"; error: string };

export type AnalyticsRangeFetcher = (
  from: string,
  to: string
) => Promise<AnalyticsRangeResult>;

export type AnalyticsRequestCoordinator = {
  subscribe: (key: string, listener: () => void) => () => void;
  getEntry: (key: string) => AnalyticsCacheEntry | undefined;
  loadRange: (from: string, to: string, force?: boolean) => Promise<void>;
};

export function createAnalyticsRequestCoordinator(
  fetcher: AnalyticsRangeFetcher
): AnalyticsRequestCoordinator {
  const cache = new Map<string, AnalyticsCacheEntry>();
  const inflight = new Map<string, Promise<void>>();
  const generation = new Map<string, number>();
  const listeners = new Map<string, Set<() => void>>();

  const notify = (key: string) => {
    listeners.get(key)?.forEach((listener) => listener());
  };

  return {
    subscribe(key: string, listener: () => void) {
      if (!listeners.has(key)) {
        listeners.set(key, new Set());
      }
      listeners.get(key)!.add(listener);
      return () => {
        listeners.get(key)?.delete(listener);
      };
    },

    getEntry(key: string) {
      return cache.get(key);
    },

    async loadRange(from: string, to: string, force = false) {
      const key = analyticsRangeCacheKey(from, to);

      if (!force) {
        const cached = cache.get(key);
        if (cached?.status === "success") return;
      } else {
        cache.delete(key);
      }

      let request = inflight.get(key);
      if (!request || force) {
        const nextGeneration = (generation.get(key) ?? 0) + 1;
        generation.set(key, nextGeneration);

        cache.set(key, { status: "loading" });
        notify(key);

        request = fetcher(from, to)
          .then((data) => {
            if (generation.get(key) !== nextGeneration) return;
            cache.set(key, {
              status: "success",
              data: freezeAnalyticsRangeResult(data),
            });
          })
          .catch((err: unknown) => {
            if (generation.get(key) !== nextGeneration) return;
            cache.set(key, {
              status: "error",
              error: err instanceof Error ? err.message : "Failed to load sessions",
            });
          })
          .finally(() => {
            if (generation.get(key) === nextGeneration) {
              inflight.delete(key);
            }
            notify(key);
          });

        inflight.set(key, request);
      }

      await request;
    },
  };
}
