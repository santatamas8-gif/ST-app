import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canAccessMovementPrep, MOVEMENT_PREP_NAV_ITEM } from "@/lib/movementPrep/nav";
import { MOVEMENT_PREP_SHEET_QR } from "@/lib/movementPrep/sheetQr";
import {
  MOVEMENT_PREP_EXERCISES,
  MOVEMENT_PREP_PROTECTED_REGIONS,
  boxesOverlap,
  getMovementPrepMedia,
  movementPrepButtonBox,
  parseByteRange,
} from "@/lib/movementPrep/media";

const root = process.cwd();

describe("Movement Prep access", () => {
  it("is admin only in navigation", () => {
    expect(MOVEMENT_PREP_NAV_ITEM.href).toBe("/admin/movement-prep");
    expect(MOVEMENT_PREP_NAV_ITEM.label).toBe("Movement Prep");
    expect(MOVEMENT_PREP_NAV_ITEM.roles).toEqual(["admin"]);
    expect(canAccessMovementPrep("admin")).toBe(true);
    expect(canAccessMovementPrep("staff")).toBe(false);
    expect(canAccessMovementPrep("player")).toBe(false);
  });

  it("is wired into admin navigation and the admin layout", () => {
    const sidebar = fs.readFileSync(path.join(root, "components", "Sidebar.tsx"), "utf8");
    const layout = fs.readFileSync(
      path.join(root, "app", "(app)", "admin", "movement-prep", "layout.tsx"),
      "utf8"
    );
    const route = fs.readFileSync(
      path.join(root, "app", "api", "movement-prep", "media", "route.ts"),
      "utf8"
    );
    const view = fs.readFileSync(
      path.join(root, "app", "(app)", "admin", "movement-prep", "MovementPrepView.tsx"),
      "utf8"
    );
    expect(view).toContain("window.print()");
    expect(view).toContain("movement-prep-qr");
    expect(view).toContain(".movement-prep-qr { display: none !important; }");
    expect(MOVEMENT_PREP_SHEET_QR).toHaveLength(1);
    expect(MOVEMENT_PREP_SHEET_QR[0]?.id).toBe("stick-mobility");
    expect(MOVEMENT_PREP_SHEET_QR[0]?.href).toBe(
      "https://st-app-seven.vercel.app/admin/movement-prep"
    );
    expect(MOVEMENT_PREP_SHEET_QR[0]?.path.length).toBeGreaterThan(100);
    expect(MOVEMENT_PREP_SHEET_QR[0]?.x).toBeGreaterThan(0.9);
    expect(MOVEMENT_PREP_SHEET_QR[0]?.y).toBeLessThan(0.02);
    expect(view).toContain("size: A4 landscape");
    expect(view).toContain(".movement-prep-screen");
    expect(sidebar).toContain("MOVEMENT_PREP_NAV_ITEM");
    expect(layout).toContain("isAdmin");
    expect(layout).toContain('redirect("/forbidden")');
    expect(route).toContain("requireMovementPrepAdmin");
  });
});

describe("Movement Prep media", () => {
  it("serves only the whitelisted sheet and matched videos", () => {
    expect(getMovementPrepMedia("sheet")?.contentType).toBe("application/pdf");
    expect(getMovementPrepMedia("thoracic-rotation")?.filename).toBe(
      "kneeling-dowel-thoracic-rotation.mp4"
    );
    expect(getMovementPrepMedia("side-reach")?.filename).toBe("half-kneeling-dowel-side-reach.mp4");
    expect(getMovementPrepMedia("front-to-overhead")?.filename).toBe(
      "dowel-raise-front-to-overhead.mp4"
    );
    expect(getMovementPrepMedia("rear-to-overhead")?.filename).toBe(
      "dowel-raise-rear-to-overhead.mp4"
    );
    expect(getMovementPrepMedia("standing-rotation")?.filename).toBe(
      "standing-dowel-rotation.mp4"
    );
    expect(getMovementPrepMedia("hinge-rotation")?.filename).toBe("hip-hinge-dowel-rotation.mp4");
    expect(getMovementPrepMedia("../sheet")).toBeNull();
    expect(getMovementPrepMedia("sheet.pdf")).toBeNull();

    for (const media of [
      getMovementPrepMedia("sheet"),
      getMovementPrepMedia("thoracic-rotation"),
      getMovementPrepMedia("side-reach"),
      getMovementPrepMedia("front-to-overhead"),
      getMovementPrepMedia("rear-to-overhead"),
      getMovementPrepMedia("standing-rotation"),
      getMovementPrepMedia("hinge-rotation"),
    ]) {
      expect(media).not.toBeNull();
      const filePath = path.join(root, "content", "movement-prep", media!.filename);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it("parses byte ranges for video playback", () => {
    expect(parseByteRange("bytes=0-10", 100)).toEqual({ start: 0, end: 10 });
    expect(parseByteRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
    expect(parseByteRange("bytes=-20", 100)).toEqual({ start: 80, end: 99 });
    expect(parseByteRange("bytes=100-120", 100)).toBeNull();
    expect(parseByteRange("bytes=", 100)).toBeNull();
  });
});

describe("Movement Prep video buttons", () => {
  it("places one button beside each exercise without covering the sheet", () => {
    expect(MOVEMENT_PREP_EXERCISES).toHaveLength(6);
    const boxes = MOVEMENT_PREP_EXERCISES.map((exercise) => movementPrepButtonBox(exercise.button));
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(1);
      expect(box.y + box.h).toBeLessThanOrEqual(1);
      for (const region of MOVEMENT_PREP_PROTECTED_REGIONS) {
        expect(boxesOverlap(box, region, 0.004)).toBe(false);
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(boxesOverlap(boxes[i]!, boxes[j]!, 0.004)).toBe(false);
      }
    }
  });
});
