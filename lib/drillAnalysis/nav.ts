/**
 * Drill Analysis navigation. Admin and staff only.
 * Players are not granted this route.
 */
export const DRILL_ANALYSIS_NAV_ITEM = {
  href: "/drill-analysis",
  label: "Drill Analysis",
  roles: ["admin", "staff"] as const,
};

export function canAccessDrillAnalysis(role: string): boolean {
  return (DRILL_ANALYSIS_NAV_ITEM.roles as readonly string[]).includes(role);
}
