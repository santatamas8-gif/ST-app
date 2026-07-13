export const STAFF_RPE_VIEWS = ["overview", "team", "players", "kiosk"] as const;

export type StaffRpeView = (typeof STAFF_RPE_VIEWS)[number];

const STAFF_RPE_VIEW_SET = new Set<string>(STAFF_RPE_VIEWS);

export function parseStaffRpeView(value: string | null): StaffRpeView {
  if (value != null && STAFF_RPE_VIEW_SET.has(value)) {
    return value as StaffRpeView;
  }
  return "overview";
}

export function parseStaffRpeViewFromLocation(
  value: string | null,
  hash: string | null
): StaffRpeView {
  if (value != null && STAFF_RPE_VIEW_SET.has(value)) {
    return value as StaffRpeView;
  }
  if ((value == null || value === "") && hash === "#recent-kiosk-sessions") {
    return "kiosk";
  }
  return "overview";
}
