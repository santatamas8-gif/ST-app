export const STRENGTH_EXERCISE_IMAGES_BUCKET = "strength-exercise-images";
export const MAX_EXERCISE_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB
export const EXERCISE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ExerciseImageMime = (typeof EXERCISE_IMAGE_TYPES)[number];

export function extensionForMime(type: string): "jpg" | "png" | "webp" {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export function storagePathForExercise(exerciseId: string, ext: string): string {
  return `${exerciseId}.${ext}`;
}

export function storagePathsForExercise(exerciseId: string): string[] {
  return ["jpg", "jpeg", "png", "webp"].map((ext) => `${exerciseId}.${ext}`);
}

/** Append cache-buster when replacing the same public URL path. */
export function withImageCacheBuster(publicUrl: string): string {
  const sep = publicUrl.includes("?") ? "&" : "?";
  return `${publicUrl}${sep}v=${Date.now()}`;
}

export function isStrengthExerciseStorageUrl(url: string | null | undefined): boolean {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return false;
  return trimmed.includes(`/${STRENGTH_EXERCISE_IMAGES_BUCKET}/`);
}
