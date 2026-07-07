import { describe, expect, it } from "vitest";
import { resolveExerciseImageUrl } from "@/lib/strength/exerciseImages";

describe("resolveExerciseImageUrl", () => {
  it("prefers live exercise image over snapshot", () => {
    const url = resolveExerciseImageUrl(
      {
        exercise_id: "ex-1",
        exercise_image_url_snapshot: "https://old.example/a.jpg",
      },
      { "ex-1": "https://storage.example/new.jpg" }
    );
    expect(url).toBe("https://storage.example/new.jpg");
  });

  it("falls back to snapshot when exercise has no image", () => {
    const url = resolveExerciseImageUrl(
      {
        exercise_id: "ex-1",
        exercise_image_url_snapshot: "https://old.example/a.jpg",
      },
      { "ex-1": null }
    );
    expect(url).toBe(null);
  });
});
