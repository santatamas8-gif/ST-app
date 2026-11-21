/**
 * Movement Prep navigation. Admin only.
 * Staff and players are not granted this route.
 */
export const MOVEMENT_PREP_NAV_ITEM = {
  href: "/admin/movement-prep",
  label: "Movement Prep",
  roles: ["admin"] as const,
};

export function canAccessMovementPrep(role: string): boolean {
  return role === "admin";
}
