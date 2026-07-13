import { describe, expect, it } from "vitest";
import {
  getKioskSubmissionConfirmationCopy,
  getKioskTodayNoticeText,
} from "@/lib/kioskRpe/submissionConfirmation";

describe("getKioskSubmissionConfirmationCopy", () => {
  it("does not require confirmation with no previous batches and no missing players", () => {
    const copy = getKioskSubmissionConfirmationCopy({
      completedCount: 18,
      missingCount: 0,
      todayBatchCount: 0,
    });

    expect(copy.required).toBe(false);
  });

  it("preserves missing-player confirmation without previous batches", () => {
    const copy = getKioskSubmissionConfirmationCopy({
      completedCount: 18,
      missingCount: 4,
      todayBatchCount: 0,
    });

    expect(copy.required).toBe(true);
    expect(copy.title).toBe("Submit completed players?");
    expect(copy.message).toBe("4 players are still missing. Submit the 18 completed entries anyway?");
    expect(copy.confirmLabel).toBe("Submit completed players");
  });

  it("confirms same-day submission when one previous batch exists", () => {
    const copy = getKioskSubmissionConfirmationCopy({
      completedCount: 18,
      missingCount: 0,
      todayBatchCount: 1,
    });

    expect(copy.required).toBe(true);
    expect(copy.message).toBe("1 Kiosk session has already been submitted today. Submit another session?");
    expect(copy.confirmLabel).toBe("Submit another session");
  });

  it("uses plural wording for multiple previous batches", () => {
    const copy = getKioskSubmissionConfirmationCopy({
      completedCount: 18,
      missingCount: 0,
      todayBatchCount: 2,
    });

    expect(copy.message).toBe("2 Kiosk sessions have already been submitted today. Submit another session?");
  });

  it("combines previous-batch and missing-player confirmation in one message", () => {
    const copy = getKioskSubmissionConfirmationCopy({
      completedCount: 18,
      missingCount: 4,
      todayBatchCount: 1,
    });

    expect(copy.required).toBe(true);
    expect(copy.title).toBe("Submit another Kiosk session?");
    expect(copy.message).toBe(
      "1 Kiosk session has already been submitted today, and 4 players are still missing. Submit another session with the 18 completed entries?"
    );
    expect(copy.confirmLabel).toBe("Submit completed entries");
  });
});

describe("getKioskTodayNoticeText", () => {
  it("returns no notice for zero previous batches", () => {
    expect(getKioskTodayNoticeText(0)).toBeNull();
  });

  it("uses singular wording for one previous batch", () => {
    expect(getKioskTodayNoticeText(1)).toBe("Today: 1 Kiosk session already submitted.");
  });

  it("uses plural wording for two or more previous batches", () => {
    expect(getKioskTodayNoticeText(2)).toBe("Today: 2 Kiosk sessions already submitted.");
  });
});
