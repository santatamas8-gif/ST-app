import { describe, expect, it } from "vitest";
import {
  parseStaffRpeView,
  parseStaffRpeViewFromLocation,
} from "@/lib/rpe/staffRpeView";

describe("staff RPE view parsing", () => {
  it("defaults null values to overview", () => {
    expect(parseStaffRpeView(null)).toBe("overview");
  });

  it.each(["overview", "team", "players", "kiosk"] as const)(
    "preserves valid view %s",
    (view) => {
      expect(parseStaffRpeView(view)).toBe(view);
    }
  );

  it("falls back to overview for invalid values", () => {
    expect(parseStaffRpeView("invalid")).toBe("overview");
  });

  it("maps the old Recent Kiosk Sessions hash to kiosk", () => {
    expect(parseStaffRpeViewFromLocation(null, "#recent-kiosk-sessions")).toBe("kiosk");
  });

  it("preserves the preferred kiosk query value", () => {
    expect(parseStaffRpeViewFromLocation("kiosk", "#recent-kiosk-sessions")).toBe("kiosk");
  });

  it("keeps invalid query values on overview even with unrelated hashes", () => {
    expect(parseStaffRpeViewFromLocation("bad", "#other")).toBe("overview");
  });
});
