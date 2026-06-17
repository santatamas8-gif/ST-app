import { describe, expect, it, vi } from "vitest";
import { analyticsRangeCacheKey } from "@/lib/kioskRpe/analyticsData";
import { createAnalyticsRequestCoordinator } from "@/lib/kioskRpe/analyticsRequestCoordinator";
import { PLAYER_A } from "./fixtures";

const FROM = "2026-05-21";
const TO = "2026-06-17";
const KEY = analyticsRangeCacheKey(FROM, TO);

function sampleData() {
  return {
    sessions: [
      {
        id: "s1",
        user_id: PLAYER_A,
        date: "2026-06-10",
        duration: 75,
        rpe: 7,
        load: 525,
      },
    ],
    players: [{ id: PLAYER_A, name: "Player A" }],
    displayNameByUserId: { [PLAYER_A]: "Player A" },
  };
}

describe("analytics request coordinator", () => {
  it("deduplicates simultaneous requests for the same range", async () => {
    const fetcher = vi.fn().mockResolvedValue(sampleData());
    const coordinator = createAnalyticsRequestCoordinator(fetcher);

    await Promise.all([
      coordinator.loadRange(FROM, TO),
      coordinator.loadRange(FROM, TO),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const entry = coordinator.getEntry(KEY);
    expect(entry?.status).toBe("success");
    if (entry?.status === "success") {
      expect(entry.data.sessions).toHaveLength(1);
    }
  });

  it("fetches a different range separately and reuses cached range", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(sampleData())
      .mockResolvedValueOnce({ ...sampleData(), sessions: [] });
    const coordinator = createAnalyticsRequestCoordinator(fetcher);

    await coordinator.loadRange(FROM, TO);
    await coordinator.loadRange("2026-01-01", "2026-01-31");
    await coordinator.loadRange(FROM, TO);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(coordinator.getEntry(KEY)?.status).toBe("success");
  });

  it("stores safe errors and recovers on forced retry", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request failed (500)"))
      .mockResolvedValueOnce(sampleData());
    const coordinator = createAnalyticsRequestCoordinator(fetcher);

    await coordinator.loadRange(FROM, TO);
    const errorEntry = coordinator.getEntry(KEY);
    expect(errorEntry?.status).toBe("error");
    if (errorEntry?.status === "error") {
      expect(errorEntry.error).toBe("Request failed (500)");
    }

    await coordinator.loadRange(FROM, TO, true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(coordinator.getEntry(KEY)?.status).toBe("success");
  });

  it("ignores stale responses after a forced retry", async () => {
    let resolveLate: (value: unknown) => void;
    const latePromise = new Promise((resolve) => {
      resolveLate = resolve;
    });

    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => latePromise)
      .mockResolvedValueOnce({ ...sampleData(), players: [{ id: PLAYER_A, name: "Fresh" }] });

    const coordinator = createAnalyticsRequestCoordinator(fetcher);

    const first = coordinator.loadRange(FROM, TO);
    await coordinator.loadRange(FROM, TO, true);
    resolveLate!(sampleData());
    await first;

    const entry = coordinator.getEntry(KEY);
    expect(entry?.status).toBe("success");
    if (entry?.status === "success") {
      expect(entry.data.players[0].name).toBe("Fresh");
    }
  });

  it("notifies subscribers when data arrives", async () => {
    const fetcher = vi.fn().mockResolvedValue(sampleData());
    const coordinator = createAnalyticsRequestCoordinator(fetcher);
    const listener = vi.fn();

    coordinator.subscribe(KEY, listener);
    await coordinator.loadRange(FROM, TO);

    expect(listener).toHaveBeenCalled();
  });
});
