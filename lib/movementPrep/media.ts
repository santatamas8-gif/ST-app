/**
 * Admin-only Movement Prep sheet and exercise videos.
 * Media ids are a fixed whitelist. Request paths never become filenames.
 */

export type Box = { x: number; y: number; w: number; h: number };

export type MovementPrepMedia = {
  id: string;
  filename: string;
  contentType: "application/pdf" | "video/mp4";
};

const MEDIA: Record<string, MovementPrepMedia> = {
  sheet: {
    id: "sheet",
    filename: "sheet.pdf",
    contentType: "application/pdf",
  },
  "thoracic-rotation": {
    id: "thoracic-rotation",
    filename: "kneeling-dowel-thoracic-rotation.mp4",
    contentType: "video/mp4",
  },
  "side-reach": {
    id: "side-reach",
    filename: "half-kneeling-dowel-side-reach.mp4",
    contentType: "video/mp4",
  },
  "front-to-overhead": {
    id: "front-to-overhead",
    filename: "dowel-raise-front-to-overhead.mp4",
    contentType: "video/mp4",
  },
  "rear-to-overhead": {
    id: "rear-to-overhead",
    filename: "dowel-raise-rear-to-overhead.mp4",
    contentType: "video/mp4",
  },
  "standing-rotation": {
    id: "standing-rotation",
    filename: "standing-dowel-rotation.mp4",
    contentType: "video/mp4",
  },
  "hinge-rotation": {
    id: "hinge-rotation",
    filename: "hip-hinge-dowel-rotation.mp4",
    contentType: "video/mp4",
  },
};

/** Label size as a fraction of the PDF page. Tight around “▶ Video”. */
export const VIDEO_BUTTON_SIZE = { w: 0.05, h: 0.02 } as const;

export type MovementPrepExercise = {
  id: string;
  label: string;
  /** Null when no supplied clip shows this movement. */
  videoId: string | null;
  /** Button center as a fraction of the page, from the top-left. */
  button: { x: number; y: number };
};

/**
 * A small "Video" label on the title line of each exercise, above the photos.
 * Front to Overhead starts with the dowel in front of the thighs.
 * Rear to Overhead starts with the dowel behind the body.
 * Shoulder External Rotation stays upright. Shoulder Internal Rotation stays folded forward.
 */
export const MOVEMENT_PREP_EXERCISES: MovementPrepExercise[] = [
  {
    id: "thoracic-rotation",
    label: "Kneeling Dowel Thoracic Rotation",
    videoId: "thoracic-rotation",
    button: { x: 0.29571954270816286, y: 0.09357010433486614 },
  },
  {
    id: "side-reach",
    label: "Half-Kneeling Dowel Side Reach",
    videoId: "side-reach",
    button: { x: 0.6211341832783024, y: 0.09357010433486614 },
  },
  {
    id: "front-to-overhead",
    label: "Dowel Raise: Front to Overhead",
    videoId: "front-to-overhead",
    button: { x: 0.9465488238484421, y: 0.09357010433486614 },
  },
  {
    id: "rear-to-overhead",
    label: "Dowel Raise: Rear to Overhead",
    videoId: "rear-to-overhead",
    button: { x: 0.29571954270816286, y: 0.5532526446573655 },
  },
  {
    id: "standing-rotation",
    label: "Shoulder External Rotation",
    videoId: "standing-rotation",
    button: { x: 0.6211341832783024, y: 0.5532526446573655 },
  },
  {
    id: "hinge-rotation",
    label: "Shoulder Internal Rotation",
    videoId: "hinge-rotation",
    button: { x: 0.9465488238484421, y: 0.5532526446573655 },
  },
];

/** Photo, name, and sets/reps regions the buttons must not cover. Fractions of the page. */
export const MOVEMENT_PREP_PROTECTED_REGIONS: Box[] = [
  { x: 0.03325850960541391, y: 0.07509126864934501, w: 0.21049073168483567, h: 0.03695767137104225 },
  { x: 0.026131686118539502, y: 0.11876851663330404, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.17636706530157906, y: 0.11876851663330404, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.13535100833070235, y: 0.4222282549087814, w: 0.07846870219831623, h: 0.035277777217813056 },
  { x: 0.35867315017555346, y: 0.07509126864934501, w: 0.20006418892353842, h: 0.03695767137104225 },
  { x: 0.3515463266886791, y: 0.11876851663330404, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.5017817058717187, y: 0.11876851663330404, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.4607656489008419, y: 0.4222282549087814, w: 0.07846870219831623, h: 0.035277777217813056 },
  { x: 0.684087790745693, y: 0.07509126864934501, w: 0.19722890097967688, h: 0.03695767137104225 },
  { x: 0.6769609672588186, y: 0.11876851663330404, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.8271963464418581, y: 0.11876851663330404, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.8105427416589044, y: 0.4222282549087814, w: 0.02974379782247035, h: 0.035277777217813056 },
  { x: 0.03325850960541391, y: 0.5347738089718442, w: 0.19315235794518473, h: 0.03695767137104225 },
  { x: 0.026131686118539502, y: 0.5784510569558033, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.17636706530157906, y: 0.5784510569558033, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.15971346051862528, y: 0.8819107952312807, w: 0.02974379782247035, h: 0.035277777217813056 },
  { x: 0.35867315017555346, y: 0.5347738089718442, w: 0.16843178287704635, h: 0.03695767137104225 },
  { x: 0.3515463266886791, y: 0.5784510569558033, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.5017817058717187, y: 0.5784510569558033, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.4607656489008419, y: 0.8819107952312807, w: 0.07846870219831623, h: 0.035277777217813056 },
  { x: 0.684087790745693, y: 0.5347738089718442, w: 0.16406779129525026, h: 0.03695767137104225 },
  { x: 0.6769609672588186, y: 0.5784510569558033, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.8271963464418581, y: 0.5784510569558033, w: 0.14667196743960237, h: 0.2765814318238103 },
  { x: 0.7861802894709815, y: 0.8819107952312807, w: 0.07846870219831623, h: 0.035277777217813056 },
];

export function movementPrepButtonBox(button: { x: number; y: number }): Box {
  return {
    x: button.x - VIDEO_BUTTON_SIZE.w / 2,
    y: button.y - VIDEO_BUTTON_SIZE.h / 2,
    w: VIDEO_BUTTON_SIZE.w,
    h: VIDEO_BUTTON_SIZE.h,
  };
}

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

export function getMovementPrepMedia(id: string): MovementPrepMedia | null {
  if (!Object.hasOwn(MEDIA, id)) return null;
  return MEDIA[id] ?? null;
}

export function movementPrepMediaUrl(id: string): string {
  return `/api/movement-prep/media?id=${encodeURIComponent(id)}`;
}

export function parseByteRange(
  rangeHeader: string,
  size: number
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || size <= 0) return null;
  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (startText === "" && endText === "") return null;

  if (startText === "") {
    const suffix = Number(endText);
    if (!Number.isInteger(suffix) || suffix <= 0) return null;
    const start = Math.max(0, size - suffix);
    return { start, end: size - 1 };
  }

  const start = Number(startText);
  const end = endText === "" ? size - 1 : Number(endText);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}
