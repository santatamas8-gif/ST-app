type ConfirmationInput = {
  completedCount: number;
  missingCount: number;
  todayBatchCount: number;
};

export type KioskSubmissionConfirmationCopy = {
  required: boolean;
  title: string;
  message: string;
  confirmLabel: string;
};

function playerText(count: number): string {
  return `${count} ${count === 1 ? "player" : "players"}`;
}

function entryText(count: number): string {
  return `${count} completed ${count === 1 ? "entry" : "entries"}`;
}

function submittedSessionText(count: number): string {
  return `${count} Kiosk ${count === 1 ? "session has" : "sessions have"} already been submitted today`;
}

export function getKioskTodayNoticeText(todayBatchCount: number): string | null {
  if (todayBatchCount <= 0) return null;
  return `Today: ${todayBatchCount} Kiosk ${todayBatchCount === 1 ? "session" : "sessions"} already submitted.`;
}

export function getKioskSubmissionConfirmationCopy({
  completedCount,
  missingCount,
  todayBatchCount,
}: ConfirmationInput): KioskSubmissionConfirmationCopy {
  const hasMissing = missingCount > 0;
  const hasPreviousBatch = todayBatchCount > 0;

  if (!hasMissing && !hasPreviousBatch) {
    return {
      required: false,
      title: "",
      message: "",
      confirmLabel: "Submit All",
    };
  }

  if (hasMissing && hasPreviousBatch) {
    return {
      required: true,
      title: "Submit another Kiosk session?",
      message: `${submittedSessionText(todayBatchCount)}, and ${playerText(missingCount)} ${missingCount === 1 ? "is" : "are"} still missing. Submit another session with the ${entryText(completedCount)}?`,
      confirmLabel: "Submit completed entries",
    };
  }

  if (hasPreviousBatch) {
    return {
      required: true,
      title: "Submit another Kiosk session?",
      message: `${submittedSessionText(todayBatchCount)}. Submit another session?`,
      confirmLabel: "Submit another session",
    };
  }

  return {
    required: true,
    title: "Submit completed players?",
    message: `${playerText(missingCount)} ${missingCount === 1 ? "is" : "are"} still missing. Submit the ${entryText(completedCount)} anyway?`,
    confirmLabel: "Submit completed players",
  };
}
