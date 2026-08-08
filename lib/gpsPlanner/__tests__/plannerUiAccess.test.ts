import { describe, expect, it } from "vitest";
import { PLANNER_NAV_ITEM } from "@/lib/gpsPlanner/nav";

describe("PLANNER_NAV_ITEM", () => {
  it("exposes Weekly Planner as admin-only", () => {
    expect(PLANNER_NAV_ITEM.href).toBe("/admin/planner");
    expect(PLANNER_NAV_ITEM.label).toBe("Weekly Planner");
    expect(PLANNER_NAV_ITEM.roles).toEqual(["admin"]);
    expect(PLANNER_NAV_ITEM.roles).not.toContain("staff");
    expect(PLANNER_NAV_ITEM.roles).not.toContain("player");
  });
});
