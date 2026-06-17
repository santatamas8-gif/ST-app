"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { analyticsRangeCacheKey, fetchAnalyticsRange, type AnalyticsRangeResult } from "@/lib/kioskRpe/analyticsData";
import {
  createAnalyticsRequestCoordinator,
  type AnalyticsRequestCoordinator,
} from "@/lib/kioskRpe/analyticsRequestCoordinator";
import { validateDateRange } from "@/lib/kioskRpe/matchdayAnalytics";

const RpeAnalyticsDataContext = createContext<AnalyticsRequestCoordinator | null>(null);

export function RpeAnalyticsDataProvider({ children }: { children: ReactNode }) {
  const coordinator = useMemo(
    () => createAnalyticsRequestCoordinator(fetchAnalyticsRange),
    []
  );

  return (
    <RpeAnalyticsDataContext.Provider value={coordinator}>{children}</RpeAnalyticsDataContext.Provider>
  );
}

export function useRpeAnalyticsData(
  from: string,
  to: string,
  enabled = true
): {
  data: AnalyticsRangeResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const coordinator = useContext(RpeAnalyticsDataContext);
  if (!coordinator) {
    throw new Error("useRpeAnalyticsData must be used within RpeAnalyticsDataProvider");
  }

  const key = analyticsRangeCacheKey(from, to);
  const isValid = enabled && validateDateRange(from, to).valid;
  const [, bump] = useState(0);

  useEffect(() => {
    if (!isValid) return;
    const unsubscribe = coordinator.subscribe(key, () => bump((n) => n + 1));
    void coordinator.loadRange(from, to);
    return unsubscribe;
  }, [coordinator, from, to, key, isValid]);

  const refetch = useCallback(() => {
    if (!isValid) return;
    void coordinator.loadRange(from, to, true);
  }, [coordinator, from, to, isValid]);

  const entry = isValid ? coordinator.getEntry(key) : undefined;

  return {
    data: entry?.status === "success" ? entry.data : null,
    loading: Boolean(isValid && (!entry || entry.status === "loading")),
    error: entry?.status === "error" ? entry.error : null,
    refetch,
  };
}
