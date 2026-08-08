/**
 * Sidebar nav config for GPS Load Planner (ADMIN ONLY).
 * Exported for unit tests without mounting React.
 */

export const PLANNER_NAV_ITEM = {
  href: "/admin/planner",
  label: "Weekly Planner",
  roles: ["admin"] as const,
};
